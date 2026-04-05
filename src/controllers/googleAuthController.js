// controllers/googleAuthController.js
const jwt              = require('jsonwebtoken')
const bcrypt           = require('bcryptjs')
const { OAuth2Client } = require('google-auth-library')
const User             = require('../models/User')

// ✅ Client sans argument fixe — l'audience est passée dans verifyIdToken
const client = new OAuth2Client()

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' })

// ═══════════════════════════════════════════════════════════════════════
// Helper : créer ou mettre à jour un utilisateur Google en base
// ═══════════════════════════════════════════════════════════════════════
const upsertGoogleUser = async ({ googleId, email, name, picture, email_verified }) => {
  let user = await User.findOne({
    $or: [{ googleId }, { email: email.toLowerCase() }],
  })

  let isNewUser = false

  if (user) {
    // ── Utilisateur existant : compléter les champs manquants ────────────
    if (!user.googleId)                        user.googleId      = googleId
    if (!user.avatar && picture)               user.avatar        = picture
    if (!user.emailVerified && email_verified) user.emailVerified = true
    if (user.provider !== 'google')            user.provider      = 'google'
    await user.save()
  } else {
    // ── Nouvel utilisateur : créer le compte ─────────────────────────────
    isNewUser = true
    const randomPassword = await bcrypt.hash(googleId + process.env.JWT_SECRET, 10)

    user = await User.create({
      googleId,
      name:          name || email.split('@')[0],
      email:         email.toLowerCase(),
      avatar:        picture || null,
      emailVerified: email_verified ?? true,
      provider:      'google',
      password:      randomPassword,
      dateOfBirth:   new Date('2000-01-01'),
      gender:        'other',
      phoneVerified: false,
    })
  }

  return { user, isNewUser }
}

// ═══════════════════════════════════════════════════════════════════════
// Helper : construire la réponse finale
//
// needsProfileCompletion contrôle la navigation côté client :
//   true  → Nouvel utilisateur → RegisterStep3
//   false → Utilisateur existant → Home
// ═══════════════════════════════════════════════════════════════════════
const buildResponse = (res, user, isNewUser) => {
  const token = signToken(user._id)

  // Un user est "nouveau" s'il vient d'être créé OU si son profil n'est pas complet
  const needsProfileCompletion = isNewUser || 
  (!user.hasCompletedProfile && !user.profileCompleted);

  return res.status(200).json({
    success: true,
    token,
    needsProfileCompletion,   // ← clé de la séparation Login / Register
    user: {
      id:                  user._id.toString(),
      name:                user.name,
      email:               user.email,
      avatar:              user.avatar,
      emailVerified:       user.emailVerified,
      provider:            user.provider,
      isPremium:           user.isPremium           || false,
      hasCompletedProfile: user.hasCompletedProfile || false,
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════
// POST /api/auth/google
//
// Accepte deux formats :
//   1. { idToken }                  → flux principal (sécurisé)
//   2. { accessToken, userInfo }    → flux fallback (quand idToken absent)
//
// Résultat :
//   - needsProfileCompletion: false → user existant → navigate Home
//   - needsProfileCompletion: true  → nouvel user   → navigate RegisterStep3
// ═══════════════════════════════════════════════════════════════════════
exports.googleSignIn = async (req, res) => {
  try {
    const { idToken, accessToken, userInfo } = req.body

    // ── Flux 1 : idToken (préféré) ────────────────────────────────────────
    if (idToken) {
      // ✅ Accepter les tokens émis par n'importe lequel des clients Google de l'app
      // (Web, Android, iOS peuvent chacun émettre un idToken avec leur propre client_id)
      const validAudiences = [
        process.env.GOOGLE_WEB_CLIENT_ID,
        process.env.GOOGLE_ANDROID_CLIENT_ID,
        process.env.GOOGLE_IOS_CLIENT_ID,
      ].filter(Boolean)

      if (validAudiences.length === 0) {
        console.error('❌ Aucun GOOGLE_*_CLIENT_ID configuré dans les variables d\'environnement')
        return res.status(500).json({ message: 'Google OAuth non configuré sur le serveur' })
      }

      let payload
      try {
        const ticket = await client.verifyIdToken({
          idToken,
          audience: validAudiences,   // ✅ tableau — accepte Web, Android et iOS
        })
        payload = ticket.getPayload()
      } catch (verifyErr) {
        // Erreurs courantes :
        // "Wrong number of segments"  → accessToken envoyé à la place de l'idToken
        // "Invalid audience"          → client ID manquant dans validAudiences
        // "Token used too late"       → décalage d'horloge serveur
        console.error('❌ verifyIdToken échoué:', verifyErr.message)
        return res.status(401).json({
          message: 'Token Google invalide',
          detail:  verifyErr.message,
        })
      }

      const {
        sub:        googleId,
        email,
        email_verified,
        name,
        picture,
        given_name,
      } = payload

      if (!email) {
        return res.status(400).json({ message: 'Impossible de récupérer l\'email depuis Google' })
      }

      const { user, isNewUser } = await upsertGoogleUser({
        googleId,
        email,
        name: name || given_name,
        picture,
        email_verified,
      })

      return buildResponse(res, user, isNewUser)
    }

    // ── Flux 2 : accessToken + userInfo (fallback) ────────────────────────
    if (accessToken && userInfo) {
      // Valider le accessToken auprès de Google
      const tokenInfoRes = await fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`
      )
      const tokenInfo = await tokenInfoRes.json()

      if (tokenInfo.error || !tokenInfo.sub) {
        console.error('❌ accessToken invalide:', tokenInfo)
        return res.status(401).json({ message: 'Token Google invalide' })
      }

      // Vérifier que le token appartient bien à notre application
      const validAudiences = [
        process.env.GOOGLE_WEB_CLIENT_ID,
        process.env.GOOGLE_ANDROID_CLIENT_ID,
        process.env.GOOGLE_IOS_CLIENT_ID,
      ].filter(Boolean)

      if (!validAudiences.includes(tokenInfo.aud)) {
        console.error('❌ Audience du accessToken incorrecte:', tokenInfo.aud)
        return res.status(401).json({ message: 'Token Google invalide pour cette application' })
      }

      const { id: googleId, email, name, picture } = userInfo

      if (!email) {
        return res.status(400).json({ message: 'Impossible de récupérer l\'email depuis Google' })
      }

      const { user, isNewUser } = await upsertGoogleUser({
        googleId: googleId || tokenInfo.sub,
        email,
        name,
        picture,
        email_verified: true,
      })

      return buildResponse(res, user, isNewUser)
    }

    // ── Aucun token fourni ────────────────────────────────────────────────
    return res.status(400).json({
      message: 'idToken ou (accessToken + userInfo) requis',
    })

  } catch (err) {
    console.error('❌ Erreur inattendue Google sign-in:', err)
    return res.status(500).json({
      message: 'Server error during Google sign-in',
      error:   err.message,
    })
  }
}
// controllers/googleAuthController.js
const jwt            = require('jsonwebtoken')
const bcrypt         = require('bcryptjs')
const { OAuth2Client } = require('google-auth-library')
const User           = require('../models/User')

// ✅ Instancier le client SANS argument — on passera l'audience dans verifyIdToken
const client = new OAuth2Client()

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' })

// ── Helper : créer ou mettre à jour un user depuis les données Google ────────
const upsertGoogleUser = async ({ googleId, email, name, picture, email_verified }) => {
  let user = await User.findOne({
    $or: [{ googleId }, { email: email.toLowerCase() }],
  })

  let isNewUser = false

  if (user) {
    // Mettre à jour les champs manquants pour un user existant
    if (!user.googleId)                          user.googleId     = googleId
    if (!user.avatar && picture)                 user.avatar       = picture
    if (!user.emailVerified && email_verified)   user.emailVerified = true
    if (user.provider !== 'google')              user.provider     = 'google'
    await user.save()
  } else {
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

// ── Helper : formater la réponse finale ──────────────────────────────────────
const buildResponse = (res, user, isNewUser) => {
  const token = signToken(user._id)

  return res.status(200).json({
    success: true,
    token,
    needsProfileCompletion: isNewUser || !user.hasCompletedProfile,
    user: {
      id:                 user._id.toString(),
      name:               user.name,
      email:              user.email,
      avatar:             user.avatar,
      emailVerified:      user.emailVerified,
      provider:           user.provider,
      isPremium:          user.isPremium          || false,
      hasCompletedProfile: user.hasCompletedProfile || false,
    },
  })
}

// ============= GOOGLE SIGN-IN =============
exports.googleSignIn = async (req, res) => {
  try {
    const { idToken, accessToken, userInfo } = req.body

    // ── Flux 1 : idToken (flux préféré et sécurisé) ─────────────────────────
    if (idToken) {
      // ✅ Accepter les tokens émis par n'importe quel client Google de l'app
      const validAudiences = [
        process.env.GOOGLE_WEB_CLIENT_ID,
        process.env.GOOGLE_ANDROID_CLIENT_ID,
        process.env.GOOGLE_IOS_CLIENT_ID,
      ].filter(Boolean) // retire les valeurs undefined / vides

      if (validAudiences.length === 0) {
        console.error('❌ No Google Client IDs configured in environment variables')
        return res.status(500).json({ message: 'Google OAuth not configured on server' })
      }

      let payload
      try {
        const ticket = await client.verifyIdToken({
          idToken,
          audience: validAudiences, // ✅ tableau — accepte web, Android et iOS
        })
        payload = ticket.getPayload()
      } catch (verifyErr) {
        // Log précis pour faciliter le debug
        console.error('❌ verifyIdToken failed:', verifyErr.message)
        // Messages courants :
        // "Wrong number of segments"  → ce n'est pas un JWT valide (accessToken envoyé par erreur)
        // "Token used too late"        → décalage d'horloge serveur
        // "Invalid audience"           → client ID manquant dans validAudiences
        return res.status(401).json({
          message: 'Invalid Google token',
          detail:  verifyErr.message,
        })
      }

      const {
        sub:   googleId,
        email,
        email_verified,
        name,
        picture,
        given_name,
      } = payload

      if (!email) {
        return res.status(400).json({ message: 'Could not retrieve email from Google' })
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

    // ── Flux 2 : accessToken + userInfo (fallback quand idToken absent) ──────
    if (accessToken && userInfo) {
      // Vérifier que le accessToken est valide en appelant tokeninfo Google
      const tokenInfoRes = await fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`
      )
      const tokenInfo = await tokenInfoRes.json()

      if (tokenInfo.error || !tokenInfo.sub) {
        console.error('❌ Invalid accessToken:', tokenInfo)
        return res.status(401).json({ message: 'Invalid Google access token' })
      }

      // Vérifier que le client_id du token appartient à notre app
      const validAudiences = [
        process.env.GOOGLE_WEB_CLIENT_ID,
        process.env.GOOGLE_ANDROID_CLIENT_ID,
        process.env.GOOGLE_IOS_CLIENT_ID,
      ].filter(Boolean)

      if (!validAudiences.includes(tokenInfo.aud)) {
        console.error('❌ accessToken audience mismatch:', tokenInfo.aud)
        return res.status(401).json({ message: 'Token audience mismatch' })
      }

      const { id: googleId, email, name, picture } = userInfo

      if (!email) {
        return res.status(400).json({ message: 'Could not retrieve email from Google' })
      }

      const { user, isNewUser } = await upsertGoogleUser({
        googleId: googleId || tokenInfo.sub,
        email,
        name,
        picture,
        email_verified: true, // Google userinfo API ne renvoie les données qu'aux comptes vérifiés
      })

      return buildResponse(res, user, isNewUser)
    }

    // ── Aucun token fourni ───────────────────────────────────────────────────
    return res.status(400).json({
      message: 'idToken or (accessToken + userInfo) is required',
    })

  } catch (err) {
    console.error('❌ Google sign-in unexpected error:', err)
    return res.status(500).json({
      message: 'Server error during Google sign-in',
      error:   err.message,
    })
  }
}
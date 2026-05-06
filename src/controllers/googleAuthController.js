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
//
// Retourne :
//   { user, isNewUser, isScheduledForDeletion }
//
// isScheduledForDeletion === true  →  compte trouvé mais soft-deleted
//   → NE PAS compléter la connexion
//   → retourner accountScheduledForDeletion au client
// ═══════════════════════════════════════════════════════════════════════
const upsertGoogleUser = async ({ googleId, email, name, picture, email_verified }) => {

  // ── Étape 1 : lookup normal (le pre-find hook exclut isDeleted:true) ───
  let user = await User.findOne({
    $or: [{ googleId }, { email: email.toLowerCase() }],
  })

  // ── Étape 2 : si rien trouvé, vérifier les comptes soft-deleted ────────
  // On passe isDeleted:true explicitement pour contourner le pre-find hook.
  // Miroir exact du bloc grace-period dans authController.js → login().
  if (!user) {
    const deletedUser = await User.findOne({
      $or: [{ googleId }, { email: email.toLowerCase() }],
      isDeleted: true,                      // ← bypass pre-find hook
    })

    if (deletedUser) {
      // Ne pas modifier le compte ici.
      // On laisse googleSignIn retourner accountScheduledForDeletion
      // pour que le frontend affiche la dialog de restauration.
      return { user: deletedUser, isNewUser: false, isScheduledForDeletion: true }
    }
  }

  let isNewUser = false

  if (user) {
    // ── Utilisateur actif existant : compléter les champs manquants ───────
    if (!user.googleId)                        user.googleId      = googleId
    if (!user.avatar && picture)               user.avatar        = picture
    if (!user.emailVerified && email_verified) user.emailVerified = true
    if (user.provider !== 'google')            user.provider      = 'google'
    await user.save()
  } else {
    // ── Nouvel utilisateur : créer le compte ──────────────────────────────
    isNewUser = true
    const randomPassword = await bcrypt.hash(googleId + process.env.JWT_SECRET, 10)

    // ✅ 6 mois de premium automatique dès l'inscription
    const premiumStartedAt = new Date()
    const premiumExpiresAt = new Date(premiumStartedAt)
    premiumExpiresAt.setMonth(premiumExpiresAt.getMonth() + 6)

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

      // ✅ Même logique que le register email
      subscription: {
        plan:      'premium',
        active:    true,
        expiresAt: premiumExpiresAt,
        duration:  '6months',
      },
    })

    console.log(`[SUBSCRIPTION] Google user ${user.email} granted premium until ${premiumExpiresAt.toISOString()}`)
  }

  return { user, isNewUser, isScheduledForDeletion: false }
}

// ═══════════════════════════════════════════════════════════════════════
// Helper : réponse de connexion réussie
//
// needsProfileCompletion contrôle la navigation côté client :
//   true  → Nouvel utilisateur → RegisterStep3
//   false → Utilisateur existant → Home
// ═══════════════════════════════════════════════════════════════════════
const buildResponse = (res, user, isNewUser) => {
  const token = signToken(user._id)

  const needsProfileCompletion = isNewUser ||
    (!user.hasCompletedProfile && !user.profileCompleted)

  return res.status(200).json({
    success: true,
    token,
    needsProfileCompletion,
    user: {
      id:                  user._id.toString(),
      name:                user.name,
      email:               user.email,
      avatar:              user.avatar,
      emailVerified:       user.emailVerified,
      provider:            user.provider,
      isPremium:           user.isPremium           || false,
      hasCompletedProfile: user.hasCompletedProfile || false,
      subscription: {
        plan:      user.subscription?.plan,
        active:    user.subscription?.active,
        expiresAt: user.subscription?.expiresAt,
      },
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════
// Helper : réponse "compte en attente de suppression"
//
// Produit exactement le même shape JSON que authController.js → login()
// pour les comptes soft-deleted, afin que le frontend puisse réutiliser
// le même dialog de restauration sans modification.
//
// Contrat frontend :
//   1. Détecter accountScheduledForDeletion === true
//   2. Afficher la dialog de confirmation de restauration
//   3a. Utilisateur confirme → POST /api/auth/cancel-account-deletion
//       avec le token retourné → naviguer vers Home
//   3b. Utilisateur refuse   → appeler logout, rester sur l'écran de connexion
// ═══════════════════════════════════════════════════════════════════════
const buildDeletionResponse = (res, user) => {
  const token = signToken(user._id)

  const permanentDeletionAt = new Date(
    user.deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000
  )
  const daysRemaining = Math.max(
    0,
    Math.ceil((permanentDeletionAt - new Date()) / (1000 * 60 * 60 * 24))
  )

  return res.status(200).json({
    success:                     true,
    accountScheduledForDeletion: true,       // ← clé lue par le frontend
    token,
    daysRemaining,
    permanentDeletionAt,
    message: `Your account is scheduled for deletion in ${daysRemaining} day(s). You can restore it from Settings.`,
    user: {
      id:            user._id.toString(),
      name:          user.name,
      email:         user.email,
      emailVerified: user.emailVerified,
      role:          user.role,
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
// Résultats possibles :
//   needsProfileCompletion: false        → user existant  → navigate Home
//   needsProfileCompletion: true         → nouvel user    → navigate RegisterStep3
//   accountScheduledForDeletion: true    → compte supprimé → dialog restauration
// ═══════════════════════════════════════════════════════════════════════
exports.googleSignIn = async (req, res) => {
  try {
    const { idToken, accessToken, userInfo } = req.body

    // ── Flux 1 : idToken (préféré) ────────────────────────────────────────
    if (idToken) {
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
          audience: validAudiences,         // ✅ tableau — accepte Web, Android et iOS
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

      const { user, isNewUser, isScheduledForDeletion } = await upsertGoogleUser({
        googleId,
        email,
        name: name || given_name,
        picture,
        email_verified,
      })

      // ── Verrou compte supprimé ────────────────────────────────────────────
      if (isScheduledForDeletion) {
        return buildDeletionResponse(res, user)
      }

      return buildResponse(res, user, isNewUser)
    }

    // ── Flux 2 : accessToken + userInfo (fallback) ────────────────────────
    if (accessToken && userInfo) {
      const tokenInfoRes = await fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`
      )
      const tokenInfo = await tokenInfoRes.json()

      if (tokenInfo.error || !tokenInfo.sub) {
        console.error('❌ accessToken invalide:', tokenInfo)
        return res.status(401).json({ message: 'Token Google invalide' })
      }

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

      const { user, isNewUser, isScheduledForDeletion } = await upsertGoogleUser({
        googleId: googleId || tokenInfo.sub,
        email,
        name,
        picture,
        email_verified: true,
      })

      // ── Verrou compte supprimé ────────────────────────────────────────────
      if (isScheduledForDeletion) {
        return buildDeletionResponse(res, user)
      }

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
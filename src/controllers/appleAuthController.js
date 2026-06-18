// src/controllers/appleAuthController.js
const appleSignin = require('apple-signin-auth');
const jwt         = require('jsonwebtoken');
const User        = require('../models/User');

// ─── Helper: sign our own JWT (same as authController) ────────────────────────
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || '7d',
  });

// ─── Helper: build 6-month premium trial (same as register) ──────────────────
function buildTrialSubscription() {
  const premiumStartedAt  = new Date();
  const premiumExpiresAt  = new Date(premiumStartedAt);
  premiumExpiresAt.setMonth(premiumExpiresAt.getMonth() + 6);
  return {
    plan:      'premium',
    active:    true,
    expiresAt: premiumExpiresAt,
    duration:  '6months',
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
// POST /api/auth/apple
// Body: { identityToken, user? }
//   identityToken – JWT issued by Apple, sent from the device
//   user          – { email?, name? { firstName, lastName } } — ONLY on first login
exports.appleSignIn = async (req, res, next) => {
  try {
    const { identityToken, user: appleUser } = req.body;

    if (!identityToken) {
      return res.status(400).json({ success: false, message: 'identityToken is required' });
    }

    // ── 1. Verify the identity token with Apple ──────────────────────────────
let applePayload;
try {
  applePayload = await appleSignin.verifyIdToken(identityToken, {
    audience: [
      process.env.APPLE_BUNDLE_ID,                          // com.mustapha11.syni
      process.env.APPLE_CLIENT_ID,                          // com.com.mustapha11.syni.signin
    ],
    ignoreExpiration: false,
  });
} catch (verifyError) {
  console.error('[Apple Auth] Token verification failed:', verifyError.message);
  
  // ── DEBUG: decode the token to see what audience Apple actually sent ──
  const decoded = require('jsonwebtoken').decode(identityToken);
  console.error('[Apple Auth] Token payload (decoded, unverified):', JSON.stringify(decoded, null, 2));
  
  return res.status(401).json({
    success: false,
    message: 'Invalid or expired Apple identity token',
  });
}

    const appleId = applePayload.sub; // Apple's stable user identifier
    const emailFromToken = applePayload.email || null;

    // Apple only sends email/name on the VERY FIRST sign-in.
    // After that, the frontend must cache it.  We accept it from the request body.
    const emailFromBody = appleUser?.email  || null;
    const firstName     = appleUser?.name?.firstName || null;
    const lastName      = appleUser?.name?.lastName  || null;
    const email         = emailFromToken || emailFromBody || null;

    // ── 2. Look up existing user by appleId OR email ──────────────────────────
    let existingUser = await User.findOne({ appleId });

    if (!existingUser && email) {
      // Could be an existing email/google user connecting Apple for the first time
      existingUser = await User.findOne({ email: email.toLowerCase() });
    }

    // ── 3a. EXISTING USER — log them in ──────────────────────────────────────
    if (existingUser) {
      // Link appleId if not already stored
      if (!existingUser.appleId) {
        existingUser.appleId = appleId;
        await existingUser.save();
      }

      const token = signToken(existingUser._id);

      console.log(`[Apple Auth] Existing user logged in: ${existingUser.email}`);

      return res.status(200).json({
        success:    true,
        isNewUser:  false,
        token,
        user: {
          id:             existingUser._id,
          name:           existingUser.name,
          email:          existingUser.email,
          emailVerified:  existingUser.emailVerified,
          role:           existingUser.role,
          profileCompleted: existingUser.profileCompleted,
          subscription: {
            plan:      existingUser.subscription.plan,
            active:    existingUser.subscription.active,
            expiresAt: existingUser.subscription.expiresAt,
          },
        },
      });
    }

    // ── 3b. NEW USER — create account ─────────────────────────────────────────
    if (!email) {
      // Edge case: Apple hid the email (user chose "Hide My Email") and we have
      // no cached copy.  We can still create the account with a placeholder and
      // let the user supply it during profile completion.
      console.warn('[Apple Auth] No email available for new user, Apple sub:', appleId);
    }

    // Build a sensible display name
    const displayName =
      firstName && lastName ? `${firstName} ${lastName}` :
      firstName             ? firstName                   :
      email                 ? email.split('@')[0]         :
      'Apple User';

    // Capture IP / UA for consent log (mirrors register controller)
    const rawIp =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      'unknown';
    const ipAddress = rawIp === '::1' ? '127.0.0.1' : rawIp;
    const userAgent = req.headers['user-agent'] || 'unknown';

    const subscription = buildTrialSubscription();

    const newUser = await User.create({
      appleId,
      name:               displayName,
      firstName:          firstName || null,
      lastName:           lastName  || null,
      email:              email ? email.toLowerCase() : `apple_${appleId}@privaterelay.appleid.com`,
      // No password — Apple users never set one (unless they later add email login)
      password:           undefined,
      registrationMethod: 'apple',
      provider:           'apple',
      emailVerified:      true,   // Apple already verified the email
      profileCompleted:   false,
      hasCompletedProfile: false,
      dateOfBirth:        new Date('2000-01-01'), // placeholder — completed in profile step
      gender:             'other',                // placeholder
      consentLog: {
        acceptedAt: new Date(),
        ipAddress,
        userAgent,
        version: '1.0',
      },
      subscription,
    });

    const token = signToken(newUser._id);

    console.log(`[Apple Auth] New user created: ${newUser.email}, premium until ${subscription.expiresAt.toISOString()}`);

    return res.status(201).json({
      success:   true,
      isNewUser: true,
      token,
      user: {
        id:              newUser._id,
        name:            newUser.name,
        email:           newUser.email,
        emailVerified:   newUser.emailVerified,
        role:            newUser.role,
        profileCompleted: newUser.profileCompleted,
        subscription: {
          plan:      newUser.subscription.plan,
          active:    newUser.subscription.active,
          expiresAt: newUser.subscription.expiresAt,
        },
      },
    });

  } catch (err) {
    console.error('[Apple Auth] Unexpected error:', err);
    next(err);
  }
};
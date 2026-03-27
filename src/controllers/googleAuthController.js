// controllers/googleAuthController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library'); // ← ajouter ce package
const User = require('../models/User');

const client = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

exports.googleSignIn = async (req, res) => {
  try {
    const { idToken } = req.body; // ← idToken au lieu de accessToken

    if (!idToken) {
      return res.status(400).json({ message: 'idToken is required' });
    }

    // ✅ Vérification sécurisée du token avec la lib officielle Google
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_WEB_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, email_verified, name, picture, given_name } = payload;

    if (!email) {
      return res.status(400).json({ message: 'Could not retrieve email from Google' });
    }

    let user = await User.findOne({
      $or: [{ googleId }, { email: email.toLowerCase() }],
    });

    let isNewUser = false;

    if (user) {
      if (!user.googleId) user.googleId = googleId;
      if (!user.avatar && picture) user.avatar = picture;
      if (!user.emailVerified && email_verified) user.emailVerified = true;
      if (user.provider !== 'google') user.provider = 'google';
      await user.save();
    } else {
      isNewUser = true;
      const randomPassword = await bcrypt.hash(googleId + process.env.JWT_SECRET, 10);

      user = await User.create({
        googleId,
        name: name || given_name || email.split('@')[0],
        email: email.toLowerCase(),
        avatar: picture || null,
        emailVerified: true,
        provider: 'google',
        password: randomPassword,
        dateOfBirth: new Date('2000-01-01'),
        gender: 'other',
        phoneVerified: false,
      });
    }

    const token = signToken(user._id);

    res.status(200).json({
      success: true,
      token,
      needsProfileCompletion: isNewUser || !user.hasCompletedProfile,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
        provider: user.provider,
        isPremium: user.isPremium || false,
        hasCompletedProfile: user.hasCompletedProfile || false,
      },
    });
  } catch (err) {
    console.error('❌ Google sign-in error:', err);
    res.status(500).json({ message: 'Server error during Google sign-in', error: err.message });
  }
};
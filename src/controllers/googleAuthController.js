// controllers/googleAuthController.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

exports.googleSignIn = async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ message: 'accessToken is required' });
    }

    // Vérification du token avec l'API Google
    const googleRes = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!googleRes.ok) {
      return res.status(401).json({ message: 'Invalid Google access token' });
    }

    const {
      sub: googleId,
      email,
      email_verified,
      name,
      picture,
      given_name,
    } = await googleRes.json();

    if (!email) {
      return res.status(400).json({ message: 'Could not retrieve email from Google' });
    }

    // Chercher si l'utilisateur existe déjà
    let user = await User.findOne({
      $or: [{ googleId }, { email: email.toLowerCase() }],
    });

    let isNewUser = false;

    if (user) {
      // Mettre à jour les champs manquants
      if (!user.googleId) user.googleId = googleId;
      if (!user.avatar && picture) user.avatar = picture;
      if (!user.emailVerified && email_verified) user.emailVerified = true;
      if (user.provider !== 'google') user.provider = 'google';
      await user.save();
    } else {
      isNewUser = true;
      const randomPassword = await bcrypt.hash(
        googleId + process.env.JWT_SECRET,
        10
      );

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

    const needsProfileCompletion = isNewUser || !user.hasCompletedProfile;

    res.status(200).json({
      success: true,
      token,
      needsProfileCompletion,
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
    res.status(500).json({
      message: 'Server error during Google sign-in',
      error: err.message,
    });
  }
};

exports.testGoogleSetup = async (req, res) => {
  res.json({
    message: 'Google OAuth Configuration',
    config: {
      JWT_SECRET: process.env.JWT_SECRET ? '✅ Set' : '❌ Missing',
    },
  });
};
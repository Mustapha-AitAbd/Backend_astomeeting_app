// controllers/googleAuthController.js
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// ✅ FIX 1: Create separate clients for each platform
const webClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const iosClient = new OAuth2Client(process.env.GOOGLE_IOS_CLIENT_ID);
const androidClient = new OAuth2Client(process.env.GOOGLE_ANDROID_CLIENT_ID);

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

exports.googleSignIn = async (req, res) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ message: 'idToken is required' });
    }

    console.log('📥 Received idToken:', idToken.substring(0, 50) + '...');

    // ✅ FIX 2: Try verification with all configured clients
    let payload = null;
    let verificationError = null;

    // Build list of valid audiences
    const audiences = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID
    ].filter(Boolean);

    console.log('🔑 Valid audiences:', audiences);

    // Try to verify with each client
    const clients = [webClient, iosClient, androidClient].filter(c => c.clientId_);
    
    for (const client of clients) {
      try {
        const ticket = await client.verifyIdToken({
          idToken,
          audience: audiences
        });
        payload = ticket.getPayload();
        console.log('✅ Token verified successfully with client:', client.clientId_);
        break;
      } catch (error) {
        verificationError = error;
        console.log('❌ Verification failed with client:', client.clientId_, error.message);
        continue;
      }
    }

    // If none of the clients worked
    if (!payload) {
      console.error('❌ Token verification failed with all clients:', verificationError);
      return res.status(401).json({ 
        message: 'Invalid Google token',
        error: verificationError?.message,
        hint: 'Check your Google Client IDs in .env file'
      });
    }

    // ✅ FIX 3: Extract user info from payload
    const { 
      sub: googleId, 
      email, 
      email_verified, 
      name, 
      picture,
      given_name,
      family_name
    } = payload;

    console.log('👤 Google user info:', { googleId, email, name, email_verified });

    // Check if user already exists
    let user = await User.findOne({ 
      $or: [
        { googleId },
        { email: email.toLowerCase() }
      ] 
    });

    if (user) {
      console.log('👤 Existing user found:', user.email);
      
      // ✅ FIX 4: Update user info if needed
      if (!user.googleId) {
        user.googleId = googleId;
      }
      if (!user.avatar && picture) {
        user.avatar = picture;
      }
      if (!user.emailVerified && email_verified) {
        user.emailVerified = email_verified;
      }
      if (user.provider !== 'google') {
        user.provider = 'google';
      }
      
      await user.save();
    } else {
      console.log('👤 Creating new user for:', email);
      
      // ✅ FIX 5: Create new user with proper validation
      const randomPassword = await bcrypt.hash(googleId + process.env.JWT_SECRET, 10);

      user = await User.create({
        googleId,
        name: name || given_name || email.split('@')[0],
        email: email.toLowerCase(),
        avatar: picture || null,
        emailVerified: email_verified || false,
        provider: 'google',
        password: randomPassword,
        // Add default values if your User model requires them
        dateOfBirth: new Date('2000-01-01'),
        gender: 'other',
        phoneVerified: false
      });

      console.log('✅ New user created:', user.email);
    }

    // Generate JWT token
    const token = signToken(user._id);

    // ✅ FIX 6: Return complete user object
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        emailVerified: user.emailVerified,
        provider: user.provider,
        isPremium: user.isPremium || false
      }
    });

  } catch (err) {
    console.error('❌ Google sign-in error:', err);
    res.status(500).json({ 
      message: 'Server error during Google sign-in', 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// ✅ BONUS: Add a test endpoint to verify Google OAuth setup
exports.testGoogleSetup = async (req, res) => {
  try {
    const config = {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing',
      GOOGLE_IOS_CLIENT_ID: process.env.GOOGLE_IOS_CLIENT_ID ? '✅ Set' : '❌ Missing',
      GOOGLE_ANDROID_CLIENT_ID: process.env.GOOGLE_ANDROID_CLIENT_ID ? '✅ Set' : '❌ Missing',
      JWT_SECRET: process.env.JWT_SECRET ? '✅ Set' : '❌ Missing'
    };

    res.json({
      message: 'Google OAuth Configuration Status',
      config,
      clients: {
        web: webClient.clientId_ ? '✅ Initialized' : '❌ Not initialized',
        ios: iosClient.clientId_ ? '✅ Initialized' : '❌ Not initialized',
        android: androidClient.clientId_ ? '✅ Initialized' : '❌ Not initialized'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const client = new OAuth2Client();

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

exports.googleSignIn = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'idToken is required' });

    // Vérifier avec Google (support Web + iOS)
    const ticket = await client.verifyIdToken({
      idToken,
      audience: [
        process.env.GOOGLE_CLIENT_ID,     // Web client
        process.env.GOOGLE_IOS_CLIENT_ID  // iOS client
      ]
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, email_verified, name, picture } = payload;

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      // générer un password aléatoire car password requis par schema
      const randomPassword = await bcrypt.hash(googleId + process.env.JWT_SECRET, 10);

      user = await User.create({
        googleId,
        name,
        email,
        avatar: picture,
        emailVerified: email_verified,
        provider: 'google',
        password: randomPassword
      });
    }

    const token = signToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        provider: user.provider
      }
    });
  } catch (err) {
    console.error('Google sign-in error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

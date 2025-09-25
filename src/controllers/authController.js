// src/controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const transporter = require('../config/email');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });

// Store invalidated tokens in-memory (use Redis or DB in production)
let blacklistedTokens = new Set();

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, dateOfBirth, gender } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already used' });

    const user = await User.create({ name, email, password, dateOfBirth, gender });
    const token = signToken(user._id);

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken(user._id);
    res.json({ token });
  } catch (err) {
    next(err);
  }
};

// ---------------- New functions ----------------

// Logout: invalidate the token
exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) blacklistedTokens.add(token);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Logout failed' });
  }
};

// Middleware to check if the token is blacklisted
exports.isTokenValid = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token && blacklistedTokens.has(token)) {
    return res.status(401).json({ message: 'Token invalidated' });
  }
  next();
};

// Refresh access token using refresh token
exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'Missing refresh token' });

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
      if (err) return res.status(403).json({ message: 'Invalid refresh token' });
      const accessToken = signToken(decoded.id);
      res.json({ token: accessToken });
    });
  } catch (err) {
    res.status(500).json({ message: 'Token refresh failed' });
  }
};

// Step 1: User requests password reset
exports.passwordResetRequest = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Generate a 6-digit numeric code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordCode = resetCode;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Password Reset Code',
      text: `Your password reset code is: ${resetCode}. It will expire in 1 hour.`,
    });

    res.json({ message: 'Password reset code sent to your email' });
  } catch (err) {
    next(err);
  }
};

// Step 2: User submits code + new password
exports.passwordReset = async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;

    const user = await User.findOne({
      email,
      resetPasswordCode: code,
      resetPasswordExpires: { $gt: Date.now() }, // check not expired
    });

    if (!user) return res.status(400).json({ message: 'Invalid or expired code' });

    // Update password
    user.password = newPassword;
    user.resetPasswordCode = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
};

// Verify phone (dummy SMS code logic)
exports.verifyPhone = async (req, res, next) => {
  try {
    const { code } = req.body;
    // TODO: validate code with SMS provider (Twilio, etc.)
    if (code === '1234') {
      req.user.phoneVerified = true;
      await req.user.save();
      return res.json({ message: 'Phone verified successfully' });
    }
    res.status(400).json({ message: 'Invalid code' });
  } catch (err) {
    next(err);
  }
};

// Verify email (dummy token logic)
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;
    // TODO: validate token with DB or email provider
    if (token === 'validEmailToken') {
      req.user.emailVerified = true;
      await req.user.save();
      return res.json({ message: 'Email verified successfully' });
    }
    res.status(400).json({ message: 'Invalid token' });
  } catch (err) {
    next(err);
  }
};

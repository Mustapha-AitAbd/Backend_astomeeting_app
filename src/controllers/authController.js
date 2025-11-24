// src/controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const transporter = require('../config/email');


const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '7d' });

// Store invalidated tokens in-memory (use Redis or DB in production)
let blacklistedTokens = new Set();

// ============= REGISTER WITH EMAIL VERIFICATION =============
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, dateOfBirth, gender } = req.body;
    
    // Validation de base
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already used' });

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Utiliser des valeurs par défaut si non fournies
    const userData = {
      email,
      password,
      name: name || email.split('@')[0],
      dateOfBirth: dateOfBirth || new Date('2000-01-01'),
      gender: gender || 'other',
      emailVerificationCode: verificationCode,
      emailVerificationExpires: Date.now() + 3600000, // 1 hour
      emailVerified: false
    };

    const user = await User.create(userData);
    const token = signToken(user._id);

    // Send verification email
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: user.email,
        subject: 'Verify Your Email - Syni App',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #8B3A8B;">Welcome to Syni!</h2>
            <p>Thank you for registering. Please verify your email address using the code below:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
              <h1 style="color: #8B3A8B; letter-spacing: 5px; margin: 0;">${verificationCode}</h1>
            </div>
            <p>This code will expire in 1 hour.</p>
            <p>If you didn't create an account with Syni, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">This is an automated message, please do not reply.</p>
          </div>
        `,
        text: `Welcome to Syni! Your verification code is: ${verificationCode}. This code will expire in 1 hour.`
      });

      console.log('Verification email sent to:', user.email);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Ne pas bloquer l'inscription si l'email échoue
    }

    res.status(201).json({
      token,
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email,
        emailVerified: user.emailVerified
      },
      message: 'Registration successful. Please check your email for verification code.'
    });
  } catch (err) {
    next(err);
  }
};

// ============= VERIFY EMAIL CODE =============
exports.verifyEmailCode = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'Email and code are required' });
    }

    const user = await User.findOne({
      email,
      emailVerificationCode: code,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    // Mark email as verified
    user.emailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ 
      message: 'Email verified successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified
      }
    });
  } catch (err) {
    next(err);
  }
};

// ============= RESEND VERIFICATION CODE =============
exports.resendVerificationCode = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    // Generate new code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    user.emailVerificationCode = verificationCode;
    user.emailVerificationExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send new verification email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'New Verification Code - Syni App',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8B3A8B;">Email Verification</h2>
          <p>Here is your new verification code:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #8B3A8B; letter-spacing: 5px; margin: 0;">${verificationCode}</h1>
          </div>
          <p>This code will expire in 1 hour.</p>
        </div>
      `,
      text: `Your new verification code is: ${verificationCode}`
    });

    res.json({ message: 'Verification code sent successfully' });
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
    res.json({ 
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified
      }
    });
  } catch (err) {
    next(err);
  }
};

// ---------------- Other functions ----------------

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

// Legacy verify email (kept for compatibility)
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

// ✅ NOUVELLE FONCTION - À AJOUTER ICI
exports.completeProfile = async (req, res) => {
  try {
    const { registrationMethod, firstName, lastName, age, country, city, gender } = req.body;

    if (!firstName || !lastName || !age || !country || !city || !gender) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required' 
      });
    }

    if (age < 18) {
      return res.status(400).json({ 
        success: false,
        message: 'You must be at least 18 years old' 
      });
    }

    const userId = req.user.id || req.user._id;
    const User = require('../models/User');

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          registrationMethod: registrationMethod || 'email',
          firstName,
          lastName,
          age,
          country,
          city,
          gender,
          name: `${firstName} ${lastName}`,
          profileCompleted: true
        }
      },
      { new: true, runValidators: true }
    ).select('-password -__v');

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Profile completed successfully',
      data: updatedUser
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error completing profile',
      error: error.message 
    });
  }
};
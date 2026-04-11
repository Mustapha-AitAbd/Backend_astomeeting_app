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
    const { name, email, password, dateOfBirth, gender, disclaimerAccepted } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!disclaimerAccepted) {
      return res.status(400).json({ message: 'You must accept the Terms and Conditions to register' });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already used' });

    const rawIp =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      'unknown';

    const ipAddress = rawIp === '::1' ? '127.0.0.1' : rawIp;
    const userAgent = req.headers['user-agent'] || 'unknown';

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // ── Trial: 6 months premium starting now ─────────────────────────────
    const premiumStartedAt = new Date();
    const premiumExpiresAt = new Date(premiumStartedAt);
    premiumExpiresAt.setMonth(premiumExpiresAt.getMonth() + 6);
    // ─────────────────────────────────────────────────────────────────────

    const userData = {
      email,
      password,
      name: name || email.split('@')[0],
      dateOfBirth: dateOfBirth || new Date('2000-01-01'),
      gender: gender || 'other',
      emailVerificationCode: verificationCode,
      emailVerificationExpires: Date.now() + 3600000,
      emailVerified: false,

      consentLog: {
        acceptedAt: new Date(),
        ipAddress,
        userAgent,
        version: '1.0',
      },

      // ✅ Every new user starts with 6 months of premium automatically
      subscription: {
        plan:      'premium',
        active:    true,
        expiresAt: premiumExpiresAt,
        duration:  '6months',
      },
    };

    const user = await User.create(userData);
    const token = signToken(user._id);

    console.log(`[SUBSCRIPTION] User ${user.email} granted premium until ${premiumExpiresAt.toISOString()}`);

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
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    console.log(`[CONSENT] User ${user.email} accepted T&C at ${userData.consentLog.acceptedAt.toISOString()} from IP ${ipAddress}`);

    res.status(201).json({
      token,
      user: {
        id:           user._id,
        name:         user.name,
        email:        user.email,
        emailVerified: user.emailVerified,
        subscription: {
          plan:      user.subscription.plan,
          active:    user.subscription.active,
          expiresAt: user.subscription.expiresAt,
        },
      },
      message: 'Registration successful. Please check your email for verification code.',
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

    // ── 1. Normal lookup — pre-find hook excludes isDeleted:true ───────────
    let user = await User.findOne({ email });

    // ── 2. Not found — check grace-period (soft-deleted) account ───────────
    if (!user) {
      const deletedUser = await User.findOne({
        email,
        isDeleted: true                     // explicit → bypasses pre-find hook
      });

      if (deletedUser) {
        const ok = await deletedUser.comparePassword(password);
        if (!ok) {
          return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const permanentDeletionAt = new Date(
          deletedUser.deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000
        );
        const daysRemaining = Math.max(
          0,
          Math.ceil((permanentDeletionAt - new Date()) / (1000 * 60 * 60 * 24))
        );

        const token = signToken(deletedUser._id);

        return res.json({
          success: true,                           // ← consistent flag
          accountScheduledForDeletion: true,       // ← mobile app reads this
          token,
          daysRemaining,
          permanentDeletionAt,
          message: `Your account is scheduled for deletion in ${daysRemaining} day(s). You can restore it from Settings.`,
          user: {
            id:            deletedUser._id,
            name:          deletedUser.name,
            email:         deletedUser.email,
            emailVerified: deletedUser.emailVerified,
            role:          deletedUser.role,
          }
        });
      }

      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // ── 3. Normal login ─────────────────────────────────────────────────────
    const ok = await user.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = signToken(user._id);

    // ✅ success:true added — admin dashboard and mobile app both rely on this
    res.json({
      success: true,
      token,
      user: {
        id:            user._id,
        name:          user.name,
        email:         user.email,
        emailVerified: user.emailVerified,
        role:          user.role,
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

// ✅ Middleware complet pour valider JWT + vérifier blacklist
exports.isTokenValid = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        message: 'Access denied. No token provided.' 
      });
    }

    // Extract token
    const token = authHeader.split(' ')[1];

    // ✅ Check if token is blacklisted
    if (blacklistedTokens.has(token)) {
      return res.status(401).json({ message: 'Token invalidated (logged out)' });
    }

    // ✅ Verify and decode JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // ✅ Find user and attach to request
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ✅ Attach user to request object
    req.user = user;
    req.token = token; // Optionnel: pour l'utiliser dans le logout
    next();
  } catch (error) {
    console.error('❌ Token validation error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    
    res.status(500).json({ message: 'Token validation failed' });
  }
  next();
};

// ✅ Function to add token to blacklist (for logout)
exports.blacklistToken = (token) => {
  blacklistedTokens.add(token);
  console.log(`🔒 Token blacklisted. Total: ${blacklistedTokens.size}`);
};

// ✅ Function to clear old tokens (optionnel, pour éviter de surcharger la mémoire)
exports.clearExpiredTokens = () => {
  // Cette fonction peut être appelée périodiquement pour nettoyer
  // les tokens expirés de la blacklist
  const now = Date.now() / 1000;
  blacklistedTokens.forEach((token) => {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp < now) {
        blacklistedTokens.delete(token);
      }
    } catch (err) {
      blacklistedTokens.delete(token);
    }
  });
};

// ✅ Optional: protect middleware (alias)
exports.protect = exports.isTokenValid;

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


exports.completeProfile = async (req, res) => {
  try {
    const {
      registrationMethod,
      firstName,
      lastName,
      dateOfBirth,
      country,
      city,   // ← NEW: optional city field
      gender,
    } = req.body;

    // ── Validate required fields ──────────────────────────────────────────
    if (!firstName || !lastName || !dateOfBirth || !country || !gender) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided (firstName, lastName, dateOfBirth, country, gender)',
      });
    }

    // ── Validate city if provided ─────────────────────────────────────────
    if (city !== undefined && city !== null) {
      if (typeof city !== 'string') {
        return res.status(400).json({ success: false, message: 'City must be a string' });
      }
      const trimmedCity = city.trim();
      if (trimmedCity.length > 100) {
        return res.status(400).json({ success: false, message: 'City name is too long (max 100 characters)' });
      }
    }

    // ── Parse & validate date ─────────────────────────────────────────────
    const birthDate = new Date(dateOfBirth);
    if (isNaN(birthDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date of birth format' });
    }

    const day   = birthDate.getUTCDate();
    const month = birthDate.getUTCMonth(); // 0-indexed
    const year  = birthDate.getUTCFullYear();
    const hours   = birthDate.getUTCHours();
    const minutes = birthDate.getUTCMinutes();
    const seconds = birthDate.getUTCSeconds();

    console.log('📅 Date received:', {
      original: dateOfBirth,
      parsed: birthDate,
      components: { day, month: month + 1, year, hours, minutes, seconds },
    });

    // ── Age checks ────────────────────────────────────────────────────────
    const today = new Date();
    let age = today.getFullYear() - year;
    const monthDiff = today.getMonth() - month;
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) age--;

    if (age < 18) {
      return res.status(400).json({ success: false, message: 'You must be at least 18 years old' });
    }
    if (birthDate > today) {
      return res.status(400).json({ success: false, message: 'Date of birth cannot be in the future' });
    }
    if (age > 120) {
      return res.status(400).json({ success: false, message: 'Please enter a valid date of birth' });
    }

    // ── Build the update payload ──────────────────────────────────────────
    const userId = req.user.id || req.user._id;
    const User   = require('../models/User');

    const dateToSave = new Date(dateOfBirth);

    console.log('💾 Date to save:', {
      dateToSave,
      isoString: dateToSave.toISOString(),
      day:   dateToSave.getUTCDate(),
      month: dateToSave.getUTCMonth() + 1,
      year:  dateToSave.getUTCFullYear(),
      time:  `${dateToSave.getUTCHours()}:${dateToSave.getUTCMinutes()}:${dateToSave.getUTCSeconds()}`,
    });

    // Build $set object — only include city if it was actually provided
    const updateFields = {
      registrationMethod: registrationMethod || 'email',
      firstName,
      lastName,
      dateOfBirth: dateToSave,
      country,
      gender,
      name: `${firstName} ${lastName}`,
      profileCompleted: true,
      hasCompletedProfile: true,
    };

    // ── NEW: conditionally persist city ───────────────────────────────────
    if (city !== undefined && city !== null && city.trim() !== '') {
      updateFields.city = city.trim();
    }
    // ─────────────────────────────────────────────────────────────────────

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password -__v');

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('✅ User updated:', {
      userId:         updatedUser._id,
      dateOfBirth:    updatedUser.dateOfBirth,
      dateOfBirthISO: updatedUser.dateOfBirth.toISOString(),
      country:        updatedUser.country,
      city:           updatedUser.city,   // ← NEW
      calculatedAge:  age,
    });

    return res.status(200).json({
      success: true,
      message: 'Profile completed successfully',
      data: updatedUser,
    });
  } catch (error) {
    console.error('❌ Error completing profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Error completing profile',
      error: error.message,
    });
  }
};

exports.updateUserLocation = async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;

    // ❌ AVANT — sans return, le code continue après la réponse
    // if (latitude === undefined || longitude === undefined) {
    //   res.status(400).json({ ... })   ← envoie réponse 1
    // }
    // ... code continue et envoie réponse 2 ❌

    // ✅ APRÈS — return arrête l'exécution
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ 
        success: false,
        message: 'Latitude and longitude are required' 
      });
    }

    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({   // ← return obligatoire
        success: false,
        message: 'Latitude must be between -90 and 90' 
      });
    }

    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({   // ← return obligatoire
        success: false,
        message: 'Longitude must be between -180 and 180' 
      });
    }

    const userId = req.user.id || req.user._id;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          location: {
            type: 'Point',
            coordinates: [longitude, latitude]
          }
        }
      },
      { new: true, runValidators: false }  // ← runValidators: false pour éviter le bug schéma
    ).select('-password -__v');

    if (!updatedUser) {
      return res.status(404).json({   // ← return obligatoire
        success: false,
        message: 'User not found' 
      });
    }

    // ✅ Réponse finale — une seule fois
    return res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        location: updatedUser.location
      }
    });

  } catch (error) {
    console.error('Error updating location:', error);
    
    // ✅ Vérifier que la réponse n'a pas déjà été envoyée
    if (!res.headersSent) {
      return res.status(500).json({ 
        success: false,
        message: 'Error updating location',
        error: error.message 
      });
    }
  }
};

// ============= GET USER INFO BY TOKEN =============
exports.getUserByToken = async (req, res, next) => {
  try {
    // L'utilisateur est déjà attaché à req.user par le middleware isTokenValid
    const userId = req.user.id || req.user._id;

    const user = await User.findById(userId).select('-password -__v');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching user',
      error: error.message 
    });
  }
};
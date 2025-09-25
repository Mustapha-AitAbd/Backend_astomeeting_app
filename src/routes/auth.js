// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { sendPhoneVerificationCode, verifyPhoneCode } = require('../controllers/userController');
const {
  register,
  login,
  logout,
  refresh,
  passwordResetRequest,
  passwordReset,
  verifyPhone,
  verifyEmail,
  isTokenValid,
} = require('../controllers/authController');
const { googleSignIn } = require('../controllers/googleAuthController');

// Register
router.post('/register', register);

// Login
router.post('/login', login);

// Logout
router.post('/logout', isTokenValid, logout);

// Refresh access token
router.post('/refresh', refresh);

// Password reset
router.post('/password-reset-request', passwordResetRequest);
router.post('/password-reset', passwordReset);

// Verify phone and email
router.post('/verify-phone', isTokenValid, verifyPhone);
router.post('/verify-email', isTokenValid, verifyEmail);

// Google login
router.post('/google', googleSignIn);

// Phone verification (sans middleware de token)
router.post('/send-phone-code', sendPhoneVerificationCode);
router.post('/check-phone-code', verifyPhoneCode);

module.exports = router;

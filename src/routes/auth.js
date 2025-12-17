// src/routes/auth.js
const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/auth');

// ✅ Import authController functions
const authController = require('../controllers/authController');
const { googleSignIn, testGoogleSetup } = require('../controllers/googleAuthController');

// ✅ Import phone verification functions
const { 
  sendPhoneVerificationCode, 
  verifyPhoneCode,
  resendPhoneVerificationCode 
} = require('../controllers/userController');

// Destructure authController functions
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
  verifyEmailCode,
  resendVerificationCode,
  completeProfile,
  resendPhoneVerificationCode
} = authController;

// ==================== PUBLIC ROUTES ====================
// Register
router.post('/register', register);

// Vérification d'email
router.post('/verify-email-code', verifyEmailCode);
router.post('/resend-verification-code', resendVerificationCode);

// Login
router.post('/login', login);

// Password reset
router.post('/password-reset-request', passwordResetRequest);
router.post('/password-reset', passwordReset);

// Google login
router.post('/google', googleSignIn);
router.get('/test-google-setup', testGoogleSetup);

// ==================== PROTECTED ROUTES ====================
// ✅ Complete profile (requires authentication)
router.post('/complete-profile', verifyToken, completeProfile);

// ✅ Get current user
router.get('/me', verifyToken, (req, res) => {
  try {
    if (!req.user) return res.status(404).json({ message: 'User not found' });
    res.json(req.user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Logout
router.post('/logout', isTokenValid, logout);

// Refresh access token
router.post('/refresh', refresh);

// Verify phone and email
router.post('/verify-phone', isTokenValid, verifyPhone);
router.post('/verify-email', isTokenValid, verifyEmail);

// ==================== 📱 PHONE VERIFICATION ROUTES ====================
// ✅ Send phone verification code (PROTECTED with isTokenValid)
router.post('/send-phone-code', isTokenValid, sendPhoneVerificationCode);

// ✅ Verify phone code (PROTECTED with isTokenValid)
router.post('/verify-phone-code', isTokenValid, verifyPhoneCode);

// ✅ Resend phone verification code (PROTECTED with isTokenValid)
router.post('/resend-phone-code', isTokenValid, resendPhoneVerificationCode);

module.exports = router;
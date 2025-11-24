// src/routes/auth.js
const express = require('express');
const User = require('../models/User');
const router = express.Router();
const verifyToken = require('../middlewares/auth');
const { protect } = require('../middlewares/authMiddleware');
const { sendPhoneVerificationCode, verifyPhoneCode } = require('../controllers/userController');

// ✅ IMPORTER TOUT LE MODULE POUR DEBUG
const authController = require('../controllers/authController');
const { googleSignIn, testGoogleSetup } = require('../controllers/googleAuthController');

// ✅ DEBUG : Vérifier quelles fonctions existent
console.log('🔍 AuthController functions:', Object.keys(authController));

// Destructurer les fonctions
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
  completeProfile
} = authController;

// ✅ Vérifier chaque fonction individuellement
console.log('register:', typeof register);
console.log('login:', typeof login);
console.log('completeProfile:', typeof completeProfile);
console.log('verifyEmailCode:', typeof verifyEmailCode);
console.log('resendVerificationCode:', typeof resendVerificationCode);

// Register
router.post('/register', register);

// Vérification d'email
router.post('/verify-email-code', verifyEmailCode);
router.post('/resend-verification-code', resendVerificationCode);

// Login
router.post('/login', login);

// ✅ Compléter le profil (LIGNE 35 ENVIRON)
router.post('/complete-profile', verifyToken, completeProfile);

router.get('/me', verifyToken, (req, res) => {
  try {
    if (!req.user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
    res.json(req.user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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
router.get('/test-google-setup', testGoogleSetup);

// Phone verification
router.post('/send-phone-code', sendPhoneVerificationCode);
router.post('/check-phone-code', verifyPhoneCode);

module.exports = router;
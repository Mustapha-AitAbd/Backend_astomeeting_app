// src/routes/auth.js
const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/auth');

// ✅ Import authController functions
const authController = require('../controllers/authController');
const { googleSignIn, testGoogleSetup } = require('../controllers/googleAuthController');


// Destructure authController functions
const {
  register,
  login,
  logout,
  refresh,
  passwordResetRequest,
  passwordReset,
  verifyEmail,
  isTokenValid,
  verifyEmailCode,
  resendVerificationCode,
  completeProfile,
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






// ✅ Update user location
router.post('/update-location', verifyToken, authController.updateUserLocation);

// ✅ Get user by token (alternative à /me)
router.get('/user', isTokenValid, authController.getUserByToken);

module.exports = router;
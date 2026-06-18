// src/routes/auth.js
const express = require('express');
const router  = express.Router();
const verifyToken = require('../middlewares/auth');

const authController = require('../controllers/authController');
const { googleSignIn } = require('../controllers/googleAuthController');
const { appleSignIn }  = require('../controllers/appleAuthController');  // ← NEW

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
router.post('/register',                  register);
router.post('/verify-email-code',         verifyEmailCode);
router.post('/resend-verification-code',  resendVerificationCode);
router.post('/login',                     login);
router.post('/password-reset-request',    passwordResetRequest);
router.post('/password-reset',            passwordReset);
router.post('/google',                    googleSignIn);
router.post('/apple',                     appleSignIn);          // ← NEW

// ==================== PROTECTED ROUTES ====================
router.post('/complete-profile',  verifyToken, completeProfile);

router.get('/me', verifyToken, (req, res) => {
  try {
    if (!req.user) return res.status(404).json({ message: 'User not found' });
    res.json(req.user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/logout',          isTokenValid,  logout);
router.post('/refresh',                        refresh);
router.post('/update-location', verifyToken,   authController.updateUserLocation);
router.get('/user',             isTokenValid,  authController.getUserByToken);

module.exports = router;
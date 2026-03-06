// src/routes/users.js
const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/auth');
const { upload } = require('../config/cloudinary');

const {
  getMe,
  updateMe,
  getNearbyUsers,
  getUserById,
  getAllUsers,
  addProfilePhoto,
  setMainPhoto,
  updateProfilePhoto,
  deleteProfilePhoto,
  getMyPhotos,
  getUserDetails,
  getProfile,
  updateProfile,
  // 🔗 Social links
  getSocialLinks,
  addSocialLink,
  updateSocialLink,
  deleteSocialLink,
   bulkAddSocialLinks  
} = require('../controllers/userController');

// Multer middleware helper (reusable)
const handleUpload = (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// ─────────────────────────────────────────────
//  SPECIFIC ROUTES FIRST (before /:id)
// ─────────────────────────────────────────────

// Current user
router.get('/me',      verifyToken, getMe);
router.put('/me',      verifyToken, updateMe);

// Search
router.get('/search',  verifyToken, getUserDetails);

// Nearby
router.get('/nearby',  verifyToken, getNearbyUsers);

// Profile (structured fields)
router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, updateProfile);

// ─── 🔗 Social Links ──────────────────────────
router.post('/social-links/bulk', verifyToken, bulkAddSocialLinks);
router.get   ('/social-links',          verifyToken, getSocialLinks);
router.post  ('/social-links',          verifyToken, addSocialLink);
router.put   ('/social-links/:linkId',  verifyToken, updateSocialLink);
router.delete('/social-links/:linkId',  verifyToken, deleteSocialLink);
// ──────────────────────────────────────────────

// Photos
router.get   ('/photos',                verifyToken, getMyPhotos);
router.post  ('/photos',                verifyToken, handleUpload, addProfilePhoto);
router.put   ('/photos/profile',        verifyToken, handleUpload, updateProfilePhoto);
router.put   ('/photos/:photoId/main',  verifyToken, setMainPhoto);
router.delete('/photos/:photoId',       verifyToken, deleteProfilePhoto);

// All users
router.get('/', verifyToken, getAllUsers);

// ─── ⚠️ Dynamic route LAST ────────────────────
router.get('/:id', verifyToken, getUserById);

module.exports = router;
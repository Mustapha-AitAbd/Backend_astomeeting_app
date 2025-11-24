// src/routes/users.js
const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/auth');
const { 
  getMe, 
  updateMe, 
  getNearbyUsers,  // ✅ IMPORTER CETTE FONCTION
  getUserById, 
  getAllUsers 
} = require('../controllers/userController');

// Get current user profile
router.get('/me', verifyToken, getMe);

// Update current user profile
router.put('/me', verifyToken, updateMe);

// ✅ Get nearby users (avec la fonction importée)
router.get('/nearby', verifyToken, getNearbyUsers);

// Get user by ID
router.get('/:id', verifyToken, getUserById);

// Get all users
router.get('/', verifyToken, getAllUsers);

module.exports = router;
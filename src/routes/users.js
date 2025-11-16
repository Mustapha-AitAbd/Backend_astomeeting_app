// src/routes/users.js
const express = require('express');
const router = express.Router();
const { 
  getMe, 
  updateMe, 
  getNearbyUsers,
  getUserById,      // ✅ Ajoutez cette fonction
  getAllUsers       // ✅ Ajoutez cette fonction
} = require('../controllers/userController');
const auth = require('../middlewares/auth');

// Get user's profile
router.get('/me', getMe);

// Profile update
router.put('/me', updateMe);

// Search for nearby users
router.get('/nearby', getNearbyUsers);

// ✅ GET /api/users/:id - Récupérer un utilisateur par son ID
router.get('/:id', getUserById);

// ✅ GET /api/users - Récupérer plusieurs utilisateurs
router.get('/', getAllUsers);

module.exports = router;
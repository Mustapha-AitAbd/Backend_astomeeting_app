// src/routes/users.js
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { getMe, updateMe, getNearbyUsers } = require('../controllers/userController');

// Profil de l’utilisateur connecté
router.get('/me', auth, getMe);

// Mise à jour du profil
router.put('/me', auth, updateMe);

// Rechercher des utilisateurs proches
router.get('/nearby', auth, getNearbyUsers);

module.exports = router;

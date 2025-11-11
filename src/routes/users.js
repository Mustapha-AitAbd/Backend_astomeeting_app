// src/routes/users.js
const express = require('express');
const router = express.Router();
const { getMe, updateMe, getNearbyUsers } = require('../controllers/userController');
const auth = require('../middlewares/auth');

// Get  user's profile
router.get('/me', getMe);

// Profile update
router.put('/me', updateMe);

// Search for nearby users
router.get('/nearby', getNearbyUsers);

module.exports = router;

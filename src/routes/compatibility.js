// src/routes/compatibility.js
const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/auth');
const { getCompatibilityResults, getCompatibilityWithUser  } = require('../controllers/compatibilityController');

// Route pour obtenir les résultats de compatibilité
router.get('/results', verifyToken, getCompatibilityResults);

router.get('/user/:userId', verifyToken, getCompatibilityWithUser);
module.exports = router;
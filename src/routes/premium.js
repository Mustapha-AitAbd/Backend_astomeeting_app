// src/routes/premium.js
const express = require('express');
const router = express.Router();
const checkSubscription = require('../middlewares/checkSubscription');

// Route protégée : accessible seulement aux utilisateurs "premium"
router.get('/premium-feature', checkSubscription('premium'), (req, res) => {
  res.json({ ok: true, msg: 'Accès premium accordé ✅' });
});

module.exports = router;

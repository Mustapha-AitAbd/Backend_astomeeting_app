const express = require('express');
const router = express.Router();
const { createCheckoutSession, handleWebhook } = require('../controllers/paymentController');

// ⚠️ Stripe webhook doit utiliser le raw body
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// Route pour créer la session Stripe
router.post('/create-checkout-session', createCheckoutSession);

module.exports = router;

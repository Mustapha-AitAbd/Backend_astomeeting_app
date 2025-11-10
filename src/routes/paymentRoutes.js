// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { createCheckoutSession, handleWebhook } = require('../controllers/paymentController');
const auth = require('../middlewares/auth');

router.post('/create-checkout-session', auth, createCheckoutSession);

module.exports = router;

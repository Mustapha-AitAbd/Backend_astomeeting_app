const express = require('express');
const router = express.Router();
const { 
  createCheckoutSession, 
  handleWebhook, 
  getPlans,
  createPayPalOrder,
  capturePayPalPayment,
  handlePayPalSuccess,
  getPayPalOrders
} = require('../controllers/paymentController');
const auth = require('../middlewares/auth');

// ===== STRIPE ROUTES =====
router.post('/create-checkout-session', auth, createCheckoutSession);

// ===== PAYPAL ROUTES =====
router.post('/paypal/create-order', auth, createPayPalOrder);
router.post('/paypal/capture', auth, capturePayPalPayment);
router.get('/paypal/success', handlePayPalSuccess);
router.get('/paypal/orders', auth, getPayPalOrders); // ✅ Debug route

// ===== COMMON ROUTES =====
router.get('/plans', getPlans);

module.exports = router;
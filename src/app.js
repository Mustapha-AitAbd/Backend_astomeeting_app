require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const chatRoutes = require("./routes/chatRoutes");
const friendshipRoutes = require("./routes/friendshipRoutes"); 
const paymentRouter = require('./controllers/paymentController');
const User = require('./models/User');

// === MongoDB Connection ===
connectDB();

const app = express();

// ⚠️ IMPORTANT : Declare the webhook BEFORE express.json()
app.post(
  '/api/payment/webhook',
  express.raw({ type: 'application/json' }), // raw body required by Stripe
  require('./controllers/paymentController').handleWebhook
);

// === Global middlewares ===

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// === Main routes ===
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use("/api/chat", chatRoutes);
app.use("/api/friendship", friendshipRoutes);
app.use('/api/payment', require('./routes/paymentRoutes'));
app.use('/api/premium', require('./routes/premium'));

// ✅ NOUVELLE ROUTE - Compatibilité
app.use('/api/compatibility', require('./routes/compatibility'));

// ✅ NOUVELLE ROUTE - Administration
app.use('/api/admin', require('./routes/adminRoutes'));

// === Static files ===
app.use(express.static(path.join(__dirname, 'public')));

app.get('/test-google', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test_google.html'));
});

app.get('/test-photos', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test_photos.html'));
});

app.get('/test-stripe', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test_stripe.html'));
});

app.get('/test-message', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test_message.html'));
});

app.get('/test-message2', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test_message2.html'));
});

app.get('/test_friendship.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test_friendship.html'));
});

app.get('/test_compatibility', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test_compatibility.html'));
});

app.get('/test-admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test_admin.html'));
});

// ✅ Routes pour les pages HTML de paiement
app.get('/payment-success', (req, res) => {
  console.log('📄 Serving payment-success page');
  res.sendFile(path.join(__dirname, 'public', 'payment-success.html'));
});

app.get('/payment-cancel', (req, res) => {
  console.log('📄 Serving payment-cancel page');
  res.sendFile(path.join(__dirname, 'public', 'payment-cancel.html'));
});

app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/admin-dashboard', (req, res) => {
  // The HTML page itself performs session verification client-side.
  // The real protection is the API middleware (verifyToken + isAdmin).
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});
// === Error handling middleware ===
app.use((err, req, res, next) => {
  console.error('Erreur serveur :', err);
  res.status(500).json({ message: err.message || 'Erreur serveur interne' });
});

module.exports = app;
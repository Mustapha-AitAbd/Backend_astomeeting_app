require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const chatRoutes = require("./routes/chatRoutes");
const paymentRouter = require('./controllers/paymentController');


// === MongoDB Connection ===
connectDB();

const app = express();

// ⚠️ IMPORTANT : DDeclare the webhook BEFORE express.json()
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

// ✅ Add Stripe routes
app.use('/api/payment', require('./routes/paymentRoutes'));

// ✅ Add protected premium route
app.use('/api/premium', require('./routes/premium'));



// === Static files ===
app.use(express.static(path.join(__dirname, 'public')));

app.get('/test-google', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test_google.html'));
});

// Route to test Stripe
app.get('/test-stripe', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test_stripe.html'));
});




// === Error handling middleware ===
app.use((err, req, res, next) => {
  console.error('Erreur serveur :', err);
  res.status(500).json({ message: err.message || 'Erreur serveur interne' });
});

module.exports = app;

require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const chatRoutes = require("./routes/chatRoutes");
const paymentRouter = require('./controllers/paymentController');


// === Connexion MongoDB ===
connectDB();

const app = express();

// ⚠️ IMPORTANT : Déclarer le webhook AVANT express.json()
app.post(
  '/api/payment/webhook',
  express.raw({ type: 'application/json' }), // corps brut requis par Stripe
  require('./controllers/paymentController').handleWebhook
);

// === Middlewares globaux ===
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// === Routes principales ===
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use("/api/chat", chatRoutes);

// ✅ Ajout des routes Stripe
app.use('/api/payment', require('./routes/paymentRoutes'));

// ✅ Ajout de la route premium protégée
app.use('/api/premium', require('./routes/premium'));



// === Fichiers statiques ===
app.use(express.static(path.join(__dirname, 'public')));

app.get('/test-google', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test_google.html'));
});

// Route pour tester Stripe
app.get('/test-stripe', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test_stripe.html'));
});




// === Middleware de gestion des erreurs ===
app.use((err, req, res, next) => {
  console.error('Erreur serveur :', err);
  res.status(500).json({ message: err.message || 'Erreur serveur interne' });
});

module.exports = app;

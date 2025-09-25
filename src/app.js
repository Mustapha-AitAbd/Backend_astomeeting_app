require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const chatRoutes = require("./routes/chatRoutes");

connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes principales
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use("/api/chat", chatRoutes);

// servir fichiers statiques (optionnel)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/test-google', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test_google.html'));
});

// Middleware erreur
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Erreur serveur' });
});

module.exports = app;

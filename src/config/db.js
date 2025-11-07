// src/config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Connexion simple à MongoDB (les options sont déjà intégrées par défaut)
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "MATCHMAKING", // Nom de ta base de données
    });

    console.log('✅ MongoDB connected to MATCHMAKING database');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;

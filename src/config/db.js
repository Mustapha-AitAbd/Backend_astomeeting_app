// src/config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: "MATCHMAKING", 
    });

    console.log('✅ MongoDB connected to MATCHMAKING database');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;

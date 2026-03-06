// models/PayPalOrder.js
const mongoose = require('mongoose');

const payPalOrderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  planType: {
    type: String,
    required: true,
    enum: ['1month', '3months', '6months']
  },
  duration: {
    type: Number,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'EUR'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  capturedAt: {
    type: Date
  }
});

module.exports = mongoose.model('PayPalOrder', payPalOrderSchema);
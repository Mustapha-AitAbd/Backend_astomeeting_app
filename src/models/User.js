// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Schema for photos
const PhotoSchema = new mongoose.Schema({
  url: String,
  isMain: { type: Boolean, default: false },
  uploadedAt: { type: Date, default: Date.now }
});

// Schema for user preferences
const PreferenceSchema = new mongoose.Schema({
  genderPreference: { type: String, enum: ['M', 'F', 'Both', 'Other'], default: 'Both' },
  minAge: { type: Number, default: 18 },
  maxAge: { type: Number, default: 99 },
  distanceMaxKm: { type: Number, default: 50 }
});

// Main User schema
const UserSchema = new mongoose.Schema({
  phone: { type: String },
  phoneVerified: { type: Boolean, default: false },
  phoneVerificationCode: { type: String },
  phoneVerificationExpires: { type: Date },
  googleId: { type: String },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String }, // optional if Google login
  gender: { type: String, enum: ['M', 'F', 'Other'] },
  dateOfBirth: Date,
  bio: String,
  photos: [PhotoSchema],
  preference: PreferenceSchema,
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },
  avatar: String,
  emailVerified: { type: Boolean, default: false },
  provider: { type: String, enum: ['local', 'google'], default: 'local' },
  createdAt: { type: Date, default: Date.now },
  lastActive: Date,

  // 🔑 Fields for password reset via email code
  resetPasswordCode: { type: String },
  resetPasswordExpires: { type: Date },

  subscription: {
    plan: { type: String, enum: ['free', 'premium', 'pro'], default: 'free' },
    active: { type: Boolean, default: false },
    expiresAt: { type: Date },
    stripeCustomerId: { type: String }, // optionnel si tu veux rattacher customer
  },
});

// Geospatial index
UserSchema.index({ location: '2dsphere' });

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', UserSchema);

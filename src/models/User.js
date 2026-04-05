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
  genderPreference: { type: String, enum: ['M', 'F', 'Both', 'other'], default: 'Both' },
  minAge: { type: Number, default: 18 },
  maxAge: { type: Number, default: 99 },
  distanceMaxKm: { type: Number, default: 50 }
});

const SocialLinkSchema = new mongoose.Schema({
  platform: {
    type: String,
    required: true,
    enum: ['facebook', 'instagram', 'x', 'whatsapp', 'linkedin', 'tiktok', 'snapchat', 'youtube'],
    lowercase: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function (v) {
        if (this.platform === 'whatsapp') {
          return /^\+?[1-9]\d{6,14}$/.test(v);
        }
        return /^https?:\/\/.+/.test(v);
      },
      message: props =>
        props.value.includes('whatsapp')
          ? 'WhatsApp must be a valid international phone number'
          : 'Social link must be a valid URL starting with http:// or https://'
    }
  },
  isPublic: {
    type: Boolean,
    default: true
  }
}, { _id: true, timestamps: true });

// ─── Main User schema ─────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  phone:              { type: String },
  registrationMethod: { type: String, enum: ['email', 'google', 'phone'], default: 'email' },
  firstName:          { type: String },
  lastName:           { type: String },
  bio: {
    type: String,
    maxlength: 200,
    trim: true,
    default: ""
  },
  age:     { type: Number, min: 18 },
  country: { type: String },
  city: {
    type: String,
    trim: true,
    maxlength: [100, 'City name cannot exceed 100 characters'],
    default: null,
  },
  profileCompleted:         { type: Boolean, default: false },
  hasCompletedProfile:      { type: Boolean, default: false },
  phoneVerified:            { type: Boolean, default: false },
  phoneVerificationCode:    { type: String },
  phoneVerificationExpires: { type: Date },
  googleId: { type: String },
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String },
  gender:   { type: String, enum: ['M', 'F', 'other'] },
  dateOfBirth: { type: Date, required: false },
  photos:      [PhotoSchema],
  preference:  PreferenceSchema,
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },
  consentLog: {
    acceptedAt: { type: Date,   default: null },
    ipAddress:  { type: String, default: null },
    userAgent:  { type: String, default: null },
    version:    { type: String, default: '1.0' },
  },
  avatar:                  String,
  emailVerified:           { type: Boolean, default: false },
  emailVerificationCode:   String,
  emailVerificationExpires: Date,
  provider:    { type: String, enum: ['local', 'google'], default: 'local' },
  createdAt:   { type: Date, default: Date.now },
  lastActive:  Date,
  resetPasswordCode:    { type: String },
  resetPasswordExpires: { type: Date },

  subscription: {
    plan:          { type: String, enum: ['free', 'premium'], default: 'free' },
    paymentMethod: { type: String, enum: ['stripe', 'paypal'], default: null },
    active:        { type: Boolean, default: false },
    duration:      { type: String, enum: ['1month', '3months', '6months'], default: null },
    expiresAt:     { type: Date,   default: null },
    stripeCustomerId: { type: String, default: null },
    paypalOrderId:    { type: String, default: null },
  },

  // ── Soft delete ──────────────────────────────────────────────────────────────
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date,    default: null  },

  // ── Consent withdrawal ───────────────────────────────────────────────────────
  consentWithdrawn:   { type: Boolean, default: false },
  consentWithdrawnAt: { type: Date,    default: null  },

  socialLinks: {
    type: [SocialLinkSchema],
    default: [],
    validate: {
      validator: function (links) {
        const platforms = links.map(l => l.platform);
        return platforms.length === new Set(platforms).size;
      },
      message: 'Each platform can only be added once'
    }
  },

  role: {
    type: String,
    enum: ['user', 'admin', 'superadmin'],
    default: 'user'
  },
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
UserSchema.index({ location: '2dsphere' });
// Speeds up soft-delete filtering on every query
UserSchema.index({ isDeleted: 1, createdAt: -1 });

// ─── Auto-exclude soft-deleted users from every normal query ──────────────────
// If you ever need to query deleted users explicitly (e.g. in the cron job),
// pass { isDeleted: true } or { isDeleted: { $in: [true, false] } } in your filter
// and this middleware will leave it untouched.
['find', 'findOne', 'findOneAndUpdate', 'countDocuments'].forEach(method => {
  UserSchema.pre(method, function () {
    const filter = this.getFilter();
    if (!Object.prototype.hasOwnProperty.call(filter, 'isDeleted')) {
      this.where({ isDeleted: { $ne: true } });
    }
    // If isDeleted is already in the filter (any value), leave the query untouched.
  });
});

// ─── Hash password before saving ─────────────────────────────────────────────
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Compare password method ──────────────────────────────────────────────────
UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', UserSchema);
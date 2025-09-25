// src/models/Swipe.js
const mongoose = require('mongoose');
const SwipeSchema = new mongoose.Schema({
  swiper: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  target: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, enum: ['like','dislike'], required: true },
  createdAt: { type: Date, default: Date.now }
});
SwipeSchema.index({ swiper: 1, target: 1 }, { unique: true });
module.exports = mongoose.model('Swipe', SwipeSchema);

// src/models/Match.js
const MatchSchema = new mongoose.Schema({
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // deux ids
  createdAt: { type: Date, default: Date.now }
});
MatchSchema.index({ users: 1 });
module.exports = mongoose.model('Match', MatchSchema);

// src/models/Message.js
const MessageSchema = new mongoose.Schema({
  match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Message', MessageSchema);

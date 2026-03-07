// src/middlewares/auth.js
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

const verifyToken = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ FIX: isDeleted explicit → bypasses the pre-find hook that excludes
    // soft-deleted users, so accounts in the 30-day grace period can still
    // authenticate (e.g. to call the restore endpoint).
    req.user = await User.findOne({
      _id:       decoded.id,
      isDeleted: { $in: [true, false] }
    }).select('-password');

    if (!req.user) return res.status(401).json({ message: 'User not found' });
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid' });
  }
};

module.exports = verifyToken;
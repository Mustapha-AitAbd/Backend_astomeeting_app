// src/controllers/userController.js
const User = require('../models/User');
const crypto = require('crypto');
const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);





// 📌 Retrieve the complete information of the logged-in user.
exports.getMe = async (req, res) => {
  try {
    // Retrieve the logged-in user from the token (auth middleware)
    const user = await User.findById(req.user.id).select('-password -__v');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

   // Returns all information, including subscription
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error('Error getMe:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


// Update the logged-in user's profile
exports.updateMe = async (req, res, next) => {
  try {
    const updates = req.body;
    // Disallow updating certain sensitive fields
    delete updates.password;
    delete updates.email;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({
      id: updatedUser._id,
      name: updatedUser.name,
      gender: updatedUser.gender,
      bio: updatedUser.bio,
      photos: updatedUser.photos,
      preference: updatedUser.preference,
      location: updatedUser.location,
      lastActive: updatedUser.lastActive
    });
  } catch (err) {
    next(err);
  }
};

// Search for nearby users based on geolocation and preferences
exports.getNearbyUsers = async (req, res, next) => {
  try {
    const { lat, lng, maxKm } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const maxDistance = (maxKm || 50) * 1000; 

    const nearbyUsers = await User.find({
      _id: { $ne: req.user._id }, 
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: maxDistance
        }
      }
    })
    .limit(50) // limit the number of users returned
    .select('-password -email'); 

    res.json(nearbyUsers);
  } catch (err) {
    next(err);
  }
};


// 📌 Step 1: Send verification code via SMS using Twilio
exports.sendPhoneVerificationCode = async (req, res, next) => {
  try {
    const { email, phone } = req.body;
    if (!email || !phone) {
      return res.status(400).json({ message: 'Email and phone are required' });
    }

    // Generate a random 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();

    // Save in MongoDB with 5 min expiration
    const user = await User.findOneAndUpdate(
      { email },
      {
        phone,
        phoneVerificationCode: code,
        phoneVerificationExpires: Date.now() + 5 * 60 * 1000
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found with this email' });
    }

    // Send via SMS using Twilio
    await twilio.messages.create({
      body: `Your verification code is : ${code}`,
      from: process.env.TWILIO_PHONE, // Twilio configured number
      to: phone
    });

    res.json({ message: 'Verification code sent via SMS' });
  } catch (err) {
    next(err);
  }
};

// 📌 Step 2: Code verification
exports.verifyPhoneCode = async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and code are required' });
    }

    const user = await User.findOne({ email });

    if (
      !user ||
      !user.phoneVerificationCode ||
      user.phoneVerificationCode !== code ||
      Date.now() > user.phoneVerificationExpires
    ) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    // ✅ Validation OK → activate the phone number
    user.phoneVerified = true;
    user.phoneVerificationCode = undefined;
    user.phoneVerificationExpires = undefined;
    await user.save();

    res.json({ message: 'Phone number verified successfully', phone: user.phone });
  } catch (err) {
    next(err);
  }
};
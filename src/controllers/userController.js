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

// ✅ GET /api/users/:id - Récupérer un utilisateur par son ID
exports.getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    
    console.log('📥 Fetching user:', userId);
    
    // Trouver l'utilisateur
    const user = await User.findById(userId).select('-password -__v');
    
    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    console.log('✅ User found:', user.name || user.email);
    
    // Retourner les données utilisateur
    res.status(200).json(user);
    
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching user',
      error: error.message 
    });
  }
};

// ✅ GET /api/users - Récupérer plusieurs utilisateurs
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password -__v').limit(50);
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching users' 
    });
  }
};


// ✅ AJOUTER CETTE FONCTION À LA TOUTE FIN
exports.completeProfile = async (req, res) => {
  try {
    const { 
      registrationMethod, 
      firstName, 
      lastName, 
      age, 
      country, 
      city, 
      gender 
    } = req.body;

    console.log('📝 Complete profile request:', req.body);
    console.log('👤 User from token:', req.user);

    // Validation des champs requis
    if (!firstName || !lastName || !age || !country || !city || !gender) {
      return res.status(400).json({ 
        success: false,
        message: 'All fields are required: firstName, lastName, age, country, city, gender' 
      });
    }

    // Validation de l'âge
    if (age < 18) {
      return res.status(400).json({ 
        success: false,
        message: 'You must be at least 18 years old' 
      });
    }

    // Validation du genre
    if (!['M', 'F', 'Other'].includes(gender)) {
      return res.status(400).json({ 
        success: false,
        message: 'Gender must be M, F, or Other' 
      });
    }

    // Récupérer l'ID utilisateur du token
    const userId = req.user.id || req.user._id;

    if (!userId) {
      return res.status(401).json({ 
        success: false,
        message: 'User not authenticated' 
      });
    }

    // Importer User si pas déjà fait en haut du fichier
    const User = require('../models/User');

    // Mettre à jour le profil
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          registrationMethod: registrationMethod || 'email',
          firstName,
          lastName,
          age,
          country,
          city,
          gender,
          name: `${firstName} ${lastName}`,
          profileCompleted: true
        }
      },
      { new: true, runValidators: true }
    ).select('-password -__v');

    if (!updatedUser) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    console.log('✅ Profile completed successfully for:', updatedUser.email);

    res.status(200).json({
      success: true,
      message: 'Profile completed successfully',
      data: updatedUser
    });

  } catch (error) {
    console.error('❌ Error completing profile:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error completing profile',
      error: error.message 
    });
  }
};
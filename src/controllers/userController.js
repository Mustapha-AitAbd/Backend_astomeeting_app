// src/controllers/userController.js
const User = require('../models/User');
const crypto = require('crypto');
const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);





// 📌 Récupérer les infos complètes de l'utilisateur connecté
exports.getMe = async (req, res) => {
  try {
    // Récupère l'utilisateur connecté depuis le token (middleware auth)
    const user = await User.findById(req.user.id).select('-password -__v');

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Retourne toutes les infos, y compris subscription
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error('Erreur getMe:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};


// Mettre à jour le profil de l'utilisateur connecté
exports.updateMe = async (req, res, next) => {
  try {
    const updates = req.body;
    // Interdire update de certains champs sensibles
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

// Rechercher des utilisateurs proches selon la géolocalisation et les préférences
exports.getNearbyUsers = async (req, res, next) => {
  try {
    const { lat, lng, maxKm } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const maxDistance = (maxKm || 50) * 1000; // convertir km -> m

    const nearbyUsers = await User.find({
      _id: { $ne: req.user._id }, // exclure l'utilisateur connecté
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: maxDistance
        }
      }
    })
    .limit(50) // limiter le nombre d'utilisateurs retournés
    .select('-password -email'); // ne pas renvoyer le password

    res.json(nearbyUsers);
  } catch (err) {
    next(err);
  }
};


// 📌 Étape 1 : Envoi du code par SMS via Twilio
exports.sendPhoneVerificationCode = async (req, res, next) => {
  try {
    const { email, phone } = req.body;
    if (!email || !phone) {
      return res.status(400).json({ message: 'Email and phone are required' });
    }

    // Générer un code aléatoire à 6 chiffres
    const code = crypto.randomInt(100000, 999999).toString();

    // Sauvegarder dans MongoDB avec expiration 5 min
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

    // Envoyer par SMS via Twilio
    await twilio.messages.create({
      body: `Votre code de vérification est : ${code}`,
      from: process.env.TWILIO_PHONE, // numéro Twilio configuré
      to: phone
    });

    res.json({ message: 'Verification code sent via SMS' });
  } catch (err) {
    next(err);
  }
};

// 📌 Étape 2 : Vérification du code
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

    // ✅ Validation OK → activer le numéro
    user.phoneVerified = true;
    user.phoneVerificationCode = undefined;
    user.phoneVerificationExpires = undefined;
    await user.save();

    res.json({ message: 'Phone number verified successfully', phone: user.phone });
  } catch (err) {
    next(err);
  }
};
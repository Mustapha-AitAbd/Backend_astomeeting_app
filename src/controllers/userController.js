// src/controllers/userController.js
const User = require('../models/User');
const crypto = require('crypto');
// ✅ Initialize Twilio client
const twilio = require('twilio')(
  process.env.TWILIO_SID, 
  process.env.TWILIO_AUTH_TOKEN
);

const { cloudinary } = require('../config/cloudinary');


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
    const { phone } = req.body;
    
    // ✅ Get user from token (via middleware isTokenValid)
    const userId = req.user._id;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    // ✅ Validate phone format (should start with +)
    if (!phone.startsWith('+')) {
      return res.status(400).json({ 
        message: 'Phone number must be in international format (e.g., +212612345678)' 
      });
    }

    // Generate a random 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();

    // Save in MongoDB with 5 min expiration
    const user = await User.findByIdAndUpdate(
      userId,
      {
        phone,
        phoneVerified: false, // Reset verification status
        phoneVerificationCode: code,
        phoneVerificationExpires: Date.now() + 5 * 60 * 1000 // 5 minutes
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ✅ Send via SMS using Twilio
    try {
      await twilio.messages.create({
        body: `Your verification code is: ${code}. Valid for 5 minutes.`,
        from: process.env.TWILIO_PHONE,
        to: phone
      });

      console.log(`✅ SMS sent to ${phone} for user ${user.email}`);
      
      res.json({ 
        message: 'Verification code sent via SMS',
        phone: phone.replace(/(\+\d{3})\d{6}(\d{3})/, '$1******$2') // Mask phone
      });
    } catch (twilioError) {
      console.error('❌ Twilio Error:', twilioError);
      
      // Clean up verification data if SMS fails
      user.phoneVerificationCode = undefined;
      user.phoneVerificationExpires = undefined;
      await user.save();
      
      return res.status(500).json({ 
        message: 'Failed to send SMS',
        error: twilioError.message 
      });
    }
  } catch (err) {
    console.error('❌ Error in sendPhoneVerificationCode:', err);
    next(err);
  }
};

// 📌 Step 2: Verify phone code
exports.verifyPhoneCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    
    // ✅ Get user from token (via middleware isTokenValid)
    const userId = req.user.id;

    if (!code) {
      return res.status(400).json({ message: 'Verification code is required' });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // ✅ Check if code exists and is not expired
    if (!user.phoneVerificationCode) {
      return res.status(400).json({ 
        message: 'No verification code found. Please request a new code.' 
      });
    }

    if (user.phoneVerificationCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    if (Date.now() > user.phoneVerificationExpires) {
      // Clean expired code
      user.phoneVerificationCode = undefined;
      user.phoneVerificationExpires = undefined;
      await user.save();
      
      return res.status(400).json({ 
        message: 'Verification code has expired. Please request a new code.' 
      });
    }

    // ✅ Validation OK → activate the phone number
    user.phoneVerified = true;
    user.phoneVerificationCode = undefined;
    user.phoneVerificationExpires = undefined;
    await user.save();

    console.log(`✅ Phone verified for user ${user.email}`);

    res.json({ 
      message: 'Phone number verified successfully', 
      phone: user.phone,
      phoneVerified: true
    });
  } catch (err) {
    console.error('❌ Error in verifyPhoneCode:', err);
    next(err);
  }
};

// 📌 Optional: Resend verification code
exports.resendPhoneVerificationCode = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user || !user.phone) {
      return res.status(400).json({ 
        message: 'No phone number found. Please add a phone number first.' 
      });
    }

    // Reuse the sendPhoneVerificationCode logic
    req.body.phone = user.phone;
    return exports.sendPhoneVerificationCode(req, res, next);
  } catch (err) {
    console.error('❌ Error in resendPhoneVerificationCode:', err);
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

// 📸 Ajouter une photo de profil (VERSION AMÉLIORÉE)
exports.addProfilePhoto = async (req, res) => {
  try {
    console.log('📸 addProfilePhoto called');
    console.log('👤 User from token:', req.user?.email);
    console.log('📎 File:', req.file);

    // Vérifier qu'un fichier a été uploadé
    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({ 
        success: false,
        message: 'No image file provided' 
      });
    }

    const userId = req.user.id || req.user._id;
    console.log('🔑 User ID:', userId);

    // Récupérer l'utilisateur
    const user = await User.findById(userId);
    
    if (!user) {
      console.log('❌ User not found:', userId);
      // Supprimer l'image uploadée si l'utilisateur n'existe pas
      if (req.file.filename) {
        await cloudinary.uploader.destroy(req.file.filename);
      }
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    console.log('✅ User found:', user.email);
    console.log('📷 Cloudinary URL:', req.file.path);

    // Créer l'objet photo
    const newPhoto = {
      url: req.file.path,
      isMain: user.photos.length === 0, // Première photo = photo principale
      uploadedAt: new Date()
    };

    // Ajouter la photo au tableau
    user.photos.push(newPhoto);
    await user.save();

    console.log('✅ Photo added successfully for user:', user.email);

    res.status(200).json({
      success: true,
      message: 'Photo added successfully',
      data: {
        photo: newPhoto,
        totalPhotos: user.photos.length
      }
    });

  } catch (error) {
    console.error('❌ Error adding photo:', error);
    console.error('Error stack:', error.stack);
    
    // Nettoyer l'image uploadée en cas d'erreur
    if (req.file && req.file.filename) {
      try {
        await cloudinary.uploader.destroy(req.file.filename);
        console.log('🗑️ Cleaned up uploaded file');
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Error adding photo',
      error: error.message 
    });
  }
};
// 📸 Mettre à jour la photo principale
exports.setMainPhoto = async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = req.user.id || req.user._id;

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Trouver la photo
    const photo = user.photos.id(photoId);
    
    if (!photo) {
      return res.status(404).json({ 
        success: false,
        message: 'Photo not found' 
      });
    }

    // Retirer isMain de toutes les photos
    user.photos.forEach(p => {
      p.isMain = false;
    });

    // Définir la nouvelle photo principale
    photo.isMain = true;
    await user.save();

    console.log('✅ Main photo updated for user:', user.email);

    res.status(200).json({
      success: true,
      message: 'Main photo updated successfully',
      data: {
        photoId: photo._id,
        url: photo.url
      }
    });

  } catch (error) {
    console.error('❌ Error setting main photo:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating main photo',
      error: error.message 
    });
  }
};

// 📸 Mettre à jour la photo de profil (remplace l'ancienne et devient main automatiquement)
exports.updateProfilePhoto = async (req, res) => {
  try {
    console.log('📸 updateProfilePhoto called');
    console.log('👤 User from token:', req.user?.email);
    console.log('📎 File:', req.file);

    // Vérifier qu'un fichier a été uploadé
    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({ 
        success: false,
        message: 'No image file provided' 
      });
    }

    const userId = req.user.id || req.user._id;
    console.log('🔑 User ID:', userId);

    // Récupérer l'utilisateur
    const user = await User.findById(userId);
    
    if (!user) {
      console.log('❌ User not found:', userId);
      // Supprimer l'image uploadée si l'utilisateur n'existe pas
      if (req.file.filename) {
        await cloudinary.uploader.destroy(req.file.filename);
      }
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    console.log('✅ User found:', user.email);
    console.log('📷 New Cloudinary URL:', req.file.path);

    // 🗑️ Supprimer l'ancienne photo principale de Cloudinary (si elle existe)
    const oldMainPhoto = user.photos.find(p => p.isMain);
    if (oldMainPhoto && oldMainPhoto.url) {
      try {
        // Extraire le public_id de l'URL Cloudinary
        const urlParts = oldMainPhoto.url.split('/');
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExtension.split('.')[0];
        
        await cloudinary.uploader.destroy(publicId);
        console.log('🗑️ Old main photo deleted from Cloudinary:', publicId);
      } catch (deleteError) {
        console.error('⚠️ Error deleting old photo from Cloudinary:', deleteError);
        // Continue même si la suppression échoue
      }
    }

    // ⭐ Retirer isMain de toutes les photos existantes
    user.photos.forEach(p => {
      p.isMain = false;
    });

    // ⭐ Créer la nouvelle photo principale
    const newPhoto = {
      url: req.file.path,
      isMain: true, // Toujours définir comme photo principale
      uploadedAt: new Date()
    };

    // Ajouter la nouvelle photo au tableau
    user.photos.push(newPhoto);
    await user.save();

    console.log('✅ Profile photo updated and set as main for user:', user.email);

    // Récupérer l'objet photo complet avec son _id
    const addedPhoto = user.photos[user.photos.length - 1];

    res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully',
      data: {
        _id: addedPhoto._id,
        url: addedPhoto.url,
        isMain: addedPhoto.isMain,
        uploadedAt: addedPhoto.uploadedAt,
        totalPhotos: user.photos.length
      }
    });

  } catch (error) {
    console.error('❌ Error updating profile photo:', error);
    console.error('Error stack:', error.stack);
    
    // Nettoyer l'image uploadée en cas d'erreur
    if (req.file && req.file.filename) {
      try {
        await cloudinary.uploader.destroy(req.file.filename);
        console.log('🗑️ Cleaned up uploaded file');
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError);
      }
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Error updating profile photo',
      error: error.message 
    });
  }
};

// 📸 Supprimer une photo de profil
exports.deleteProfilePhoto = async (req, res) => {
  try {
    const { photoId } = req.params;
    const userId = req.user.id || req.user._id;

    console.log('📥 DELETE request received');
    console.log('photoId:', photoId);
    console.log('userId:', userId);

    const user = await User.findById(userId);
    
    if (!user) {
      console.log('❌ User not found');
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    console.log('✅ User found:', user.email);
    console.log('📸 Total photos:', user.photos.length);

    // Trouver la photo
    const photo = user.photos.id(photoId);
    
    if (!photo) {
      console.log('❌ Photo not found with ID:', photoId);
      return res.status(404).json({ 
        success: false,
        message: 'Photo not found' 
      });
    }

    console.log('✅ Photo found:', photo.url);

    // Supprimer de Cloudinary si l'URL contient cloudinary
    if (photo.url && photo.url.includes('cloudinary')) {
      try {
        // Extraire le public_id depuis l'URL Cloudinary
        // Format: https://res.cloudinary.com/[cloud]/image/upload/v[version]/[folder]/[filename].[ext]
        const urlParts = photo.url.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        
        if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
          // Récupérer tout après 'upload/v[version]/'
          const pathAfterUpload = urlParts.slice(uploadIndex + 2).join('/');
          // Retirer l'extension
          const publicId = pathAfterUpload.replace(/\.[^/.]+$/, '');
          
          console.log('🗑️ Attempting to delete from Cloudinary:', publicId);
          const cloudinaryResult = await cloudinary.uploader.destroy(publicId);
          console.log('✅ Cloudinary delete result:', cloudinaryResult);
        }
      } catch (cloudinaryError) {
        console.error('⚠️ Warning: Could not delete from Cloudinary:', cloudinaryError.message);
        // Continuer quand même pour supprimer de la BDD
      }
    }

    // Si c'était la photo principale
    const wasMain = photo.isMain;
    
    // Supprimer la photo du tableau
    user.photos.pull(photoId);
    console.log('✅ Photo removed from array');

    // Si c'était la photo principale, définir la première photo restante comme principale
    if (wasMain && user.photos.length > 0) {
      user.photos[0].isMain = true;
      console.log('✅ New main photo set:', user.photos[0]._id);
    }

    await user.save();
    console.log('✅ User saved successfully');

    res.status(200).json({
      success: true,
      message: 'Photo deleted successfully',
      data: {
        remainingPhotos: user.photos.length,
        newMainPhoto: user.photos.length > 0 && wasMain ? user.photos[0] : null
      }
    });

  } catch (error) {
    console.error('❌ Error deleting photo:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting photo',
      error: error.message 
    });
  }
};

// 📸 Récupérer toutes les photos de l'utilisateur connecté
exports.getMyPhotos = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const user = await User.findById(userId).select('photos');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    res.status(200).json({
      success: true,
      data: {
        photos: user.photos,
        totalPhotos: user.photos.length,
        mainPhoto: user.photos.find(p => p.isMain) || null
      }
    });

  } catch (error) {
    console.error('❌ Error fetching photos:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching photos',
      error: error.message 
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      'firstName lastName bio dateOfBirth country city gender location avatar socialLinks'
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let age = null;
    if (user.dateOfBirth) {
      const today = new Date();
      const birthDate = new Date(user.dateOfBirth);
      age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    }

    res.status(200).json({
      success: true,
      data: {
        firstName:   user.firstName  || '',
        lastName:    user.lastName   || '',
        bio:         user.bio        || '',
        dateOfBirth: user.dateOfBirth || null,
        age,
        country:     user.country   || '',
        city:        user.city      || '',
        gender:      user.gender    || '',
        location:    user.location  || { type: 'Point', coordinates: [0, 0] },
        avatar:      user.avatar    || '',
        socialLinks: user.socialLinks || []   // ← added
      }
    });
  } catch (err) {
    console.error('Error getProfile:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─────────────────────────────────────────────
// 🔗 SOCIAL LINKS
// ─────────────────────────────────────────────

const PLATFORM_PATTERNS = {
  facebook:  /^https?:\/\/(www\.)?facebook\.com\/.+/i,
  instagram: /^https?:\/\/(www\.)?instagram\.com\/.+/i,
  x:         /^https?:\/\/(www\.)?(x|twitter)\.com\/.+/i,
  whatsapp:  /^\+?[1-9]\d{6,14}$/,            // international phone number
  linkedin:  /^https?:\/\/(www\.)?linkedin\.com\/.+/i,
  tiktok:    /^https?:\/\/(www\.)?tiktok\.com\/.+/i,
  snapchat:  /^https?:\/\/(www\.)?snapchat\.com\/.+/i,
  youtube:   /^https?:\/\/(www\.)?youtube\.com\/.+/i,
};

function validateSocialUrl(platform, url) {
  const pattern = PLATFORM_PATTERNS[platform];
  if (!pattern) return { valid: false, message: `Unsupported platform: ${platform}` };
  if (!pattern.test(url)) {
    return {
      valid: false,
      message: platform === 'whatsapp'
        ? 'WhatsApp requires a valid international phone number (e.g. +212612345678)'
        : `Invalid URL for ${platform}. Must match ${platform}.com format.`
    };
  }
  return { valid: true };
}

// ─── GET /api/users/social-links ────────────────
exports.getSocialLinks = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('socialLinks');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        socialLinks: user.socialLinks,
        total: user.socialLinks.length
      }
    });
  } catch (err) {
    console.error('Error getSocialLinks:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── POST /api/users/social-links ───────────────
exports.addSocialLink = async (req, res) => {
  try {
    const { platform, url, isPublic } = req.body;

    if (!platform || !url) {
      return res.status(400).json({
        success: false,
        message: 'Both platform and url are required'
      });
    }

    const normalizedPlatform = platform.toLowerCase().trim();

    // Validate URL format against platform rules
    const { valid, message } = validateSocialUrl(normalizedPlatform, url.trim());
    if (!valid) {
      return res.status(400).json({ success: false, message });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Enforce one link per platform
    const exists = user.socialLinks.some(l => l.platform === normalizedPlatform);
    if (exists) {
      return res.status(409).json({
        success: false,
        message: `A ${platform} link already exists. Use PUT to update it.`
      });
    }

    user.socialLinks.push({
      platform: normalizedPlatform,
      url: url.trim(),
      isPublic: isPublic !== undefined ? isPublic : true
    });

    await user.save();

    const newLink = user.socialLinks[user.socialLinks.length - 1];

    console.log(`✅ Social link added [${normalizedPlatform}] for user: ${user.email}`);

    res.status(201).json({
      success: true,
      message: 'Social link added successfully',
      data: newLink
    });
  } catch (err) {
    console.error('Error addSocialLink:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── PUT /api/users/social-links/:linkId ────────
exports.updateSocialLink = async (req, res) => {
  try {
    const { linkId } = req.params;
    const { url, isPublic } = req.body;

    if (!url && isPublic === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one field to update: url or isPublic'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const link = user.socialLinks.id(linkId);
    if (!link) {
      return res.status(404).json({ success: false, message: 'Social link not found' });
    }

    if (url) {
      const { valid, message } = validateSocialUrl(link.platform, url.trim());
      if (!valid) {
        return res.status(400).json({ success: false, message });
      }
      link.url = url.trim();
    }

    if (isPublic !== undefined) {
      link.isPublic = isPublic;
    }

    await user.save();

    console.log(`✅ Social link updated [${link.platform}] for user: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Social link updated successfully',
      data: link
    });
  } catch (err) {
    console.error('Error updateSocialLink:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── DELETE /api/users/social-links/:linkId ─────
exports.deleteSocialLink = async (req, res) => {
  try {
    const { linkId } = req.params;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const link = user.socialLinks.id(linkId);
    if (!link) {
      return res.status(404).json({ success: false, message: 'Social link not found' });
    }

    const deletedPlatform = link.platform;
    user.socialLinks.pull(linkId);
    await user.save();

    console.log(`✅ Social link deleted [${deletedPlatform}] for user: ${user.email}`);

    res.status(200).json({
      success: true,
      message: `${deletedPlatform} link removed successfully`,
      data: {
        remainingLinks: user.socialLinks.length
      }
    });
  } catch (err) {
    console.error('Error deleteSocialLink:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// ─── POST /api/users/social-links/bulk ──────────
exports.bulkAddSocialLinks = async (req, res) => {
  try {
    const { socialLinks } = req.body;

    // Validation : doit être un tableau non vide
    if (!Array.isArray(socialLinks) || socialLinks.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'socialLinks must be a non-empty array'
      });
    }

    // Max 8 liens (une par plateforme supportée)
    if (socialLinks.length > 8) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 8 social links allowed'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const errors   = [];
    const added    = [];
    const skipped  = [];

    for (const item of socialLinks) {
      const { platform, url, isPublic } = item;

      // Champs requis
      if (!platform || !url) {
        errors.push({ platform, message: 'platform and url are required' });
        continue;
      }

      const normalizedPlatform = platform.toLowerCase().trim();

      // Validation URL selon la plateforme
      const { valid, message } = validateSocialUrl(normalizedPlatform, url.trim());
      if (!valid) {
        errors.push({ platform: normalizedPlatform, message });
        continue;
      }

      // Vérifier si la plateforme existe déjà
      const exists = user.socialLinks.some(l => l.platform === normalizedPlatform);
      if (exists) {
        skipped.push({ 
          platform: normalizedPlatform, 
          message: 'Already exists — use PUT to update it' 
        });
        continue;
      }

      // Tout est bon → ajouter
      user.socialLinks.push({
        platform: normalizedPlatform,
        url: url.trim(),
        isPublic: isPublic !== undefined ? isPublic : true
      });

      added.push(normalizedPlatform);
    }

    await user.save();

    console.log(`✅ Bulk social links for ${user.email} — added: ${added.length}, skipped: ${skipped.length}, errors: ${errors.length}`);

    res.status(200).json({
      success: true,
      message: `${added.length} link(s) added successfully`,
      data: {
        socialLinks: user.socialLinks,  // Tous les liens mis à jour
        summary: {
          added,
          skipped,
          errors
        }
      }
    });

  } catch (err) {
    console.error('Error bulkAddSocialLinks:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// controllers/userController.js — updateProfile

exports.updateProfile = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      bio,
      dateOfBirth,
      country,
      city,       // ← already destructured in original; now properly validated & saved
      gender,
      location,
    } = req.body;

    // ── Date of birth validation ──────────────────────────────────────────
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      if (isNaN(birthDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date of birth. Expected format: YYYY-MM-DDTHH:mm:ss.sssZ',
        });
      }
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
      if (age < 18)   return res.status(400).json({ success: false, message: 'You must be at least 18 years old' });
      if (birthDate > today) return res.status(400).json({ success: false, message: 'Date of birth cannot be in the future' });
      if (age > 120)  return res.status(400).json({ success: false, message: 'Invalid date of birth (age over 120)' });
    }

    // ── Gender validation ─────────────────────────────────────────────────
    if (gender && !['M', 'F', 'Other'].includes(gender)) {
      return res.status(400).json({ success: false, message: 'Invalid gender. Use M, F or Other' });
    }

    // ── Bio validation ────────────────────────────────────────────────────
    if (bio && bio.length > 200) {
      return res.status(400).json({ success: false, message: 'Bio cannot exceed 200 characters' });
    }

    // ── City validation ───────────────────────────────────────────────────
    // City is optional; if provided it must be a non-empty string ≤ 100 chars
    if (city !== undefined && city !== null) {
      if (typeof city !== 'string') {
        return res.status(400).json({ success: false, message: 'City must be a string' });
      }
      if (city.trim().length > 100) {
        return res.status(400).json({ success: false, message: 'City name cannot exceed 100 characters' });
      }
    }

    // ── Build update payload ──────────────────────────────────────────────
    const updates = {};
    if (firstName  !== undefined) updates.firstName  = firstName.trim();
    if (lastName   !== undefined) updates.lastName   = lastName.trim();
    if (bio        !== undefined) updates.bio        = bio.trim();
    if (dateOfBirth!== undefined) updates.dateOfBirth= new Date(dateOfBirth);
    if (country    !== undefined) updates.country    = country.trim();
    if (gender     !== undefined) updates.gender     = gender;
    if (location   !== undefined) updates.location   = location;

    // ── City: save trimmed value, or explicitly clear it with null ────────
    if (city !== undefined) {
      updates.city = (city === null || city.trim() === '') ? null : city.trim();
    }

    // ── Persist ───────────────────────────────────────────────────────────
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('firstName lastName bio dateOfBirth country city gender location avatar');

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // ── Calculate age for response ────────────────────────────────────────
    let age = null;
    if (updatedUser.dateOfBirth) {
      const today    = new Date();
      const birthDate = new Date(updatedUser.dateOfBirth);
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        firstName:   updatedUser.firstName   || '',
        lastName:    updatedUser.lastName    || '',
        bio:         updatedUser.bio         || '',
        dateOfBirth: updatedUser.dateOfBirth || null,
        age,
        country:     updatedUser.country     || '',
        city:        updatedUser.city        || '',   // ← included in response
        gender:      updatedUser.gender      || '',
        location:    updatedUser.location    || { type: 'Point', coordinates: [0, 0] },
        avatar:      updatedUser.avatar      || '',
      },
    });
  } catch (err) {
    console.error('Error updateProfile:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
// 📌 Get user details by name, id, or email
exports.getUserDetails = async (req, res) => {
  try {
    const { search } = req.query;

    if (!search) {
      return res.status(400).json({ 
        success: false,
        message: 'Veuillez fournir un terme de recherche (nom, id ou email)' 
      });
    }

    let user;

    // 1. Check if search is a valid MongoDB ObjectId
    if (search.match(/^[0-9a-fA-F]{24}$/)) {
      user = await User.findById(search).select('-password -__v -emailVerificationCode -phoneVerificationCode -resetPasswordCode');
    }

    // 2. If not found by ID, search by email
    if (!user && search.includes('@')) {
      user = await User.findOne({ email: search.toLowerCase() })
        .select('-password -__v -emailVerificationCode -phoneVerificationCode -resetPasswordCode');
    }

    // 3. If still not found, search by name (firstName, lastName, or name)
    if (!user) {
      user = await User.findOne({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } }
        ]
      }).select('-password -__v -emailVerificationCode -phoneVerificationCode -resetPasswordCode');
    }

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'Utilisateur non trouvé' 
      });
    }

    // Format the response with all details
    const userDetails = {
      id: user._id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      age: user.age,
      country: user.country,
      city: user.city,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      bio: user.bio,
      avatar: user.avatar,
      photos: user.photos,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      emailVerified: user.emailVerified,
      registrationMethod: user.registrationMethod,
      profileCompleted: user.profileCompleted,
      subscription: user.subscription,
      location: user.location,
      preference: user.preference,
      provider: user.provider,
      createdAt: user.createdAt,
      lastActive: user.lastActive
    };

    res.status(200).json({
      success: true,
      data: userDetails
    });

  } catch (err) {
    console.error('Error getUserDetails:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur' 
    });
  }
};
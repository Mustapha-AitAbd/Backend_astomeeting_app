const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware pour protéger les routes admin
 * Vérifie que l'utilisateur est authentifié et a les droits admin
 */
module.exports = async (req, res, next) => {
  try {
    // 1. Récupérer le token depuis l'en-tête Authorization
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentification requise. Token manquant.' 
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // 2. Vérifier et décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Récupérer l'utilisateur depuis la base de données
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    // 4. Vérifier si l'utilisateur a les droits admin
    // Option 1 : Ajouter un champ 'isAdmin' ou 'role' dans votre modèle User
    if (!user.isAdmin && user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Accès refusé. Droits administrateur requis.' 
      });
    }

    // 5. Attacher l'utilisateur à la requête pour utilisation ultérieure
    req.admin = user;
    req.userId = user._id;

    next();
  } catch (error) {
    console.error('Erreur authAdmin:', error);

    // Gérer les différents types d'erreurs JWT
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token invalide' 
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expiré. Veuillez vous reconnecter.' 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de l\'authentification' 
    });
  }
};

/**
 * IMPORTANT : Pour utiliser ce middleware, vous devez ajouter un champ 'isAdmin' ou 'role' 
 * dans votre modèle User :
 * 
 * Dans models/User.js, ajoutez :
 * 
 * isAdmin: { 
 *   type: Boolean, 
 *   default: false 
 * },
 * 
 * OU
 * 
 * role: { 
 *   type: String, 
 *   enum: ['user', 'admin', 'superadmin'], 
 *   default: 'user' 
 * },
 * 
 * Ensuite, dans routes/admin.js, importez et utilisez le middleware :
 * 
 * const authAdmin = require('../middleware/authAdmin');
 * 
 * // Protéger toutes les routes admin
 * router.use(authAdmin);
 * 
 * // Ou protéger des routes spécifiques
 * router.delete('/users/:id', authAdmin, adminController.deleteUser);
 */
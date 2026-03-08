// src/middlewares/auth.js  — VERSION FINALE
// ─────────────────────────────────────────────────────────────────────────────
// Deux corrections vs la version précédente:
//
// 1. decoded.id || decoded._id  → couvre les deux conventions de signToken
//
// 2. On ne passe PLUS isDeleted dans la query de verifyToken.
//    Maintenant que le pre-find hook est corrigé (voir UserModel_prefind_fix.js),
//    une simple findById suffit pour les admins normaux.
//    Pour les comptes en grace period (isDeleted:true), le hook corrigé ne les
//    exclut PAS car verifyToken ne passe pas isDeleted → le hook ajoute
//    { isDeleted: { $ne: true } } → les grace-period users sont exclus ici.
//
//    MAIS : pour les grace-period users, le LOGIN a déjà validé et émis
//    un token. Ils n'ont besoin de verifyToken que pour /account/restore.
//    On gère ce cas avec une second lookup explicite si le premier échoue.
// ─────────────────────────────────────────────────────────────────────────────

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

    // Couvre decoded.id ET decoded._id selon la convention de signToken
    const userId = decoded.id || decoded._id;
    if (!userId) {
      return res.status(401).json({ message: 'Token invalid: missing user id' });
    }

    // ── Premier essai : lookup normal (pre-find hook exclut isDeleted:true) ──
    // Ceci fonctionne pour 100% des users normaux ET des admins.
    let user = await User.findById(userId).select('-password');

    // ── Deuxième essai : si null, l'user est peut-être en grace period ───────
    // On passe isDeleted explicitement → le hook ne s'applique pas (corrigé).
    if (!user) {
      user = await User.findOne({
        _id:       userId,
        isDeleted: true
      }).select('-password');
    }

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid' });
  }
};

module.exports = verifyToken;
// src/middlewares/checkSubscription.js
const User = require('../models/User');

module.exports = (requiredPlan = 'premium') => async (req, res, next) => {
  try {
    const userId = req.header('x-user-id') || req.body.userId || (req.user && req.user.id);
    if (!userId) return res.status(401).json({ message: 'Utilisateur requis' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    const sub = user.subscription || {};
    const active = sub.active && sub.expiresAt && new Date(sub.expiresAt) > new Date();

    if (!active || (sub.plan !== requiredPlan && requiredPlan === 'premium')) {
      return res.status(403).json({ message: 'Abonnement requis pour accéder à cette ressource' });
    }

    // attach user to req if besoin
    req.currentUser = user;
    next();
  } catch (err) {
    console.error('checkSubscription error:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

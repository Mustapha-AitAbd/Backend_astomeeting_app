const express   = require('express');
const router    = express.Router();
const verifyToken = require('../middlewares/auth');
const isAdmin   = require('../middlewares/isAdmin');   // create below if missing
const adminController = require('../controllers/adminController');

router.use(verifyToken, isAdmin);  // protect all admin routes

// ==================== ROUTES USERS ====================

// GET /api/admin/users - Liste tous les utilisateurs avec pagination, filtres et recherche
router.get('/users', adminController.getAllUsers);

// GET /api/admin/users/:id - Récupère un utilisateur par ID (avec infos Stripe)
router.get('/users/:id', adminController.getUserById);

// POST /api/admin/users - Crée un nouvel utilisateur
router.post('/users', adminController.createUser);

// PUT /api/admin/users/:id - Met à jour un utilisateur
router.put('/users/:id', adminController.updateUser);

// DELETE /api/admin/users/:id - Supprime un utilisateur (+ annulation Stripe)
router.delete('/users/:id', adminController.deleteUser);

// ==================== GESTION DES COMPTES ====================

// PUT /api/admin/users/:id/password - Change le mot de passe d'un utilisateur
router.put('/users/:id/password', adminController.updateUserPassword);

// PUT /api/admin/users/:id/verify-email - Vérifie manuellement l'email
router.put('/users/:id/verify-email', adminController.verifyUserEmail);



// POST /api/admin/users/bulk-delete - Supprime plusieurs utilisateurs
router.post('/users/bulk-delete', adminController.bulkDeleteUsers);

// ==================== GESTION DES ABONNEMENTS ====================

// PUT /api/admin/users/:id/subscription - Met à jour l'abonnement
router.put('/users/:id/subscription', adminController.updateUserSubscription);

// POST /api/admin/users/:id/cancel-subscription - Annule l'abonnement Stripe
router.post('/users/:id/cancel-subscription', adminController.cancelSubscription);

// ==================== GESTION DES PHOTOS ====================

// GET /api/admin/users/:id/photos - Récupère les photos d'un utilisateur
router.get('/users/:id/photos', adminController.getUserPhotos);

// DELETE /api/admin/users/:id/photos/:photoId - Supprime une photo
router.delete('/users/:id/photos/:photoId', adminController.deleteUserPhoto);

router.delete('/users/:id/photos/:photoId', adminController.deleteUserPhoto);  // ← ADD

// ==================== GESTION DES PRÉFÉRENCES ====================

// GET /api/admin/users/:id/preferences - Récupère les préférences
router.get('/users/:id/preferences', adminController.getUserPreferences);

// PUT /api/admin/users/:id/preferences - Met à jour les préférences
router.put('/users/:id/preferences', adminController.updateUserPreferences);

// Image moderation proxy
router.post('/moderate-image',  adminController.moderateImage);  // ← ADD

// ==================== PAIEMENTS & FACTURES ====================

// GET /api/admin/users/:id/payments - Historique des paiements d'un utilisateur
router.get('/users/:id/payments', adminController.getPaymentHistory);

// GET /api/admin/invoices - Liste toutes les factures (tous utilisateurs)
router.get('/invoices', adminController.getInvoices);

// ==================== STATISTIQUES & RAPPORTS ====================

// GET /api/admin/statistics - Statistiques globales détaillées
router.get('/statistics', adminController.getStatistics);

// GET /api/admin/search/advanced - Recherche avancée avec filtres multiples
router.get('/search/advanced', adminController.advancedSearch);

// GET /api/admin/export - Exporte les données utilisateurs (JSON ou CSV)
router.get('/export', adminController.exportUsers);

router.get('/overview-stats', adminController.getOverviewStats);

module.exports = router;
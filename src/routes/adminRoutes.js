// src/routes/adminRoutes.js
const express         = require('express');
const router          = express.Router();
const verifyToken     = require('../middlewares/auth');
const isAdmin         = require('../middlewares/isAdmin');
const adminController = require('../controllers/adminController');

// ─────────────────────────────────────────────────────────────────────────────
// SELF-SERVICE routes — any authenticated user (verifyToken only, NO isAdmin)
// Must be declared BEFORE router.use(verifyToken, isAdmin) so the isAdmin
// middleware does not block regular users.
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/account',          verifyToken, adminController.requestAccountDeletion);
router.post('/account/restore',    verifyToken, adminController.cancelAccountDeletion);
router.get('/account/status',      verifyToken, adminController.getDeletionStatus);
router.get('/my-export',           verifyToken, adminController.exportMyData);       // /api/admin/my-export
router.post('/withdraw-consent',   verifyToken, adminController.withdrawConsent);


// ── NEW ──────────────────────────────────────────────────────────────────────
router.get('/consent-status',          verifyToken, adminController.getConsentStatus);
router.post('/cancel-withdraw-consent', verifyToken, adminController.cancelWithdrawConsent);
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN-ONLY routes — all routes below require verifyToken + isAdmin
// ─────────────────────────────────────────────────────────────────────────────
router.use(verifyToken, isAdmin);

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users',                    adminController.getAllUsers);
router.get('/users/:id',                adminController.getUserById);
router.post('/users',                   adminController.createUser);
router.put('/users/:id',                adminController.updateUser);
router.delete('/users/:id',             adminController.deleteUser);

// ── Account management ────────────────────────────────────────────────────────
router.put('/users/:id/password',       adminController.updateUserPassword);
router.put('/users/:id/verify-email',   adminController.verifyUserEmail);
router.post('/users/bulk-delete',       adminController.bulkDeleteUsers);

// ── Subscriptions ─────────────────────────────────────────────────────────────
router.put('/users/:id/subscription',         adminController.updateUserSubscription);
router.post('/users/:id/cancel-subscription', adminController.cancelSubscription);

// ── Photos ────────────────────────────────────────────────────────────────────
router.get('/users/:id/photos',               adminController.getUserPhotos);
router.delete('/users/:id/photos/:photoId',   adminController.deleteUserPhoto);

// ── Preferences ───────────────────────────────────────────────────────────────
router.get('/users/:id/preferences',    adminController.getUserPreferences);
router.put('/users/:id/preferences',    adminController.updateUserPreferences);

// ── Moderation ────────────────────────────────────────────────────────────────
router.post('/moderate-image',          adminController.moderateImage);

// ── Payments ──────────────────────────────────────────────────────────────────
router.get('/users/:id/payments',       adminController.getPaymentHistory);
router.get('/invoices',                 adminController.getInvoices);

// ── Stats & reports ───────────────────────────────────────────────────────────
router.get('/statistics',               adminController.getStatistics);
router.get('/search/advanced',          adminController.advancedSearch);
router.get('/export',                   adminController.exportUsers);   // admin bulk export
router.get('/overview-stats',           adminController.getOverviewStats);

module.exports = router;
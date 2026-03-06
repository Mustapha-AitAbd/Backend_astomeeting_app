const express = require("express");
const router = express.Router();
const friendshipController = require("../controllers/friendshipController");
const authMiddleware = require("../middlewares/auth"); // ✅ À créer si pas existant

// Toutes les routes nécessitent l'authentification
router.use(authMiddleware);

// Envoyer une invitation
router.post("/request", friendshipController.sendFriendRequest);

// Accepter une invitation
router.post("/accept", friendshipController.acceptFriendRequest);

// Refuser/Supprimer une invitation
router.post("/decline", friendshipController.declineFriendRequest);



// Récupérer les invitations reçues
router.get("/requests/received", friendshipController.getReceivedRequests);

// Récupérer les invitations envoyées
router.get("/requests/sent", friendshipController.getSentRequests);

// Récupérer la liste des amis
router.get("/friends", friendshipController.getFriends);

module.exports = router;
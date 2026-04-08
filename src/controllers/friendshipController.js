const Friendship = require("../models/Friendship");
const User = require("../models/User");

// ✅ Envoyer une invitation
exports.sendFriendRequest = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const requesterId = req.user.id; // Depuis le middleware auth

    if (requesterId === recipientId) {
      return res.status(400).json({ message: "Vous ne pouvez pas vous ajouter vous-même" });
    }

    // Vérifier si le destinataire existe
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Vérifier si une demande existe déjà
    const existingRequest = await Friendship.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId }
      ]
    });

      if (existingRequest) {
        if (existingRequest.status === "accepted") {
          return res.status(400).json({ message: "You are already friends" });
        }

        if (existingRequest.status === "pending") {
          // 🔥 RENVOYER L'OBJET AU LIEU D'ERREUR
          return res.status(200).json({ 
            message: "Already exists",
            friendship: existingRequest
          });
        }
      }

    // Créer la nouvelle demande
    const friendship = new Friendship({
      requester: requesterId,
      recipient: recipientId,
      status: "pending"
    });

    await friendship.save();

    // Peupler les données pour l'émission socket
    await friendship.populate('requester', 'name email avatar');
    await friendship.populate('recipient', 'name email avatar');

    // ✅ Émettre l'invitation en temps réel via Socket.IO
    const io = req.app.get("io");
    if (io) {
      io.emit("newFriendRequest", {
        friendship,
        recipientId: recipientId
      });
    }

    res.status(201).json({ 
      message: "Invitation envoyée avec succès", 
      friendship 
    });
  } catch (err) {
    console.error("Error sendFriendRequest:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Accepter une invitation
exports.acceptFriendRequest = async (req, res) => {
  try {
    const { friendshipId } = req.body;
    const userId = req.user.id;

    const friendship = await Friendship.findById(friendshipId)
      .populate('requester', 'name email avatar')
      .populate('recipient', 'name email avatar');

    if (!friendship) {
      return res.status(404).json({ message: "Invitation non trouvée" });
    }

    // Vérifier que c'est bien le destinataire qui accepte
    if (friendship.recipient._id.toString() !== userId) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    if (friendship.status !== "pending") {
      return res.status(400).json({ message: "Cette invitation a déjà été traitée" });
    }

    friendship.status = "accepted";
    await friendship.save();

    // ✅ Notifier les deux utilisateurs en temps réel
    const io = req.app.get("io");
    if (io) {
      io.emit("friendRequestAccepted", {
        friendship,
        requesterId: friendship.requester._id,
        recipientId: friendship.recipient._id
      });
    }

    res.status(200).json({ 
      message: "Invitation acceptée", 
      friendship 
    });
  } catch (err) {
    console.error("Error acceptFriendRequest:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Refuser/Supprimer une invitation
exports.declineFriendRequest = async (req, res) => {
  try {
    const { friendshipId } = req.body;
    const userId = req.user.id;

    const friendship = await Friendship.findById(friendshipId);

    if (!friendship) {
      return res.status(404).json({ message: "Invitation non trouvée" });
    }

    // Vérifier que l'utilisateur est impliqué dans cette demande
    const isRecipient = friendship.recipient.toString() === userId;
    const isRequester = friendship.requester.toString() === userId;

    if (!isRecipient && !isRequester) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    await Friendship.findByIdAndDelete(friendshipId);

    // ✅ Notifier en temps réel
    const io = req.app.get("io");
    if (io) {
      io.emit("friendRequestDeclined", {
        friendshipId,
        requesterId: friendship.requester,
        recipientId: friendship.recipient
      });
    }

    res.status(200).json({ message: "Invitation supprimée" });
  } catch (err) {
    console.error("Error declineFriendRequest:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Récupérer toutes les invitations reçues (pending)
exports.getReceivedRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    const requests = await Friendship.find({
      recipient: userId,
      status: "pending"
    }).populate('requester', 'name email avatar');

    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Récupérer toutes les invitations envoyées (pending)
exports.getSentRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    const requests = await Friendship.find({
      requester: userId,
      status: "pending"
    }).populate('recipient', 'name email avatar');

    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Récupérer la liste des amis (accepted)
exports.getFriends = async (req, res) => {
  try {
    const userId = req.user.id;

    const friendships = await Friendship.find({
      $or: [
        { requester: userId, status: "accepted" },
        { recipient: userId, status: "accepted" }
      ]
    })
    .populate('requester', 'name email avatar')
    .populate('recipient', 'name email avatar');

    // Extraire les amis
    const friends = friendships.map(f => {
      return f.requester._id.toString() === userId 
        ? f.recipient 
        : f.requester;
    });

    res.status(200).json(friends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
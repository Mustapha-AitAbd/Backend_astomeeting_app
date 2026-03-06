const mongoose = require("mongoose");

const FriendshipSchema = new mongoose.Schema({
  requester: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  recipient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  status: { 
    type: String, 
    enum: ["pending", "accepted", "declined", "blocked"], 
    default: "pending" 
  },
}, { timestamps: true });

// Index pour éviter les doublons
FriendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Méthode pour vérifier si deux users sont amis
FriendshipSchema.statics.areFriends = async function(userId1, userId2) {
  const friendship = await this.findOne({
    $or: [
      { requester: userId1, recipient: userId2, status: "accepted" },
      { requester: userId2, recipient: userId1, status: "accepted" }
    ]
  });
  return !!friendship;
};

module.exports = mongoose.model("Friendship", FriendshipSchema);
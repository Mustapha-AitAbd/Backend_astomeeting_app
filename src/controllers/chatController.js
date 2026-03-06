const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Friendship = require("../models/Friendship"); // ✅ AJOUTER

// ✅ Créer une conversation SEULEMENT si amis
exports.createConversation = async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

    // ✅ Vérifier s'ils sont amis
    const areFriends = await Friendship.areFriends(senderId, receiverId);
    if (!areFriends) {
      return res.status(403).json({ 
        message: "Vous devez être amis pour démarrer une conversation" 
      });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] }
    });

    if (!conversation) {
      conversation = new Conversation({ participants: [senderId, receiverId] });
      await conversation.save();
    }

    res.status(200).json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Retrieve all conversations of a user
exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: { $in: [req.params.userId] }
    }).populate("lastMessage");
    res.status(200).json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ saveMessage - vérifier l'amitié
exports.saveMessage = async ({ conversationId, senderId, receiverId, text }) => {
  // ✅ Vérifier s'ils sont amis
  const areFriends = await Friendship.areFriends(senderId, receiverId);
  if (!areFriends) {
    throw new Error("Vous devez être amis pour envoyer un message");
  }

  const message = new Message({ conversationId, sender: senderId, receiver: receiverId, text });
  await message.save();
  await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });
  return message;
};

// sendMessage via REST
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, senderId, receiverId, text } = req.body;
    const message = await exports.saveMessage({ conversationId, senderId, receiverId, text });

    const io = req.app && req.app.get && req.app.get("io");
    if (io) {
      io.to(String(conversationId)).emit("newMessage", message);
    }

    res.status(200).json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Retrieve all messages from a conversation
exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find({ conversationId: req.params.conversationId });
    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Update the status of a message
exports.updateMessageStatus = async (req, res) => {
  try {
    const { messageId, status } = req.body;
    const message = await Message.findByIdAndUpdate(messageId, { status }, { new: true });
    res.status(200).json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
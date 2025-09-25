const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

// ✅ Créer une conversation (si elle n'existe pas déjà)
exports.createConversation = async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;

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

// ✅ Récupérer toutes les conversations d'un utilisateur
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

// saveMessage (inchangé)
exports.saveMessage = async ({ conversationId, senderId, receiverId, text }) => {
  const message = new Message({ conversationId, sender: senderId, receiver: receiverId, text });
  await message.save();
  await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });
  return message;
};

// sendMessage via REST - émet aussi l'événement si io est disponible
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

// ✅ Récupérer tous les messages d'une conversation
exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find({ conversationId: req.params.conversationId });
    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Mettre à jour le statut d'un message (ex: lu)
exports.updateMessageStatus = async (req, res) => {
  try {
    const { messageId, status } = req.body;
    const message = await Message.findByIdAndUpdate(messageId, { status }, { new: true });
    res.status(200).json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

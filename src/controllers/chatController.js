const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

// ✅ Create a conversation (if it doesn't already exist)
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

// saveMessage (unchanged)
exports.saveMessage = async ({ conversationId, senderId, receiverId, text }) => {
  const message = new Message({ conversationId, sender: senderId, receiver: receiverId, text });
  await message.save();
  await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });
  return message;
};

// sendMessage via REST - also emits the event if io is available
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

// ✅ Update the status of a message (e.g., read)
exports.updateMessageStatus = async (req, res) => {
  try {
    const { messageId, status } = req.body;
    const message = await Message.findByIdAndUpdate(messageId, { status }, { new: true });
    res.status(200).json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

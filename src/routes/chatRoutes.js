const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");

// Conversations
router.post("/conversation", chatController.createConversation);
router.get("/conversation/:userId", chatController.getConversations);

// Messages
router.post("/message", chatController.sendMessage);
router.get("/message/:conversationId", chatController.getMessages);
router.put("/message/status", chatController.updateMessageStatus);

module.exports = router;

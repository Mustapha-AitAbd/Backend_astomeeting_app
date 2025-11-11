const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const chatController = require("./controllers/chatController");
const Message = require("./models/Message");
const Conversation = require("./models/Conversation");

const PORT = process.env.PORT || 5000;

// Create an HTTP server using Express
const server = http.createServer(app);

// Attache Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Expose io to controllers
app.set("io", io);

// Socket.IO management
io.on("connection", (socket) => {
  console.log("🔌 Socket connecté:", socket.id);

  socket.on("joinConversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`${socket.id} rejoint room ${conversationId}`);
  });

  socket.on("sendMessage", async (data) => {
    try {
      if (data._id) {
        await Conversation.findByIdAndUpdate(data.conversationId, { lastMessage: data._id });
        io.to(String(data.conversationId)).emit("newMessage", data);
        return;
      }

      const message = await chatController.saveMessage({
        conversationId: data.conversationId,
        senderId: data.senderId || data.sender,
        receiverId: data.receiverId || data.receiver,
        text: data.text,
      });

      io.to(String(message.conversationId)).emit("newMessage", message);
    } catch (err) {
      console.error("socket sendMessage error:", err.message);
    }
  });

  socket.on("messageRead", async ({ messageId, conversationId }) => {
    try {
      const updated = await Message.findByIdAndUpdate(messageId, { status: "read" }, { new: true });
      if (updated) io.to(String(conversationId)).emit("messageUpdated", updated);
    } catch (err) {
      console.error("error messageRead:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const chatController = require("./controllers/chatController");
const Message = require("./models/Message");
const Conversation = require("./models/Conversation");
const Friendship = require("./models/Friendship"); // ✅ AJOUTER

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🔌 Socket connecté:", socket.id);

  // ✅ User comes online
  socket.on("userOnline", (userId) => {
    onlineUsers.set(userId.toString(), socket.id);
    console.log(`👤 User ${userId} is now online. Total online: ${onlineUsers.size}`);
    io.emit("userStatusChanged", { userId, isOnline: true });
  });

  // ✅ Check if a user is online
  socket.on("checkUserStatus", (userId, callback) => {
    const isOnline = onlineUsers.has(userId.toString());
    callback({ userId, isOnline });
  });

  socket.on("joinConversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`${socket.id} rejoint room ${conversationId}`);
  });

  // ✅ NOUVEAU : Joindre une room pour recevoir les invitations
  socket.on("joinUserRoom", (userId) => {
    socket.join(`user_${userId}`);
    console.log(`${socket.id} rejoint room user_${userId}`);
  });

  socket.on("sendMessage", async (data) => {
    try {
      // ✅ Vérifier s'ils sont amis avant d'envoyer
      const senderId = data.senderId || data.sender;
      const receiverId = data.receiverId || data.receiver;
      
      const areFriends = await Friendship.areFriends(senderId, receiverId);
      if (!areFriends) {
        socket.emit("error", { message: "Vous devez être amis pour communiquer" });
        return;
      }

      if (data._id) {
        await Conversation.findByIdAndUpdate(data.conversationId, { lastMessage: data._id });
        
        const isReceiverOnline = onlineUsers.has(receiverId.toString());
        
        if (isReceiverOnline) {
          const updatedMessage = await Message.findByIdAndUpdate(
            data._id, 
            { status: "delivered" }, 
            { new: true }
          );
          io.to(String(data.conversationId)).emit("messageUpdated", updatedMessage);
        }
        
        io.to(String(data.conversationId)).emit("newMessage", data);
        return;
      }

      const message = await chatController.saveMessage({
        conversationId: data.conversationId,
        senderId: senderId,
        receiverId: receiverId,
        text: data.text,
      });

      const isReceiverOnline = onlineUsers.has(receiverId.toString());
      
      if (isReceiverOnline) {
        const updatedMessage = await Message.findByIdAndUpdate(
          message._id, 
          { status: "delivered" }, 
          { new: true }
        );
        io.to(String(message.conversationId)).emit("newMessage", updatedMessage);
      } else {
        io.to(String(message.conversationId)).emit("newMessage", message);
      }

    } catch (err) {
      console.error("socket sendMessage error:", err.message);
      socket.emit("error", { message: err.message });
    }
  });

  socket.on("messageRead", async ({ messageId, conversationId }) => {
    try {
      const updated = await Message.findByIdAndUpdate(
        messageId, 
        { status: "read" }, 
        { new: true }
      );
      if (updated) {
        io.to(String(conversationId)).emit("messageUpdated", updated);
      }
    } catch (err) {
      console.error("error messageRead:", err.message);
    }
  });

  socket.on("markConversationDelivered", async ({ conversationId, userId }) => {
    try {
      await Message.updateMany(
        { 
          conversationId: conversationId,
          receiver: userId,
          status: "sent"
        },
        { status: "delivered" }
      );
      
      io.to(String(conversationId)).emit("conversationDelivered", { conversationId });
    } catch (err) {
      console.error("error markConversationDelivered:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
    
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        console.log(`👤 User ${userId} is now offline. Total online: ${onlineUsers.size}`);
        io.emit("userStatusChanged", { userId, isOnline: false });
        break;
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});
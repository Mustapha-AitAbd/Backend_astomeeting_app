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

// ✅ Track online users
const onlineUsers = new Map(); // Map<userId, socketId>

// Socket.IO management
io.on("connection", (socket) => {
  console.log("🔌 Socket connecté:", socket.id);

  // ✅ User comes online
  socket.on("userOnline", (userId) => {
    onlineUsers.set(userId.toString(), socket.id);
    console.log(`👤 User ${userId} is now online. Total online: ${onlineUsers.size}`);
    
    // Broadcast to all clients that this user is online
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

  socket.on("sendMessage", async (data) => {
    try {
      if (data._id) {
        await Conversation.findByIdAndUpdate(data.conversationId, { lastMessage: data._id });
        
        // ✅ Check if receiver is online to update status to "delivered"
        const receiverId = data.receiver?._id || data.receiver || data.receiverId;
        const isReceiverOnline = onlineUsers.has(receiverId.toString());
        
        if (isReceiverOnline) {
          // Update message status to delivered
          const updatedMessage = await Message.findByIdAndUpdate(
            data._id, 
            { status: "delivered" }, 
            { new: true }
          );
          
          // Emit to sender that message was delivered
          io.to(String(data.conversationId)).emit("messageUpdated", updatedMessage);
        }
        
        io.to(String(data.conversationId)).emit("newMessage", data);
        return;
      }

      const message = await chatController.saveMessage({
        conversationId: data.conversationId,
        senderId: data.senderId || data.sender,
        receiverId: data.receiverId || data.receiver,
        text: data.text,
      });

      // ✅ Check if receiver is online
      const receiverId = data.receiverId || data.receiver;
      const isReceiverOnline = onlineUsers.has(receiverId.toString());
      
      if (isReceiverOnline) {
        // Update to delivered immediately
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

  // ✅ Mark all messages in a conversation as delivered
  socket.on("markConversationDelivered", async ({ conversationId, userId }) => {
    try {
      // Update all sent messages to delivered for this user
      await Message.updateMany(
        { 
          conversationId: conversationId,
          receiver: userId,
          status: "sent"
        },
        { status: "delivered" }
      );
      
      // Notify the conversation
      io.to(String(conversationId)).emit("conversationDelivered", { conversationId });
    } catch (err) {
      console.error("error markConversationDelivered:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
    
    // ✅ Remove user from online list
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        console.log(`👤 User ${userId} is now offline. Total online: ${onlineUsers.size}`);
        
        // Broadcast that this user is offline
        io.emit("userStatusChanged", { userId, isOnline: false });
        break;
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});
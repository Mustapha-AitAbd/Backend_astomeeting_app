const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String },
  media: { type: String }, // URL image/audio/video
  status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" },
}, { timestamps: true });

module.exports = mongoose.model("Message", MessageSchema);

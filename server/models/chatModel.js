const mongoose = require("mongoose");
const { Schema } = mongoose;

const chatMessageSchema = new Schema({
    // Which escrow transaction this chat belongs to
    escrowId: {
        type: Schema.Types.ObjectId,
        ref: "escrow",
        required: true,
        index: true
    },
    // Who sent the message
    senderId: {
        type: Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    // Anonymous display name (e.g. first name only: "Sandesh")
    senderAlias: {
        type: String,
        required: true
    },
    // The message text
    message: {
        type: String,
        required: true,
        trim: true
    }
},
{
    timestamps: true
});

const chatModel = mongoose.model("chatMessage", chatMessageSchema);
module.exports = chatModel;

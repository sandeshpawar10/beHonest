const mongoose = require('mongoose');
const { Schema } = mongoose;

const notificationSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        index: true,
        required: true
    },
    type: {
        type: String,
        enum: ['CLAIM_VERDICT', 'DISPUTE_RAISED', 'REWARD_RELEASED', 'REFUND', 'CHAT_MESSAGE', 'GENERAL'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    relatedItemId: {
        type: String, // e.g., Escrow ID or Item ID for frontend routing
        default: ""
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('notificationModel', notificationSchema);

const mongoose = require("mongoose");
const { Schema } = mongoose;

const escrowSchema = new Schema({
    // Which item this escrow is for
    itemId: {
        type: Schema.Types.ObjectId,
        ref: "itemModel",
        required: true,
        index: true
    },
    // Which verified claim triggered this escrow
    claimId: {
        type: Schema.Types.ObjectId,
        ref: "claim",
        required: true
    },
    // The verified owner (who deposits the reward)
    depositorId: {
        type: Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true
    },
    // The finder (who receives the reward)
    finderId: {
        type: Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true
    },
    // Reward amount in ₹
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    // Reward category chosen by the owner (e.g. "standard", "generous", "premium")
    rewardCategory: {
        type: String,
        default: "standard"
    },
    // 6-digit PIN the owner shares with the finder to release funds
    releasePin: {
        type: String,
        required: true
    },
    // Current escrow state
    status: {
        type: String,
        enum: ["pending", "released", "refunded"],
        default: "pending"
    }
},
{
    timestamps: true
});

const escrowModel = mongoose.model("escrow", escrowSchema);
module.exports = escrowModel;

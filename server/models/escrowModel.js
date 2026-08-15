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
    ownerConfirmed: { type: Boolean, default: false },
    finderConfirmed: { type: Boolean, default: false },
    ownerConfirmedAt: { type: Date, default: null },
    finderConfirmedAt: { type: Date, default: null },
    disputeReason: { type: String, default: "" },
    disputeRaisedBy: { type: Schema.Types.ObjectId, ref: "user", default: null },
    disputeRaisedAt: { type: Date, default: null },
    adminResolvedAt: { type: Date, default: null },
    adminResolution: { type: String, enum: ["release_to_finder", "refund_to_owner", ""], default: "" },
    itemPossession: { type: String, enum: ["me", "other_party", "unknown", ""], default: "" },

    // Current escrow state
    status: {
        type: String,
        enum: ["payment_pending", "pending", "released", "refunded", "disputed"],
        default: "payment_pending"
    },

    // Razorpay Fields
    razorpayOrderId: { type: String, default: null },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null }
},
{
    timestamps: true
});

const escrowModel = mongoose.model("escrow", escrowSchema);
module.exports = escrowModel;

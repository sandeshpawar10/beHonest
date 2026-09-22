const mongoose = require("mongoose");
const { Schema } = mongoose;

const claimSchema = new Schema({
    // Which item is being claimed
    itemId: {
        type: Schema.Types.ObjectId,
        ref: "itemModel",
        required: true,
        index: true
    },
    // Who is claiming it (the person who thinks they own it)
    claimantId: {
        type: Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true
    },
    // Full chat transcript from the AI interview
    // Each entry: { role: "ai" | "user", text: "..." }
    answers: {
        type: Array,
        default: []
    },
    // AI's final decision
    verdict: {
        type: String,
        enum: ["verified", "rejected", "needs_review","pending_admin_review","permanently_rejected"],
        required: true
    },
    // AI confidence score (0-100)
    score: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    // Neutral message shown to the claimant (no details about what matched or failed)
    verdictMessage: {
        type: String,
        default: ""
    },
    // Detailed notes for admin/staff review only (never sent to claimant)
    reviewerNotes: {
        type: String,
        default: ""
    },
    // Structured evidence arrays from AI evaluation
    evidenceFor: {
        type: [String],
        default: []
    },
    evidenceAgainst: {
        type: [String],
        default: []
    },
    // Audit fields for AI versioning
    aiModelUsed: {
        type: String,
        default: "none"
    },
    aiVersion: {
        type: String,
        default: "none"
    },
    // The user's optional direct guess at the secret identity
    secretGuess: {
        type: String,
        default: ""
    },
    // The claimant's uploaded proof image (receipt, bill, old photo) URL via Cloudinary
    proofImage: {
        type: String,
        default: ""
    },
    adminFeedback:{
        type: String,
        default: ""
    },
    hasResubmitted:{
        type: Boolean,
        default: false
    }
},
{
    timestamps: true
});

const claimModel = mongoose.model("claim", claimSchema);
module.exports = claimModel;

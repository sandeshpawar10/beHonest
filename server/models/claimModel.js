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
        enum: ["verified", "rejected", "needs_review"],
        required: true
    },
    // AI confidence score (0-100)
    score: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    // AI's explanation of its decision
    verdictMessage: {
        type: String,
        default: ""
    }
},
{
    timestamps: true
});

const claimModel = mongoose.model("claim", claimSchema);
module.exports = claimModel;

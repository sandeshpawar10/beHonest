const mongoose = require("mongoose");
const { Schema } = mongoose;

const itemSchema = new Schema({
    // Changed name from 'userInfo' to 'reportedBy' so it's instantly obvious what this field does
    reportedBy: {
        type: Schema.Types.ObjectId,
        ref: "user",
        index: true,
        required: true
    },
    category: {
        type: String,
        required: true,
        // The exact category keys used in your React frontend
        enum: ["wallet", "watch", "phone", "keychain", "bag", "laptop", "headphones", "id_card", "bottle", "glasses", "other"]
    },
    shortTitle: {
        type: String,
        required: true,
        trim: true // Always good to trim accidental spaces
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        type: String, // Approximate location for public listing
        required: true,
        trim: true
    },
    exactLocation: {
        type: String, // Exact location, hidden from public
        default: ""
    },
    secretIdentity: {
        type: String,
        default: ""
    },
    secretDetails: {
        type: [String], // Specific marks, unique features, hidden from public
        default: []
    },
    // Track if the item is still lost or if it has been returned
    status: {
        type: String,
        enum: ["found", "claimed","pending_admin_review", "rejected","permanently_rejected"],
        default: "found"
    },
    // An array of strings to store image URLs (since your frontend already handles photo uploads!)
    images: {
        type: [String],
        default: []
    },
    // Used to detect duplicate image uploads
    imageFingerprint: {
        type: String,
        default: ""
    },
    // Array to store the X, Y, W, H coordinates for the privacy blur overlay
    blurZones: {
        type: Array,
        default: []
    },
    // When the item was actually found
    dateFound: {
        type: Date,
        default: Date.now
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
})

const itemModel = mongoose.model("itemModel", itemSchema)
module.exports = itemModel
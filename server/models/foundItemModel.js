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
        type: String,
        required: true,
        trim: true
    },
    secretIdentity: {
        type: String,
        default: ""
    },
    // Track if the item is still lost or if it has been returned
    status: {
        type: String,
        enum: ["found", "claimed"],
        default: "found"
    },
    // An array of strings to store image URLs (since your frontend already handles photo uploads!)
    images: {
        type: [String],
        default: []
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
    }
},
{
    timestamps: true
})

const itemModel = mongoose.model("itemModel", itemSchema)
module.exports = itemModel
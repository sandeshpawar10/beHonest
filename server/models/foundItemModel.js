const mongoose = require("mongoose");
const { Schema } = mongoose;

// Applies to creates, direct responses, toObject() and populated documents.
// Do not use lean()/aggregation for API item responses without this filtering.
const protectImagePrivacy = (_doc, item) => {
    delete item.originalImages;
    delete item.originalImageAssets;
    if (item.imagePrivacyVersion !== 1) {
        item.images = [];
        item.imagesUnavailable = true;
    } else {
        item.imagesUnavailable = false;
    }
    return item;
};

const imageZoneSchema = new Schema({
    x: { type: Number, required: true, min: 0, max: 100 },
    y: { type: Number, required: true, min: 0, max: 100 },
    w: { type: Number, required: true, min: Number.MIN_VALUE, max: 100 },
    h: { type: Number, required: true, min: Number.MIN_VALUE, max: 100 }
}, { _id: false });

const originalAssetSchema = new Schema({
    publicId: { type: String, required: true },
    type: { type: String, enum: ['authenticated'], required: true },
    resourceType: { type: String, enum: ['image'], required: true }
}, { _id: false });

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
    // Public images: independent, permanently opaque-redacted re-encodes.
    images: {
        type: [String],
        default: []
    },
    // Legacy field retained only for compatibility; never selected or served.
    originalImages: {
        type: [String],
        default: [],
        select: false
    },
    // New originals use authenticated delivery. No original URLs are stored.
    originalImageAssets: {
        type: [originalAssetSchema],
        default: [],
        select: false
    },
    // No default of 1: old records must never be implicitly trusted.
    imagePrivacyVersion: {
        type: Number,
        enum: [1]
    },
    allBlurZones: {
        type: Map,
        of: [imageZoneSchema],
        default: undefined
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
    timestamps: true,
    toJSON: { transform: protectImagePrivacy, flattenMaps: true },
    toObject: { transform: protectImagePrivacy, flattenMaps: true }
})

const itemModel = mongoose.model("itemModel", itemSchema)
module.exports = itemModel

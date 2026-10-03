const itemModel = require("../models/foundItemModel");
const { uploadRedactedImage, cleanupUploadedImages } = require("../utils/cloudinary");
const {
    MAX_IMAGES, ImageValidationError, imageDataUriSchema, blurZonesSchema,
    validateImageZoneMapping, normalizeImageZones
} = require("../validation/foundItemImages");
const z = require("zod");

const editItemSchema = z.object({
    shortTitle: z.string().min(3).max(100),
    description: z.string().min(5).max(2000),
    location: z.string().max(200),
    exactLocation: z.string().max(500).optional(),
    category: z.enum(["wallet", "watch", "phone", "keychain", "bag", "laptop", "headphones", "id_card", "bottle", "glasses", "other"]),
    dateFound: z.string().optional(),
    secretIdentity: z.string().max(200).optional(),
    secretDetails: z.array(z.string()).optional(),
    images: z.array(imageDataUriSchema).min(1).max(MAX_IMAGES),
    allBlurZones: z.record(z.string(), blurZonesSchema).optional(),
    blurZones: blurZonesSchema.optional(),
    imageFingerprint: z.string().optional()
}).superRefine(validateImageZoneMapping);

// ── Resubmit a rejected item ──────────────────────────────────
const resubmitItem = async function(req, res) {
    const uploadedAssets = [];
    let itemSaved = false;
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: "Unauthorized. You must be logged in to resubmit an item." });
        }

        const { itemId } = req.params;
        const existingItem = await itemModel.findById(itemId);

        if (!existingItem) {
            return res.status(404).json({ error: "Item not found." });
        }

        // Only the original reporter can resubmit
        if (existingItem.reportedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Forbidden. You can only resubmit your own items." });
        }

        // Only rejected items can be resubmitted
        if (existingItem.status !== "rejected") {
            return res.status(400).json({ error: "Only rejected items can be resubmitted." });
        }

        // Already resubmitted once - cannot resubmit again
        if (existingItem.hasResubmitted) {
            return res.status(400).json({ error: "This item has already been resubmitted and permanently rejected. Cannot resubmit again." });
        }

        const validation = editItemSchema.safeParse(req.body);
        if (!validation.success) {
            const issues = validation.error?.issues || validation.error?.errors || [];
            return res.status(400).json({
                error: issues.map(e => e.message).join(", ") || validation.error?.message || "Invalid request payload"
            });
        }

        const {category, shortTitle, description, location, exactLocation, secretIdentity, secretDetails, images, blurZones, allBlurZones, dateFound} = validation.data;
        const publicRedactedUrls = [];
        const originalImageAssets = [];
        const normalizedZones = normalizeImageZones(images, allBlurZones, blurZones);

        // Upload new images with redaction
        for (let i = 0; i < images.length; i++) {
            const result = await uploadRedactedImage(images[i], normalizedZones[String(i)]);
            uploadedAssets.push(...result.assets);
            publicRedactedUrls.push(result.publicUrl);
            originalImageAssets.push(result.originalAsset);
        }

        // Update the existing item
        existingItem.category = category;
        existingItem.shortTitle = shortTitle;
        existingItem.description = description;
        existingItem.location = location;
        existingItem.exactLocation = exactLocation || "";
        existingItem.secretIdentity = secretIdentity || "";
        existingItem.secretDetails = secretDetails || [];
        existingItem.status = "pending_admin_review";
        existingItem.images = publicRedactedUrls;
        existingItem.originalImageAssets = originalImageAssets;
        existingItem.allBlurZones = normalizedZones;
        existingItem.imagePrivacyVersion = 1;
        existingItem.dateFound = dateFound || existingItem.dateFound;
        existingItem.hasResubmitted = true;
        existingItem.adminFeedback = ""; // Clear previous feedback

        await existingItem.save();
        itemSaved = true;

        // Alert the admin
        const { sendAdminReviewAlert } = require('../utils/emailUtils');
        sendAdminReviewAlert("Item", existingItem._id).catch(() => console.error("Admin review alert failed."));

        return res.status(200).json({
            status: "success",
            message: "Item resubmitted successfully for review.",
            item: existingItem.toJSON()
        });
    } catch (error) {
        if (!itemSaved) await cleanupUploadedImages(uploadedAssets);
        if (error instanceof ImageValidationError) {
            return res.status(400).json({ error: error.message });
        }
        console.error("Error resubmitting item.");
        return res.status(500).json({
            error: "Internal server error while resubmitting the item."
        });
    }
};

module.exports = { resubmitItem };

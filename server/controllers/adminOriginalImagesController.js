const itemModel = require("../models/foundItemModel");
const cloudinary = require("../utils/cloudinary");

/**
 * Admin-only endpoint to view original unredacted images
 *
 * Security requirements:
 * - Must be called with admin authentication
 * - Audit logged on every access
 * - Never returns asset IDs or private URLs in bulk responses
 * - Rate limited to prevent abuse
 */

exports.getOriginalImages = async function(req, res) {
    try {
        const { itemId } = req.params;

        // Verify admin access (middleware already checked, but double-check)
        if (!['admin', 'superadmin'].includes(req.user.role)) {
            console.warn(`[SECURITY] Non-admin user ${req.user._id} attempted to access original images for item ${itemId}`);
            return res.status(403).json({ error: "Admin access required." });
        }

        // Fetch item with original image assets
        const item = await itemModel.findById(itemId)
            .select('+originalImageAssets +originalImages imagePrivacyVersion images shortTitle category status');

        if (!item) {
            return res.status(404).json({ error: "Item not found." });
        }

        // Only items with imagePrivacyVersion 1 have privacy-protected images
        if (item.imagePrivacyVersion !== 1) {
            // Audit log for legacy item access attempt
            console.log(`[AUDIT] Admin ${req.user.email} (${req.user._id}) requested originals for legacy item ${itemId} - no protected originals exist`);
            return res.status(400).json({
                error: "This item does not have privacy-protected images.",
                hasOriginals: false,
                imagePrivacyVersion: item.imagePrivacyVersion
            });
        }

        // Check if original assets exist
        if (!item.originalImageAssets || item.originalImageAssets.length === 0) {
            console.log(`[AUDIT] Admin ${req.user.email} (${req.user._id}) requested originals for item ${itemId} - no original assets stored`);
            return res.status(404).json({ error: "No original images found for this item." });
        }

        // SECURITY AUDIT LOG - Record every access to original images
        console.log(
            `[AUDIT] Admin ${req.user.email} (${req.user._id}) accessed ${item.originalImageAssets.length} original image(s) ` +
            `for item ${itemId} (${item.category}: "${item.shortTitle}") at ${new Date().toISOString()}`
        );

        // Generate temporary signed URLs for authenticated Cloudinary assets
        // These URLs expire after a short duration (default 1 hour)
        const originalUrls = item.originalImageAssets.map(asset => {
            if (!asset?.publicId) return null;

            try {
                // Generate a signed URL that expires in 1 hour
                const signedUrl = cloudinary.cloudinary.url(asset.publicId, {
                    type: 'authenticated',
                    sign_url: true,
                    expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
                    resource_type: 'image'
                });

                return signedUrl;
            } catch (error) {
                console.error(`[ERROR] Failed to generate signed URL for asset ${asset.publicId}:`, error);
                return null;
            }
        }).filter(Boolean);

        if (originalUrls.length === 0) {
            return res.status(500).json({ error: "Failed to generate original image URLs." });
        }

        // Return original images with metadata
        return res.status(200).json({
            itemId: item._id,
            shortTitle: item.shortTitle,
            category: item.category,
            status: item.status,
            imagePrivacyVersion: item.imagePrivacyVersion,
            publicImages: item.images, // The redacted versions
            originalImages: originalUrls, // Temporary signed URLs to originals
            imageCount: originalUrls.length,
            expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
            warning: "These are unredacted original images. Handle with care. URLs expire in 1 hour."
        });

    } catch (error) {
        console.error(`[ERROR] Failed to fetch original images for item ${req.params.itemId}:`, error);
        return res.status(500).json({
            error: "Internal server error while fetching original images."
        });
    }
};

/**
 * Get audit log of who accessed original images for a specific item
 * Requires superadmin access
 */
exports.getOriginalImageAuditLog = async function(req, res) {
    try {
        const { itemId } = req.params;

        // Only superadmins can view audit logs
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ error: "Superadmin access required." });
        }

        // This is a placeholder - in production, you'd query a separate audit log collection
        // For now, return a message about where to find logs
        return res.status(200).json({
            message: "Check server logs for audit trail.",
            itemId,
            logLocation: "Server console logs contain [AUDIT] entries for original image access",
            recommendation: "Implement a dedicated audit log collection in MongoDB for production use"
        });

    } catch (error) {
        console.error(`[ERROR] Failed to fetch audit log for item ${req.params.itemId}:`, error);
        return res.status(500).json({
            error: "Internal server error while fetching audit log."
        });
    }
};

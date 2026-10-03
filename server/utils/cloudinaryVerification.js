const cloudinary = require("../utils/cloudinary");

/**
 * Verify Cloudinary configuration and authenticated upload support
 * Run this on server startup to catch configuration issues early
 */
async function verifyCloudinaryConfig() {
    const errors = [];
    const warnings = [];

    // Check if credentials are set
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
        errors.push("CLOUDINARY_CLOUD_NAME is not set");
    }
    if (!process.env.CLOUDINARY_API_KEY) {
        errors.push("CLOUDINARY_API_KEY is not set");
    }
    if (!process.env.CLOUDINARY_API_SECRET) {
        errors.push("CLOUDINARY_API_SECRET is not set");
    }

    if (errors.length > 0) {
        return {
            success: false,
            errors,
            warnings,
            message: "Cloudinary configuration is incomplete"
        };
    }

    // Try to ping Cloudinary API
    try {
        const result = await cloudinary.cloudinary.api.ping();
        console.log("✅ Cloudinary API connection successful:", result);
    } catch (error) {
        errors.push(`Cloudinary API ping failed: ${error.message}`);
        return {
            success: false,
            errors,
            warnings,
            message: "Cannot connect to Cloudinary API"
        };
    }

    // Check account usage and limits (optional, helps identify quota issues)
    try {
        const usage = await cloudinary.cloudinary.api.usage();
        console.log("📊 Cloudinary Usage:", {
            credits: usage.credits,
            storage: `${(usage.storage.usage / 1024 / 1024).toFixed(2)} MB used`,
            bandwidth: `${(usage.bandwidth.usage / 1024 / 1024).toFixed(2)} MB used`,
            transformations: usage.transformations?.usage || 0
        });

        // Warn if approaching limits
        if (usage.credits && usage.credits.usage > usage.credits.limit * 0.8) {
            warnings.push("Cloudinary credits usage is above 80%");
        }
    } catch (error) {
        warnings.push(`Could not fetch Cloudinary usage: ${error.message}`);
    }

    return {
        success: true,
        errors: [],
        warnings,
        message: "Cloudinary configuration verified successfully"
    };
}

/**
 * Test authenticated upload capability
 * This ensures the privacy system's original image storage will work
 */
async function testAuthenticatedUpload() {
    try {
        // Create a small test image (1x1 transparent PNG)
        const testImageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

        // Try authenticated upload
        const result = await cloudinary.cloudinary.uploader.upload(testImageBase64, {
            folder: "behonest/test",
            type: "authenticated",
            resource_type: "image"
        });

        console.log("✅ Authenticated upload test successful:", result.public_id);

        // Clean up test image
        await cloudinary.cloudinary.uploader.destroy(result.public_id, {
            type: "authenticated",
            resource_type: "image"
        });

        return {
            success: true,
            message: "Authenticated upload is working correctly"
        };
    } catch (error) {
        console.error("❌ Authenticated upload test failed:", error.message);
        return {
            success: false,
            error: error.message,
            message: "Authenticated upload test failed - check Cloudinary account settings"
        };
    }
}

module.exports = {
    verifyCloudinaryConfig,
    testAuthenticatedUpload
};

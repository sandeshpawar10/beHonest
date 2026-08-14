const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads a base64 image string to Cloudinary.
 * @param {string} base64Image - The base64 data URI of the image.
 * @param {string} folder - Optional folder name in Cloudinary.
 * @returns {Promise<string>} The secure URL of the uploaded image.
 */
exports.uploadImage = async (base64Image, folder = "beHonest_items") => {
    try {
        if (!base64Image) return null;

        // The Cloudinary Node.js SDK can accept base64 data URIs directly
        const result = await cloudinary.uploader.upload(base64Image, {
            folder: folder,
            resource_type: "image",
            // Compress and optimize the image delivery
            quality: "auto",
            fetch_format: "auto"
        });

        return result.secure_url;
    } catch (error) {
        console.error("Cloudinary upload failed:", error);
        throw new Error("Failed to upload image to Cloudinary.");
    }
};

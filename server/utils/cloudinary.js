const cloudinary = require('cloudinary').v2;
const sharp = require('sharp');
const { randomUUID } = require('crypto');
const { decodeImageDataUri, validateBlurZones, ImageValidationError } = require('../validation/foundItemImages');

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

const MAX_IMAGE_PIXELS = 20 * 1000 * 1000;

async function redactLocally(base64Image, blurZones) {
    const { buffer, format } = decodeImageDataUri(base64Image);
    const zones = validateBlurZones(blurZones);
    try {
        const options = { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'warning' };
        const metadata = await sharp(buffer, options).metadata();
        if (metadata.format !== format || (metadata.pages || 1) !== 1) {
            throw new Error('Unsupported format or animated image');
        }

        // Browser previews honor EXIF orientation. Apply it before interpreting
        // percentage masks. Raw pixels discard EXIF, GPS, thumbnails and profiles.
        const { data, info } = await sharp(buffer, options)
            .rotate().toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        for (const zone of zones) {
            // Round outwards so every pixel touched by a mask is replaced.
            const left = Math.min(info.width - 1, Math.floor(zone.x * info.width / 100));
            const top = Math.min(info.height - 1, Math.floor(zone.y * info.height / 100));
            const right = Math.min(info.width, Math.max(left + 1, Math.ceil((zone.x + zone.w) * info.width / 100)));
            const bottom = Math.min(info.height, Math.max(top + 1, Math.ceil((zone.y + zone.h) * info.height / 100)));
            for (let y = top; y < bottom; y++) {
                for (let x = left; x < right; x++) {
                    const offset = (y * info.width + x) * info.channels;
                    data[offset] = 0;
                    data[offset + 1] = 0;
                    data[offset + 2] = 0;
                    data[offset + 3] = 255;
                }
            }
        }
        const publicBuffer = await sharp(data, {
            raw: { width: info.width, height: info.height, channels: info.channels }
        }).png().toBuffer();
        return { publicBuffer };
    } catch (error) {
        // Decoder errors may contain input details. Never return or log them.
        throw new ImageValidationError('Image could not be decoded safely. Use a static JPEG, PNG or WebP of at most 20 megapixels.');
    }
}

// Only accepts refs generated during this request, never client-supplied IDs.
// Deleting a new ID is safe even if an upload timed out after reaching storage.
async function cleanupUploadedImages(assets) {
    await Promise.allSettled(assets.map(async asset => {
        try {
            const result = await cloudinary.uploader.destroy(asset.publicId, {
                resource_type: 'image', type: asset.type, invalidate: true
            });
            if (!['ok', 'not found'].includes(result?.result)) {
                console.error('New image cleanup did not complete.');
            }
        } catch (error) {
            console.error('New image cleanup failed.');
        }
    }));
}

/**
 * Upload the original with authenticated delivery (including derivatives),
 * and an independent, locally re-encoded, opaque-redacted public PNG.
 * No original delivery URL is stored or returned. Asset refs are server-only.
 */
exports.uploadRedactedImage = async (base64Image, blurZones = [], folder = 'beHonest_items') => {
    const { publicBuffer } = await redactLocally(base64Image, blurZones);
    const originalAsset = { publicId: `${folder}/private_originals/${randomUUID()}`, type: 'authenticated', resourceType: 'image' };
    const publicAsset = { publicId: `${folder}/public_redacted/${randomUUID()}`, type: 'upload', resourceType: 'image' };
    const attemptedAssets = [];
    try {
        attemptedAssets.push(originalAsset);
        const original = await cloudinary.uploader.upload(base64Image, {
            public_id: originalAsset.publicId,
            resource_type: 'image',
            type: 'authenticated',
            overwrite: false
        });
        if (original.type !== 'authenticated' || original.public_id !== originalAsset.publicId) {
            throw new Error('Unexpected original upload result');
        }

        attemptedAssets.push(publicAsset);
        const publicImage = await cloudinary.uploader.upload(`data:image/png;base64,${publicBuffer.toString('base64')}`, {
            public_id: publicAsset.publicId,
            resource_type: 'image',
            type: 'upload',
            overwrite: false
        });
        if (publicImage.type !== 'upload' || publicImage.public_id !== publicAsset.publicId ||
            typeof publicImage.secure_url !== 'string' || !publicImage.secure_url.startsWith('https://')) {
            throw new Error('Unexpected public upload result');
        }
        return { originalAsset, publicUrl: publicImage.secure_url, assets: attemptedAssets };
    } catch (error) {
        await cleanupUploadedImages(attemptedAssets);
        // Do not log upstream errors containing private URLs, identifiers or input.
        throw new Error('Failed to securely upload and redact image.');
    }
};

exports.cleanupUploadedImages = cleanupUploadedImages;

const z = require("zod");

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 5;
const MAX_ZONES_PER_IMAGE = 50;
const MAX_DATA_URI_LENGTH = 32 + 4 * Math.ceil(MAX_IMAGE_BYTES / 3);

class ImageValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ImageValidationError";
    }
}

// Do not accept URLs, SVG, whitespace or non-canonical base64. Check the
// encoded length before allocating the decoded image buffer.
function decodeImageDataUri(value) {
    if (typeof value !== "string" || value.length > MAX_DATA_URI_LENGTH) {
        throw new ImageValidationError("Each image must be at most 5 MiB.");
    }
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match || match[2].length % 4 !== 0) {
        throw new ImageValidationError("Images must be JPEG, PNG or WebP base64 data URIs.");
    }
    const buffer = Buffer.from(match[2], "base64");
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES || buffer.toString("base64") !== match[2]) {
        throw new ImageValidationError("Invalid image encoding or image exceeds 5 MiB.");
    }
    return { buffer, format: match[1] };
}

const blurZoneSchema = z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    w: z.number().gt(0).max(100),
    h: z.number().gt(0).max(100)
}).strict().refine(zone => zone.w <= 100 - zone.x && zone.h <= 100 - zone.y, {
    message: "Privacy masks must stay within image bounds."
});

const blurZonesSchema = z.array(blurZoneSchema).max(MAX_ZONES_PER_IMAGE);
const imageDataUriSchema = z.string().max(MAX_DATA_URI_LENGTH).superRefine((value, ctx) => {
    try {
        decodeImageDataUri(value);
    } catch (error) {
        ctx.addIssue({ code: "custom", message: error.message });
    }
});

// Shared by request validation and the uploader, so an internal caller cannot
// accidentally bypass validation and publish an unmasked image.
function validateBlurZones(zones) {
    const result = blurZonesSchema.safeParse(zones);
    if (!result.success) {
        throw new ImageValidationError("Invalid privacy mask bounds or too many masks (maximum 50 per image).");
    }
    return result.data;
}

function validateImageZoneMapping(data, ctx) {
    if (data.blurZones !== undefined && data.images.length !== 1) {
        ctx.addIssue({ code: "custom", path: ["blurZones"], message: "Legacy blurZones is supported only for one image; use allBlurZones." });
    }
    if (data.blurZones !== undefined && data.allBlurZones !== undefined) {
        ctx.addIssue({ code: "custom", path: ["allBlurZones"], message: "Send allBlurZones or legacy blurZones, not both." });
    }
    for (const key of Object.keys(data.allBlurZones || {})) {
        if (!/^(0|[1-4])$/.test(key) || Number(key) >= data.images.length) {
            ctx.addIssue({ code: "custom", path: ["allBlurZones", key], message: "Privacy mask key must identify an uploaded image index." });
        }
    }
}

function normalizeImageZones(images, allBlurZones, blurZones) {
    return Object.fromEntries(images.map((_, index) => [
        String(index), allBlurZones?.[String(index)] || (index === 0 ? blurZones : undefined) || []
    ]));
}

module.exports = {
    MAX_IMAGES,
    ImageValidationError,
    decodeImageDataUri,
    imageDataUriSchema,
    blurZonesSchema,
    validateBlurZones,
    validateImageZoneMapping,
    normalizeImageZones
};

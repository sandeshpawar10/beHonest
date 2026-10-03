// Client-side feedback only: the server validates and permanently redacts uploads.
export const MAX_FOUND_IMAGES = 5;
export const MAX_REDACTION_ZONES = 50;
export const MAX_ORIGINAL_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_PROCESSED_IMAGE_BYTES = 5 * 1024 * 1024;
export const FOUND_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function processedImageError(image) {
  if (typeof image !== 'string') return 'Please upload a JPEG, PNG, or WebP photo.';
  const match = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match || match[1].length % 4 !== 0) {
    return 'The processed photo is invalid. Please choose a JPEG, PNG, or WebP photo again.';
  }
  const base64 = match[1];
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const bytes = (base64.length / 4) * 3 - padding;
  return bytes > MAX_PROCESSED_IMAGE_BYTES
    ? 'The processed photo exceeds 5 MiB. Please choose a smaller photo.'
    : '';
}

export function redactionZonesError(zones) {
  if (!Array.isArray(zones) || zones.length > MAX_REDACTION_ZONES) {
    return `Use at most ${MAX_REDACTION_ZONES} hidden areas per photo.`;
  }
  const invalid = zones.some(zone => !zone ||
    !['x', 'y', 'w', 'h'].every(key => typeof zone[key] === 'number' && Number.isFinite(zone[key])) ||
    zone.x < 0 || zone.y < 0 || zone.w <= 0 || zone.h <= 0 ||
    zone.x + zone.w > 100 || zone.y + zone.h > 100);
  return invalid ? 'Hidden areas must be non-empty rectangles inside the photo. Please redraw the area.' : '';
}

export function foundImagesError(images, allBlurZones) {
  if (!Array.isArray(images) || images.length < 1 || images.length > MAX_FOUND_IMAGES) {
    return `Please upload between 1 and ${MAX_FOUND_IMAGES} photos.`;
  }
  if (!allBlurZones || typeof allBlurZones !== 'object' || Array.isArray(allBlurZones) ||
      Object.keys(allBlurZones).some(key => !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= images.length)) {
    return 'The hidden areas do not match the uploaded photos. Please review each photo.';
  }
  for (let index = 0; index < images.length; index += 1) {
    const zones = Object.hasOwn(allBlurZones, index) ? allBlurZones[index] : [];
    const error = processedImageError(images[index]) || redactionZonesError(zones);
    if (error) return `Photo ${index + 1}: ${error}`;
  }
  return '';
}

export function publicFoundImages(item) {
  // Fail closed for old responses and legacy items. Never fall back to originals.
  return item?.imagePrivacyVersion === 1 && !item.imagesUnavailable && Array.isArray(item.images)
    ? item.images.map(image => typeof image === 'string' ? image : '')
    : [];
}

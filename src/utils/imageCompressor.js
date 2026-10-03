/**
 * Compresses and resizes an image file in the browser before upload.
 * Reduces 10MB+ phone camera photos down to ~300KB-800KB.
 * Ensures fast uploads, avoids mobile browser out-of-memory crashes,
 * and fixes failed camera captures on Android/iOS.
 */
export async function compressImage(file, maxDimension = 1600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for compression.'));
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;
          if (!width || !height) throw new Error('The photo has invalid dimensions.');

          // Calculate aspect-ratio preserving dimensions
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.max(1, Math.round((height * maxDimension) / width));
              width = maxDimension;
            } else {
              width = Math.max(1, Math.round((width * maxDimension) / height));
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            // The caller still validates the original's type and decoded size.
            return resolve(event.target.result);
          }

          // Draw scaled image onto canvas
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to optimized JPEG data URL
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        } catch {
          // Exceptions inside onload must reject rather than leave uploads pending.
          reject(new Error('Could not process this photo. Please choose a smaller photo or a different file.'));
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

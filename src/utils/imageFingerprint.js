/* ============================================================
   imageFingerprint.js — Image Fingerprint Generator
   
   Extracted into its own file to avoid circular dependencies
   between itemUtils.js and fraudUtils.js.
   
   Both files import from this file, so there's no circular loop.
   
   HOW IT WORKS:
   - Takes a base64 image string (can be 100,000+ characters)
   - Samples 50 characters from evenly-spaced positions
   - Converts those samples into a numeric hash
   - Returns a short fingerprint string like "fp_abc123"
   
   If two images produce the SAME fingerprint → they are duplicates!
   ============================================================ */

export function generateImageFingerprint(base64Data) {
  // No image data → no fingerprint
  if (!base64Data) return '';

  // Strip the "data:image/jpeg;base64," prefix
  const raw = base64Data.includes(',')
    ? base64Data.split(',')[1]
    : base64Data;

  // If the image is too tiny, mark it
  if (raw.length < 100) return 'too_small';

  // ── Sample 50 characters at evenly-spaced intervals ──
  const step = Math.floor(raw.length / 50);
  let fingerprint = '';
  for (let i = 0; i < 50; i++) {
    fingerprint += raw[i * step];
  }

  // ── Convert to a numeric hash (djb2-like algorithm) ──
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return 'fp_' + Math.abs(hash).toString(36);
}

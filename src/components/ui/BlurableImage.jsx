/* ============================================================
   BlurableImage.jsx
   
   PURPOSE:
   Show an image with specific regions blurred.
   The "blur zones" are rectangles (stored as % values)
   that sit on top of the image as blurred overlays.
   
   PROPS:
   - imageSrc    : the image URL or base64 data string
   - blurZones   : array of { x, y, w, h } — all in percentage (0–100)
   - alt         : alt text for accessibility
   - blurStrength: how strong the blur is (default: 12px)
   ============================================================ */

import { useEffect, useRef } from 'react';
import styles from './BlurableImage.module.css';

function BlurableImage({ imageSrc, blurZones = [], alt = 'Found item', blurStrength = 12 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageSrc;
    
    img.onload = () => {
      // Set canvas dimensions to match the actual image resolution
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw the crisp original image first
      ctx.drawImage(img, 0, 0, img.width, img.height);
      
      // Apply blur zones
      if (blurZones && blurZones.length > 0) {
        blurZones.forEach(zone => {
          // Convert percentages back to actual pixel coordinates
          const x = (zone.x / 100) * img.width;
          const y = (zone.y / 100) * img.height;
          const w = (zone.w / 100) * img.width;
          const h = (zone.h / 100) * img.height;
          
          ctx.save();
          
          // Create a clipping path for this specific zone
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.clip();
          
          // Draw the image again inside the clipped area, but blurred!
          // We scale the blur strength relative to the image size so it always looks uniformly blurred
          const scaledBlur = Math.max(blurStrength, (img.width / 500) * blurStrength);
          ctx.filter = `blur(${scaledBlur}px)`;
          
          // We draw the image slightly larger to avoid unblurred edges creeping in
          const margin = scaledBlur * 2;
          ctx.drawImage(img, -margin, -margin, img.width + (margin*2), img.height + (margin*2));
          
          // Add a dark overlay and lock icon
          ctx.filter = 'none'; // reset filter for text
          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.fillRect(x, y, w, h);
          
          const fontSize = Math.max(20, Math.min(w, h) * 0.3);
          ctx.font = `${fontSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'white';
          ctx.fillText('🔒', x + w/2, y + h/2);
          
          ctx.restore();
        });
      }
    };
  }, [imageSrc, blurZones, blurStrength]);

  return (
    <div className={styles.wrapper}>
      {/* 
        By using a Canvas instead of an <img> tag, the user CANNOT right-click 
        and 'Open image in new tab' to see the raw unblurred image source.
        The blur is literally baked into the pixels being rendered!
      */}
      <canvas
        ref={canvasRef}
        className={styles.image}
        style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 'inherit' }}
        aria-label={alt}
        role="img"
      />

      {/* Badge shown at the bottom of the image */}
      {blurZones && blurZones.length > 0 && (
        <div className={styles.badge}>
          🔒 {blurZones.length} sensitive area{blurZones.length > 1 ? 's' : ''} hidden
        </div>
      )}
    </div>
  );
}

export default BlurableImage;

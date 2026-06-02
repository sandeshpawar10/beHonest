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

import styles from './BlurableImage.module.css';

function BlurableImage({ imageSrc, blurZones = [], alt = 'Found item', blurStrength = 12 }) {
  return (
    /*
      The wrapper div is "position: relative" so that the
      blur overlay divs can be positioned OVER the image
      using "position: absolute".
    */
    <div className={styles.wrapper}>

      {/* The actual image — fills the wrapper completely */}
      <img
        src={imageSrc}
        alt={alt}
        className={styles.image}
      />

      {/*
        Loop through every blur zone and render a blurred div on top.
        Each zone uses percentage-based position (x, y) and size (w, h)
        so it works correctly even when the image is resized.
      */}
      {blurZones.map((zone, index) => (
        <div
          key={index}  // React needs a unique key for each item in a list

          className={styles.blurOverlay}

          style={{
            /*
              Position and size are in percentage of the image container.
              Example: x=10, y=20, w=30, h=15 means:
              - starts 10% from left, 20% from top
              - is 30% wide, 15% tall
            */
            left:   zone.x + '%',
            top:    zone.y + '%',
            width:  zone.w + '%',
            height: zone.h + '%',

            // backdropFilter blurs everything BEHIND this div (i.e., the image)
            backdropFilter: `blur(${blurStrength}px)`,
            WebkitBackdropFilter: `blur(${blurStrength}px)`, // Safari support
          }}

          // Tell screen readers this region is intentionally hidden
          aria-label="Sensitive area — hidden for privacy"
          role="img"
        >
          {/* Small lock icon in the centre of every blurred zone */}
          <span className={styles.lockIcon} aria-hidden="true">🔒</span>
        </div>
      ))}

      {/* Badge shown at the bottom of the image */}
      {blurZones.length > 0 && (
        <div className={styles.badge}>
          🔒 {blurZones.length} sensitive area{blurZones.length > 1 ? 's' : ''} hidden
        </div>
      )}

    </div>
  );
}

export default BlurableImage;

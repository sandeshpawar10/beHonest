/* ============================================================
   BlurableImage.jsx
   
   PURPOSE:
   Show a server-redacted public image, or a local upload preview
   with opaque masks. Local masks are illustrative only; actual
   public redaction happens on the server before publication.
   
   PROPS:
   - imageSrc    : the image URL or base64 data string
   - blurZones   : array of { x, y, w, h } — all in percentage (0–100)
   - alt         : alt text for accessibility
   ============================================================ */

import { useState } from 'react';
import styles from './BlurableImage.module.css';

function BlurableImage({ imageSrc, blurZones = [], alt = 'Found item' }) {
  // Remount image state on source changes, so an old failure cannot hide a new photo.
  return <ImagePreview key={imageSrc || 'unavailable'} imageSrc={imageSrc} blurZones={blurZones} alt={alt} />;
}

function ImagePreview({ imageSrc, blurZones, alt }) {
  const [failed, setFailed] = useState(false);
  const unavailable = !imageSrc || failed;

  return (
    <div className={styles.wrapper}>
      {unavailable ? (
        <div className={styles.placeholder} role="img" aria-label={`${alt}: photo unavailable`}>
          Photo unavailable. Item details are still available.
        </div>
      ) : (
        <>
          <img
            src={imageSrc}
            alt={alt}
            className={styles.image}
            onError={() => setFailed(true)}
          />
          {blurZones.map((zone, index) => (
            <div
              key={index}
              className={styles.blurOverlay}
              aria-hidden="true"
              style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.w}%`, height: `${zone.h}%` }}
            />
          ))}
        </>
      )}

      {!unavailable && blurZones.length > 0 && (
        <div className={styles.badge}>
          🔒 {blurZones.length} area{blurZones.length > 1 ? 's' : ''} marked to hide
        </div>
      )}
    </div>
  );
}

export default BlurableImage;

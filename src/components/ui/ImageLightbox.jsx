/* ============================================================
   ImageLightbox.jsx — Simple Image Lightbox Component
   Features: Click to view full image, close on backdrop click
   ============================================================ */

import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import styles from './ImageLightbox.module.css';

export default function ImageLightbox({ images, initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  if (!images || images.length === 0) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
        <X size={24} />
      </button>

      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        <img
          src={images[currentIndex]}
          alt={`Image ${currentIndex + 1} of ${images.length}`}
          className={styles.image}
        />

        {images.length > 1 && (
          <>
            <button
              className={`${styles.navBtn} ${styles.navBtnLeft}`}
              onClick={handlePrevious}
              aria-label="Previous image"
            >
              <ChevronLeft size={32} />
            </button>
            <button
              className={`${styles.navBtn} ${styles.navBtnRight}`}
              onClick={handleNext}
              aria-label="Next image"
            >
              <ChevronRight size={32} />
            </button>
            <div className={styles.counter}>
              {currentIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

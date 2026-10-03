/* ============================================================
   AdminOriginalImagesViewer.jsx

   Admin-only component to view unredacted original images
   with audit logging and security warnings
   ============================================================ */

import { useState } from 'react';
import { Eye, EyeOff, AlertTriangle, Lock, Clock } from 'lucide-react';
import styles from './AdminOriginalImagesViewer.module.css';

export default function AdminOriginalImagesViewer({ itemId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [originalData, setOriginalData] = useState(null);
  const [showOriginals, setShowOriginals] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const fetchOriginalImages = async () => {
    if (!agreedToTerms) {
      setError('You must acknowledge the security warning first.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/admin/item/${itemId}/original-images`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch original images');
      }

      const data = await response.json();
      setOriginalData(data);
      setShowOriginals(true);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching original images:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatExpiryTime = (expiresAt) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry - now;
    const diffMins = Math.floor(diffMs / 60000);
    return `${diffMins} minutes`;
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>
            <Lock size={24} />
            View Original Images
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {!showOriginals ? (
          <div className={styles.warningSection}>
            <div className={styles.warningBox}>
              <AlertTriangle size={48} className={styles.warningIcon} />
              <h3>Security Warning</h3>
              <p>
                You are about to view <strong>unredacted original images</strong> that may contain
                sensitive personal information (faces, IDs, addresses).
              </p>
              <ul className={styles.warningList}>
                <li>This action is <strong>audit logged</strong></li>
                <li>Only view if absolutely necessary for moderation</li>
                <li>Do not share, screenshot, or redistribute these images</li>
                <li>URLs expire in 1 hour</li>
              </ul>
            </div>

            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
              />
              <span>
                I understand the privacy implications and will handle these images responsibly
              </span>
            </label>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              <button
                className={styles.cancelBtn}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className={styles.viewBtn}
                onClick={fetchOriginalImages}
                disabled={!agreedToTerms || loading}
              >
                {loading ? (
                  <>Loading...</>
                ) : (
                  <>
                    <Eye size={20} />
                    View Original Images
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.imagesSection}>
            <div className={styles.infoBar}>
              <div className={styles.infoItem}>
                <strong>Item:</strong> {originalData.shortTitle}
              </div>
              <div className={styles.infoItem}>
                <strong>Category:</strong> {originalData.category}
              </div>
              <div className={styles.infoItem}>
                <Clock size={16} />
                <strong>URLs expire in:</strong> {formatExpiryTime(originalData.expiresAt)}
              </div>
            </div>

            <div className={styles.warning}>
              ⚠️ {originalData.warning}
            </div>

            <div className={styles.compareView}>
              <div className={styles.imageColumn}>
                <h4>
                  <EyeOff size={20} />
                  Public (Redacted)
                </h4>
                <div className={styles.imageGrid}>
                  {originalData.publicImages.map((img, idx) => (
                    <img
                      key={`public-${idx}`}
                      src={img}
                      alt={`Public ${idx + 1}`}
                      className={styles.image}
                    />
                  ))}
                </div>
              </div>

              <div className={styles.imageColumn}>
                <h4>
                  <Eye size={20} />
                  Original (Unredacted)
                </h4>
                <div className={styles.imageGrid}>
                  {originalData.originalImages.map((img, idx) => (
                    <div key={`original-${idx}`} className={styles.originalImageWrapper}>
                      <div className={styles.sensitiveLabel}>SENSITIVE</div>
                      <img
                        src={img}
                        alt={`Original ${idx + 1}`}
                        className={styles.image}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.closeBtn} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   LegacyItemMessage.jsx

   Shows a message when item images are unavailable due to
   legacy privacy system (items uploaded before privacy protection)
   ============================================================ */

import { Lock, AlertCircle } from 'lucide-react';
import styles from './LegacyItemMessage.module.css';

export default function LegacyItemMessage({ isReporter = false, itemId = null }) {
  return (
    <div className={styles.legacyMessage}>
      <div className={styles.iconWrapper}>
        <Lock size={32} className={styles.lockIcon} />
      </div>

      <h3 className={styles.title}>
        <AlertCircle size={20} />
        Privacy Protection Active
      </h3>

      <p className={styles.description}>
        This item was submitted before our image privacy system was implemented.
        Images are currently hidden to protect privacy.
      </p>

      {isReporter && itemId && (
        <div className={styles.reporterActions}>
          <p className={styles.reporterText}>
            You are the reporter of this item. To make it visible again:
          </p>
          <button
            className={styles.updateButton}
            onClick={() => window.location.href = `/item/${itemId}/resubmit`}
          >
            Update This Item
          </button>
          <p className={styles.helperText}>
            You'll be able to upload new images with privacy controls.
          </p>
        </div>
      )}

      {!isReporter && (
        <p className={styles.contactText}>
          Questions? <a href="/contact">Contact Support</a>
        </p>
      )}
    </div>
  );
}

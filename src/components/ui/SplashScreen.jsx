/* ============================================================
   SplashScreen.jsx — Logo Animation on App Load
   Shows the beHonest logo with a premium zoom-in + fade animation
   before revealing the rest of the app.
   ============================================================ */

import { useState, useEffect } from 'react';
import styles from './SplashScreen.module.css';

function SplashScreen({ onFinish }) {
  const [phase, setPhase] = useState('enter'); // 'enter' → 'visible' → 'exit'

  useEffect(() => {
    // Phase 1: Logo zooms in and fades in (0 → 1s)
    // Phase 2: Logo stays visible (1s → 2.2s)
    const visibleTimer = setTimeout(() => setPhase('visible'), 1000);

    // Phase 3: Logo fades out (2.2s → 3s)
    const exitTimer = setTimeout(() => setPhase('exit'), 2200);

    // Phase 4: Splash screen removed from DOM (3s)
    const finishTimer = setTimeout(() => onFinish(), 3000);

    return () => {
      clearTimeout(visibleTimer);
      clearTimeout(exitTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div className={`${styles.splash} ${styles[phase]}`}>
      {/* Subtle background glow orbs */}
      <div className={styles.orbOne} />
      <div className={styles.orbTwo} />

      {/* Logo image */}
      <img
        src="/logo.png"
        alt="beHonest"
        className={styles.logo}
      />

      {/* Tagline text */}
      <p className={styles.tagline}>Lost • Found • Returned</p>
    </div>
  );
}

export default SplashScreen;

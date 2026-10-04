/* ============================================================
   AuthLayout.jsx — Split-Panel Layout for Auth Pages
   Left: Branding + feature list  |  Right: Form slot (children)
   Used by: LoginPage, RegisterPage
   ============================================================ */

import { GraduationCap, Bot, Lock, DollarSign, Shield } from 'lucide-react';
import styles from './AuthLayout.module.css';
import Footer from './Footer';

// Feature pills shown on the left branding panel
const FEATURES = [
  { icon: <GraduationCap size={20} />, text: 'College email verified — students only' },
  { icon: <Bot size={20} />, text: 'AI-powered ownership verification' },
  { icon: <Lock size={20} />, text: 'Anonymous until verification completes' },
  { icon: <DollarSign size={20} />, text: 'Fair reward recommendations via AI' },
  { icon: <Shield size={20} />, text: 'Secure escrow payment system' },
];

// AuthLayout wraps an auth page and provides the two-column structure
// `children` = the form card that goes in the right panel
function AuthLayout({ children, tagline }) {
  return (
    <main className={styles.page}>

      {/* ── LEFT PANEL ── Branding */}
      <section className={styles.left} aria-label="Platform information">

        {/* New logo image */}
        <img
          src="/logo.png"
          alt="beHonest logo"
          className={styles.logo}
          fetchpriority="high"
        />

        {/* Tagline — can differ between login/register pages */}
        <p className={styles.tagline}>
          {tagline || 'The AI-powered Lost & Found platform built exclusively for college students. Secure. Fair. Honest.'}
        </p>

        {/* Feature pill list */}
        <ul className={styles.features} role="list">
          {FEATURES.map((f, i) => (
            <li key={i} className={styles.featureItem}>
              <span className={styles.featureIcon} aria-hidden="true">{f.icon}</span>
              <span className={styles.featureText}>{f.text}</span>
            </li>
          ))}
        </ul>

      </section>

      {/* ── RIGHT PANEL ── Form slot */}
      <section className={styles.right} aria-label="Authentication form">
        {/* Mobile Header (Hidden on Desktop) */}
        <div className={styles.mobileHeader}>
          <img
            src="/logo.png"
            alt="beHonest logo"
            className={styles.logoMobile}
            fetchpriority="high"
          />
        </div>
        
        
        {children}
        <div style={{ marginTop: 'auto', paddingTop: '40px' }}>
          <Footer />
        </div>
      </section>

    </main>
  );
}

export default AuthLayout;

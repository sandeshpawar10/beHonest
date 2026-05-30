/* ============================================================
   AuthLayout.jsx — Split-Panel Layout for Auth Pages
   Left: Branding + feature list  |  Right: Form slot (children)
   Used by: LoginPage, RegisterPage
   ============================================================ */

import styles from './AuthLayout.module.css';

// Feature pills shown on the left branding panel
const FEATURES = [
  { icon: '🎓', text: 'College email verified — students only' },
  { icon: '🤖', text: 'AI-powered ownership verification' },
  { icon: '🔒', text: 'Anonymous until verification completes' },
  { icon: '💰', text: 'Fair reward recommendations via AI' },
  { icon: '🛡️', text: 'Secure escrow payment system' },
];

// AuthLayout wraps an auth page and provides the two-column structure
// `children` = the form card that goes in the right panel
function AuthLayout({ children, tagline }) {
  return (
    <main className={styles.page}>

      {/* ── LEFT PANEL ── Branding */}
      <section className={styles.left} aria-label="Platform information">

        {/* Floating logo */}
        <img
          src="/logo.png"
          alt="beHonest logo"
          className={styles.logo}
        />

        {/* Platform name with gradient text */}
        <h2 className={styles.brandName}>beHonest</h2>

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
        {children}
      </section>

    </main>
  );
}

export default AuthLayout;

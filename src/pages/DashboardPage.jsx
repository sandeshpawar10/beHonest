/* ============================================================
   DashboardPage.jsx — Protected Dashboard Page
   Route: /dashboard (requires auth — enforced by ProtectedRoute in App.jsx)
   Features: sticky navbar, user avatar, verified banner,
             animated stat counters, action cards grid
   ============================================================ */

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './DashboardPage.module.css';

// ── Action cards data ──────────────────────────────────────────
// Describes each feature card on the dashboard
// `ready: false` shows a "Coming Next" badge
const ACTION_CARDS = [
  {
    id: 'card-lost',
    icon: '🔍',
    title: 'Report Lost Item',
    desc: 'Describe what you lost, when and where. Upload a photo if available. AI matches it against found listings.',
    ready: false,
    comingLabel: 'Coming Next',
  },
  {
    id: 'card-found',
    icon: '📦',
    title: 'Report Found Item',
    desc: 'Found something on campus? Upload a photo, description, and location. AI validates your image.',
    ready: false,
    comingLabel: 'Coming Next',
  },
  {
    id: 'card-verify',
    icon: '🤖',
    title: 'AI Ownership Verification',
    desc: 'Claim an item by answering AI-generated questions. Confidence score determines ownership.',
    ready: false,
    comingLabel: 'Coming Soon',
  },
  {
    id: 'card-reward',
    icon: '💰',
    title: 'Smart Reward System',
    desc: 'AI recommends a fair reward based on item value. Deposited in escrow — released after handover.',
    ready: false,
    comingLabel: 'Coming Soon',
  },
];

// ── Stat data ──────────────────────────────────────────────────
const STATS = [
  { id: 'stat-found',    target: 42,  label: 'Items Found & Returned' },
  { id: 'stat-active',   target: 8,   label: 'Active Lost Reports'    },
  { id: 'stat-students', target: 127, label: 'Verified Students'      },
];

// ── Custom hook: animated number counter ──────────────────────
// Counts from 0 to `target` over `duration` ms using requestAnimationFrame
function useCountUp(target, duration = 1500) {
  const [count, setCount] = useState(0); // Current displayed number
  const started = useRef(false);         // Prevents re-running the animation

  useEffect(() => {
    if (started.current) return; // Don't restart if already running
    started.current = true;

    const startTime = performance.now(); // Animation start timestamp

    function tick(currentTime) {
      const elapsed  = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1); // 0 to 1

      // Ease-out cubic: fast start, slows to a stop
      const eased  = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased);

      setCount(current); // Update displayed number

      if (progress < 1) requestAnimationFrame(tick); // Continue until done
    }

    requestAnimationFrame(tick); // Kick off the animation loop
  }, [target, duration]);

  return count;
}

// ── StatCard component ─────────────────────────────────────────
// Renders a single stat number with a count-up animation
function StatCard({ target, label }) {
  const count = useCountUp(target); // Animated count value

  return (
    <div className={styles.statCard}>
      <span className={styles.statNumber}>{count}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

// ── DashboardPage component ────────────────────────────────────
function DashboardPage() {
  const { session, logout } = useAuth(); // Get current session and logout function

  // Extract user's first name for the personalized greeting
  const firstName = session?.fullName?.split(' ')[0] || 'Student';

  return (
    <div className={styles.page}>

      {/* ── STICKY TOP NAVBAR ── */}
      <nav className={styles.navbar} role="navigation" aria-label="Main navigation">

        {/* Left: Logo + brand name */}
        <div className={styles.navBrand}>
          <img src="/logo.png" alt="beHonest" className={styles.navLogo} />
          <span className={styles.navName}>beHonest</span>
        </div>

        {/* Right: User pill + logout button */}
        <div className={styles.navRight}>

          {/* User pill: avatar initials + full name + verified badge */}
          <div className={styles.userPill} id="user-pill" aria-label="Logged in user">
            <div className={styles.avatar} id="user-avatar" aria-hidden="true">
              {session?.avatar || '?'} {/* Initials like "JD" */}
            </div>
            <span id="user-name">{session?.fullName}</span>
            {/* Verified email badge */}
            <span className={styles.verifiedBadge}>✓ Verified</span>
          </div>

          {/* Logout button */}
          <button
            className={styles.logoutBtn}
            onClick={logout}  /* Calls logout() from AuthContext → clears session → redirect */
            id="logout-btn"
            aria-label="Log out"
          >
            Logout
          </button>

        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main className={styles.main} role="main">

        {/* Email verified confirmation banner */}
        <div className={styles.verifiedBanner} role="status" aria-live="polite">
          <span className={styles.checkIcon} aria-hidden="true">✅</span>
          <div>
            <strong>College email verified!</strong>
            {' '}You're signed in as a trusted student on the beHonest network.
            Your identity is protected until ownership is verified.
          </div>
        </div>

        {/* ── Hero / Welcome section ── */}
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Welcome to beHonest,{' '}
            {/* Gradient text for the user's first name */}
            <span className="gradient-text" id="hero-greeting">{firstName}</span> 👋
          </h1>
          <p className={styles.heroSubtitle}>
            Lost something? Found something? Use the platform to report it securely.
            Our AI will handle the rest.
          </p>

          {/* CTA buttons */}
          <div className={styles.ctaRow}>
            <button className={styles.ctaPrimary} id="report-lost-btn" aria-label="Report a lost item">
              🔍 I Lost Something
            </button>
            <button className={styles.ctaGhost} id="report-found-btn" aria-label="Report a found item">
              📦 I Found Something
            </button>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className={styles.statsRow} role="region" aria-label="Platform statistics">
          {STATS.map(stat => (
            <StatCard key={stat.id} target={stat.target} label={stat.label} />
          ))}
        </div>

        {/* ── Action Cards Grid ── */}
        <div className={styles.cardsGrid} role="region" aria-label="Platform features">
          {ACTION_CARDS.map(card => (
            <div
              key={card.id}
              id={card.id}
              className={styles.actionCard}
              tabIndex={0}
              role="button"
              aria-label={card.title}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.click(); }}
            >
              {/* Feature icon (emoji) */}
              <span className={styles.cardIcon} aria-hidden="true">{card.icon}</span>
              <h3 className={styles.cardTitle}>{card.title}</h3>
              <p className={styles.cardDesc}>{card.desc}</p>

              {/* "Coming Next/Soon" badge */}
              {!card.ready && (
                <span className={styles.comingSoon}>{card.comingLabel}</span>
              )}
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}

export default DashboardPage;

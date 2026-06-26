/* ============================================================
   DashboardPage.jsx — Protected Dashboard Page
   Route: /dashboard (requires auth — enforced by ProtectedRoute in App.jsx)
   Features: sticky navbar, user avatar, verified banner,
             animated stat counters, action cards grid
   ============================================================ */

import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // For navigating to other pages on click
import { useAuth } from '../context/AuthContext';
import { getAllFoundItems } from '../utils/itemUtils'; // Get real count of found items
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
    ready: false,          // Not built yet
    comingLabel: 'Coming Next',
    route: null,           // No route yet
  },
  // {
  //   id: 'card-found',
  //   icon: '📦',
  //   title: 'Report Found Item',
  //   desc: 'Found something on campus? Upload a photo, description, and location. Mark blur zones to protect private details.',
  //   ready: true,           // ✅ Built in Feature 2!
  //   comingLabel: null,
  //   route: '/report-found', // Navigate here on click
  // },
  {
    id: 'card-browse',
    icon: '🔎',
    title: 'Browse Found Items',
    desc: 'See all found items reported on campus. Sensitive areas are blurred — only the real owner can recognise their item.',
    ready: true,           // ✅ Built in Feature 2!
    comingLabel: null,
    route: '/found-items', // Navigate here on click
  },
  // {
  //   id: 'card-verify',
  //   icon: '🤖',
  //   title: 'AI Ownership Verification',
  //   desc: 'Claim a found item by answering AI-generated questions. The AI compares your answers and generates a confidence score.',
  //   ready: true,           // ✅ Built in Feature 3!
  //   comingLabel: null,
  //   // route: '/found-items', // Browse items → click Claim → AI quiz
  // },
  // {
  //   id: 'card-reward',
  //   icon: '💰',
  //   title: 'Smart Reward System',
  //   desc: 'AI recommends a fair reward based on item type and value. Reward is deposited into secure escrow before handover.',
  //   ready: true,           // ✅ Built in Feature 4!
  //   comingLabel: null,
  //   // route: '/found-items', // Claim item → verify → proceed to reward
  // },
  {
    id: 'card-escrow',
    icon: '🏦',
    title: 'Escrow Payments',
    desc: 'View and manage your reward transactions. Confirm item receipt to release payment, or request a refund.',
    ready: true,           // ✅ Built in Feature 5!
    comingLabel: null,
    route: '/escrow',      // Direct link to escrow dashboard
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
  const { session, logout } = useAuth();
  const navigate = useNavigate(); // Hook for programmatic navigation

  // Extract user's first name for the personalized greeting
  const firstName = session?.fullName?.split(' ')[0] || 'Student';

  // Get the real count of found items from localStorage
  const foundItemsCount = getAllFoundItems().length;

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
            {/* Lost Something — coming in a future feature */}
            <button
              className={styles.ctaPrimary}
              id="report-lost-btn"
              aria-label="Report a lost item"
              onClick={() => alert('Report Lost feature coming soon!')}
            >
              🔍 I Lost Something
            </button>

            {/* Found Something — links to the new ReportFoundPage */}
            <button
              className={styles.ctaGhost}
              id="report-found-btn"
              aria-label="Report a found item"
              onClick={() => navigate('/report-found')}
            >
              📦 I Found Something
            </button>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className={styles.statsRow} role="region" aria-label="Platform statistics">
          {/* Show real found-items count, rest are placeholder numbers */}
          <StatCard target={foundItemsCount} label="Items Found & Reported" />
          <StatCard target={8}   label="Active Lost Reports" />
          <StatCard target={127} label="Verified Students" />
        </div>

        {/* ── Action Cards Grid ── */}
        <div className={styles.cardsGrid} role="region" aria-label="Platform features">
          {ACTION_CARDS.map(card => (
            <div
              key={card.id}
              id={card.id}
              // If the card has a route, make it clickable; otherwise no cursor
              className={`${styles.actionCard} ${card.ready ? styles.readyCard : ''}`}
              tabIndex={card.ready ? 0 : -1}
              role={card.ready ? 'button' : 'article'}
              aria-label={card.title}
              onClick={() => card.route && navigate(card.route)}
              onKeyDown={e => { if (e.key === 'Enter' && card.route) navigate(card.route); }}
            >
              {/* Feature icon */}
              <span className={styles.cardIcon} aria-hidden="true">{card.icon}</span>
              <h3 className={styles.cardTitle}>{card.title}</h3>
              <p className={styles.cardDesc}>{card.desc}</p>

              {/* "Live" badge for built features */}
              {card.ready && (
                <span className={styles.liveBadge}>✅ Live</span>
              )}

              {/* "Coming Soon" badge for future features */}
              {!card.ready && (
                <span className={styles.comingSoon}>{card.comingLabel}</span>
              )}
            </div>
            
          ))}
        </div>
        {/* <div>
          <h2>Features</h2>
        </div> */}
      </main>
    </div>
  );
}

export default DashboardPage;

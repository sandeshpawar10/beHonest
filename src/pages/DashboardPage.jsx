/* eslint-disable */
/* ============================================================
   DashboardPage.jsx — Protected Dashboard Page
   Route: /dashboard (requires auth — enforced by ProtectedRoute in App.jsx)
   Features: sticky navbar, user avatar, verified banner,
             animated stat counters, action cards grid
   ============================================================ */


import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // For navigating to other pages on click
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Search, Eye, Landmark, PackageOpen, LogOut, ChevronDown } from 'lucide-react';

import NotificationDropdown from '../components/ui/NotificationDropdown';
import ButtonSpinner from '../components/ui/ButtonSpinner';
import styles from './DashboardPage.module.css';

// ── Action cards data ──────────────────────────────────────────
// Describes each feature card on the dashboard
// `ready: false` shows a "Coming Next" badge
const ACTION_CARDS = [
  {
    id: 'card-lost',
    icon: <Search size={28} />,
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
    icon: <Eye size={28} />,
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
    icon: <Landmark size={28} />,
    title: 'Escrow Payments',
    desc: 'View and manage your reward transactions. Confirm item receipt to release payment, or request a refund.',
    ready: true,           // ✅ Built in Feature 5!
    comingLabel: null,
    route: '/escrow',      // Direct link to escrow dashboard
  },
];



// ── DashboardPage component ────────────────────────────────────
function DashboardPage() {
  const { session, logout } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate(); // Hook for programmatic navigation
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [myItems, setMyItems] = useState([]);
  const [myClaims, setMyClaims] = useState([]);
  const [myEscrowIds, setMyEscrowIds] = useState(new Set());
  const menuRef = useRef(null);

  const [hasUpdates, setHasUpdates] = useState(false);

  useEffect(() => {
    const fetchData = () => {
      // Fetch reported items
      fetch(`${import.meta.env.VITE_API_URL || ''}/api/item/my-items`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data.items) {
            setMyItems(prev => {
              if (prev.length > 0) {
                const changed = data.items.some(newItem => {
                  const oldItem = prev.find(i => i._id === newItem._id);
                  return !oldItem || oldItem.status !== newItem.status;
                });
                if (changed && !menuOpen) setHasUpdates(true);
              }
              return data.items;
            });
          }
        })
        .catch(err => console.error("Polling error", err));

      // Fetch claims
      fetch(`${import.meta.env.VITE_API_URL || ''}/api/claim/my-claims`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data.claims) {
            setMyClaims(prev => {
              if (prev.length > 0) {
                const changed = data.claims.some(newClaim => {
                  const oldClaim = prev.find(c => c._id === newClaim._id);
                  return !oldClaim || oldClaim.verdict !== newClaim.verdict;
                });
                if (changed && !menuOpen) setHasUpdates(true);
              }
              return data.claims;
            });
          }
        })
        .catch(err => console.error("Polling claims error", err));

      // Fetch escrows to know which claims are already paid
      fetch(`${import.meta.env.VITE_API_URL || ''}/api/escrow/my-escrows`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data.asOwner) {
            const fundedClaimIds = new Set(data.asOwner.map(e => e.claimId?.toString() || e.claimId?._id?.toString()));
            setMyEscrowIds(fundedClaimIds);
          }
        })
        .catch(err => console.error("Polling escrows error", err));
    };

    // Initial fetch to populate immediately
    fetchData();
    
    if (socket) {
      const handleUpdate = () => {
        if (!menuOpen) setHasUpdates(true);
        fetchData(); // Quick refetch to get latest arrays
      };
      
      socket.on('item_updated', handleUpdate);
      socket.on('claim_updated', handleUpdate);
      socket.on('escrow_updated', handleUpdate);
      
      return () => {
        socket.off('item_updated', handleUpdate);
        socket.off('claim_updated', handleUpdate);
        socket.off('escrow_updated', handleUpdate);
      };
    }
  }, [menuOpen, socket]);

  useEffect(() => {
    if (menuOpen) {
      // eslint-disable-next-line
      // eslint-disable-next-line
      setHasUpdates(false);
    }
  }, [menuOpen]);

  const handleLogoutClick = async () => {
    setLoggingOut(true);
    await logout();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Trap the hardware back button: if pressed on dashboard, log the user out.
  useEffect(() => {
    const handlePopState = () => {
      if (window.confirm("Do you want to log out?")) {
        logout();
      } else {
        // Push state again to prevent going back
        window.history.pushState(null, '', window.location.pathname);
      }
    };
    
    // Push a dummy state so popstate fires when they press back
    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    
    return () => {

      window.removeEventListener('popstate', handlePopState);
    };
  }, [logout]);

  return (
    <div className={styles.page}>

      {/* ── STICKY TOP NAVBAR ── */}
      <nav className={styles.navbar} role="navigation" aria-label="Main navigation">

        {/* Left: Logo + brand name */}
        <div className={styles.navBrand}>
          <img src="/logo.png" alt="beHonest" className={styles.navLogo} />
          <span className={styles.navName}>beHonest</span>
        </div>

        {/* Right: Notifications + User pill + logout button */}
        <div className={styles.navRight} style={{ display: 'flex', alignItems: 'center' }}>
          
          <NotificationDropdown />
          
          {/* User Profile Dropdown */}
          <div className={styles.userMenuWrapper} ref={menuRef}>
            <button
              className={`${styles.avatar} ${hasUpdates ? styles.hasUpdatesPulse : ''}`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="User menu"
              aria-expanded={menuOpen}
              style={{ position: 'relative' }}
            >
              <span className={styles.avatarInitial}>
                {session?.username ? session.username.charAt(0).toUpperCase() : '?'}
              </span>
              <ChevronDown size={14} className={styles.avatarChevron} />
              {hasUpdates && (
                <span style={{ 
                  position: 'absolute', top: '-2px', right: '-2px', width: '12px', height: '12px', 
                  backgroundColor: '#ff4757', borderRadius: '50%', border: '2px solid white' 
                }}></span>
              )}
            </button>
            
            {menuOpen && (
              <div className={styles.dropdown} style={{ minWidth: 'min(300px, 90vw)' }}>
                <div className={styles.dropdownName}>{session?.username}</div>
                <div className={styles.dropdownEmail}>{session?.email}</div>
                <div style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
                  <strong style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>My Reported Items</strong>
                  {myItems.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)' }}>No items reported.</div>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '150px', overflowY: 'auto' }}>
                      {myItems.map(item => (
                        <li key={item._id} style={{ marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                          <div style={{ fontWeight: '500' }}>{item.shortTitle}</div>
                          <div style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                            <span style={{
                              padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                              backgroundColor: item.status === 'pending_admin_review' ? '#fff3cd' : item.status === 'rejected' ? '#f8d7da' : '#d1e7dd',
                              color: item.status === 'pending_admin_review' ? '#856404' : item.status === 'rejected' ? '#721c24' : '#0f5132'
                            }}>
                              {item.status === 'pending_admin_review' ? 'In Review' : item.status === 'rejected' ? 'Rejected' : 'Live'}
                            </span>
                          </div>
                          {item.status === 'rejected' && item.adminFeedback && (
                            <div style={{ fontSize: '0.75rem', color: '#721c24', marginTop: '4px', fontStyle: 'italic', background: '#f8d7da', padding: '4px', borderRadius: '4px' }}>
                              <strong>Reason:</strong> {item.adminFeedback}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className={styles.dropdownDivider}></div>
                
                <div style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
                  <strong style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>My Claims</strong>
                  {myClaims.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)' }}>No claims made.</div>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '150px', overflowY: 'auto' }}>
                      {myClaims.map(claim => {
                        const isFunded = myEscrowIds.has(claim._id);
                        return (
                          <li key={claim._id} style={{ marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                            <div style={{ fontWeight: '500' }}>{claim.itemId?.shortTitle || 'Item'}</div>
                            <div style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', marginBottom: '8px' }}>
                              <span style={{
                                padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold',
                                backgroundColor: claim.verdict === 'pending_admin_review' ? '#fff3cd' : claim.verdict === 'rejected' ? '#f8d7da' : claim.verdict === 'verified' ? (isFunded ? '#d1e7dd' : '#cff4fc') : '#d1e7dd',
                                color: claim.verdict === 'pending_admin_review' ? '#856404' : claim.verdict === 'rejected' ? '#721c24' : claim.verdict === 'verified' ? (isFunded ? '#0f5132' : '#055160') : '#0f5132'
                              }}>
                                {claim.verdict === 'pending_admin_review' ? 'In Review' : claim.verdict === 'rejected' ? 'Rejected' : claim.verdict === 'verified' ? (isFunded ? 'Escrow Funded' : 'Payment Pending') : 'Processed'}
                              </span>
                            </div>
                            
                            {claim.verdict === 'rejected' && claim.adminFeedback && (
                              <div style={{ fontSize: '0.75rem', color: '#721c24', marginTop: '4px', fontStyle: 'italic', background: '#f8d7da', padding: '4px', borderRadius: '4px' }}>
                                <strong>Reason:</strong> {claim.adminFeedback}
                              </div>
                            )}
                            
                            {claim.verdict === 'verified' && claim.itemId?._id && !isFunded && (
                              <button 
                                onClick={() => {
                                  setMenuOpen(false);
                                  navigate(`/reward/${claim.itemId._id}`, { state: { claimId: claim._id } });
                                }}
                                style={{ 
                                  width: '100%', padding: '6px', background: '#0d6efd', color: 'white', 
                                  border: 'none', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' 
                                }}
                              >
                                💳 Pay Escrow Reward
                              </button>
                            )}
                            
                            {claim.verdict === 'verified' && isFunded && (
                              <button 
                                onClick={() => {
                                  setMenuOpen(false);
                                  navigate('/escrow');
                                }}
                                style={{ 
                                  width: '100%', padding: '6px', background: '#198754', color: 'white', 
                                  border: 'none', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' 
                                }}
                              >
                                💸 View Escrow
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className={styles.dropdownDivider}></div>
                <button
                  className={styles.dropdownLogoutBtn}
                  onClick={handleLogoutClick}
                  id="logout-btn"
                  aria-label="Log out"
                  disabled={loggingOut}
                >
                  {loggingOut ? <ButtonSpinner /> : <><LogOut size={16} /> Logout</>}
                </button>
              </div>
            )}
          </div>

        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main className={styles.main} role="main">

        {/* Email verified confirmation banner */}
        {/* <div className={styles.verifiedBanner} role="status" aria-live="polite">
          <span className={styles.checkIcon} aria-hidden="true">✅</span>
          <div>
            <strong>College email verified!</strong>
            {' '}You're signed in as a trusted student on the beHonest network.
            Your identity is protected until ownership is verified.
          </div>
        </div> */}

        {/* ── Hero / Welcome section ── */}
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Welcome to beHonest,{' '}
            {/* Gradient text for the user's first name */}
            <span className="gradient-text" id="hero-greeting">{session.username}</span>
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
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Search size={18} /> I Lost Something
            </button>

            {/* Found Something — links to the new ReportFoundPage */}
            <button
              className={styles.ctaGhost}
              id="report-found-btn"
              aria-label="Report a found item"
              onClick={() => navigate('/report-found')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <PackageOpen size={18} /> I Found Something
            </button>
          </div>
        </div>

        {/* ── Stats Row ── */}

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
              {/* {card.ready && (
                <span className={styles.liveBadge}>✅ Live</span>
              )} */}

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


/* ============================================================
   FoundItemsPage.jsx
   Route: /found-items  (public — anyone logged in can view)

   PURPOSE:
   Shows all reported found items as cards.
   Each card shows:
   - Category icon + title + location
   - The BLURRED image (using BlurableImage component)
   - A "Claim This Item" button (ownership verification — coming soon)

   This is the page where the PARTIAL IMAGE REVEAL feature is visible.
   The real owner can recognise their item even through the blur,
   but a random person cannot guess the private details.
   ============================================================ */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BlurableImage   from '../components/ui/BlurableImage';
import { getAllFoundItems, CATEGORY_CONFIG } from '../utils/itemUtils';
import styles from './FoundItemsPage.module.css';

function FoundItemsPage() {
  const navigate = useNavigate();

  // Load all found items from localStorage every time the component renders
  const allItems = getAllFoundItems();

  // Filter state — which category is selected ('' means show all)
  const [activeFilter, setActiveFilter] = useState('');

  // Search text state — filter by title or location
  const [searchText, setSearchText] = useState('');

  /*
    filteredItems:
    Start with all items, then apply:
    1. Category filter (if one is selected)
    2. Search text filter (matches title or location)
  */
  const filteredItems = allItems
    .filter(item => {
      // If a category filter is active, only show items of that category
      if (activeFilter && item.category !== activeFilter) return false;

      // If search text is entered, check if title or location contains it
      if (searchText.trim()) {
        const query = searchText.toLowerCase();
        const matchTitle    = item.title.toLowerCase().includes(query);
        const matchLocation = item.location.toLowerCase().includes(query);
        if (!matchTitle && !matchLocation) return false;
      }

      return true; // Item passes all filters
    })
    // Sort by newest first (foundAt is an ISO date string, so string compare works)
    .sort((a, b) => new Date(b.foundAt) - new Date(a.foundAt));

  /* ── Format date for display ── */
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    }); // e.g. "2 Jun 2024"
  };

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className={styles.page}>

      {/* ── Page header ── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/dashboard')}>
          ← Dashboard
        </button>

        <div className={styles.headerText}>
          <h1 className={styles.title}>📦 Found Items</h1>
          <p className={styles.subtitle}>
            Sensitive details are blurred. Only the real owner will recognise their item.
          </p>
        </div>

        {/* Report a found item button */}
        <button
          className={styles.reportBtn}
          onClick={() => navigate('/report-found')}
          id="go-to-report-found"
        >
          + Report Found Item
        </button>
      </div>

      {/* ── Search bar ── */}
      <div className={styles.searchBar}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by item name or location..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
        />
        {/* Clear search button */}
        {searchText && (
          <button className={styles.clearSearch} onClick={() => setSearchText('')}>
            ✕
          </button>
        )}
      </div>

      {/* ── Category filter tabs ── */}
      <div className={styles.filters}>

        {/* "All" tab */}
        <button
          className={`${styles.filterTab} ${activeFilter === '' ? styles.activeTab : ''}`}
          onClick={() => setActiveFilter('')}
        >
          🗂️ All
        </button>

        {/* One tab per category */}
        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
          <button
            key={key}
            className={`${styles.filterTab} ${activeFilter === key ? styles.activeTab : ''}`}
            onClick={() => setActiveFilter(key)}
          >
            {config.icon} {config.label}
          </button>
        ))}
      </div>

      {/* ── Results count ── */}
      <p className={styles.resultsCount}>
        {filteredItems.length === 0
          ? 'No items found'
          : `Showing ${filteredItems.length} item${filteredItems.length > 1 ? 's' : ''}`
        }
      </p>

      {/* ── Items grid OR empty state ── */}
      {filteredItems.length === 0 ? (

        /* Empty state — nothing to show */
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>🔎</span>
          <h3>No items here yet</h3>
          <p>
            {allItems.length === 0
              ? 'Nobody has reported a found item yet. Be the first!'
              : 'Try changing your search or filter.'
            }
          </p>
          {allItems.length === 0 && (
            <button
              className={styles.emptyBtn}
              onClick={() => navigate('/report-found')}
            >
              Report a Found Item
            </button>
          )}
        </div>

      ) : (

        /* Grid of item cards */
        <div className={styles.grid}>
          {filteredItems.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              formatDate={formatDate}
            />
          ))}
        </div>

      )}
    </div>
  );
}

/* ============================================================
   ItemCard Component
   Renders a single found-item card.
   This is a sub-component inside this file (not exported).
   ============================================================ */
function ItemCard({ item, formatDate }) {
  const navigate = useNavigate(); // Need this to navigate to the claim page

  // Track whether we are showing the full image or the blurred one
  // (Default: blurred for public view)
  const [showFull, setShowFull] = useState(false);

  // Get category config for icon display
  const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.other;

  return (
    <div className={styles.card}>

      {/* ── Image section ── */}
      <div className={styles.imageSection}>

        {/*
          KEY FEATURE: Partial Image Reveal
          
          If showFull is false  → use BlurableImage (hides sensitive areas)
          If showFull is true   → show the raw image (full reveal)

          In the real platform:
          - Public always sees the blurred version
          - Full image is only shown AFTER the owner proves identity via AI quiz
          - Here we add a toggle for demo purposes
        */}
        {showFull ? (
          <img
            src={item.imageData}
            alt={item.title}
            className={styles.fullImage}
          />
        ) : (
          <BlurableImage
            imageSrc={item.imageData}
            blurZones={item.blurZones}
            alt={item.title}
            blurStrength={14}
          />
        )}

        {/* Demo toggle button — shows blur/unblur */}
        {item.blurZones && item.blurZones.length > 0 && (
          <button
            className={styles.toggleBtn}
            onClick={() => setShowFull(f => !f)}
            title={showFull ? 'Show blurred (public view)' : 'Show full image (owner only)'}
          >
            {showFull ? '🔒 Show Public View' : '👁️ Show Full (Demo)'}
          </button>
        )}

        {/* Category badge on the image */}
        <span className={styles.categoryBadge}>
          {catConfig.icon} {catConfig.label}
        </span>
      </div>

      {/* ── Card content ── */}
      <div className={styles.cardBody}>
        {/* Item title */}
        <h3 className={styles.itemTitle}>{item.title}</h3>

        {/* Location + date row */}
        <div className={styles.metaRow}>
          <span>📍 {item.location}</span>
          <span>📅 {formatDate(item.foundAt)}</span>
        </div>

        {/* Description (truncated to 2 lines via CSS) */}
        {/* <p className={styles.description}>{item.description}</p> */}

        {/* Blur zones info */}
        {item.blurZones && item.blurZones.length > 0 ? (
          <div className={styles.blurInfo}>
            🔒 {item.blurZones.length} sensitive area{item.blurZones.length > 1 ? 's' : ''} are hidden to protect the owner's privacy.
          </div>
        ) : (
          <div className={styles.noBlurInfo}>
            ⚠️ No blur zones — full image is visible.
          </div>
        )}

        {/* Claim button — NOW navigates to the AI verification page! */}
        <button
          className={styles.claimBtn}
          id={`claim-btn-${item.id}`}
          onClick={() => navigate(`/claim/${item.id}`)}
        >
          🙋 This is Mine — Claim It
          <span className={styles.claimNote}>AI will verify your ownership</span>
        </button>
      </div>

    </div>
  );
}

export default FoundItemsPage;

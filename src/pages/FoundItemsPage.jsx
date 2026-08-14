/* ============================================================
   FoundItemsPage.jsx
   Route: /found-items  (public — anyone logged in can view)

   PURPOSE:
   Shows all reported found items using a scroll-stack card
   animation. Cards stick to the top and overlap as you scroll.
   ============================================================ */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BlurableImage   from '../components/ui/BlurableImage';
import { getAllFoundItems, CATEGORY_CONFIG } from '../utils/itemUtils';
import styles from './FoundItemsPage.module.css';

function FoundItemsPage() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [allItems, setAllItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filter state — which category is selected ('' means show all)
  const [activeFilter, setActiveFilter] = useState('');

  // Search text state — filter by title or location
  const [searchText, setSearchText] = useState('');

  useEffect(()=>{
    const fetchItems = async ()=>{
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/item/getAllFoundItems`,{
            method: 'GET',
            credentials: 'include'
          })
          if(!response.ok){
            setError("Could not fetch items from the server.")
            setLoading(false)
            return
          }
          const data = await response.json();
          setAllItems(data.items || data || [])
        }
        catch (error) {
          console.error("Error occurred during fetching items:", error);
          setError("A network error occurred")
        }
        finally{
          setLoading(false)
        }
    }
    fetchItems()
  },[])

  const filteredItems = allItems
    .filter(item => {
      if (activeFilter && item.category !== activeFilter) return false;

      if (searchText.trim()) {
        const query = searchText.toLowerCase();
        const matchTitle    = (item.shortTitle || '').toLowerCase().includes(query);
        const matchLocation = (item.location || '').toLowerCase().includes(query);
        if (!matchTitle && !matchLocation) return false;
      }

      return true;
    })
    .sort((a, b) => new Date(b.dateFound) - new Date(a.dateFound));

  /* ── Format date for display ── */
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  /* ── Render ── */
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
            Scroll through the stack to find your item. Each card stacks as you scroll.
          </p>
        </div>

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
        {searchText && (
          <button className={styles.clearSearch} onClick={() => setSearchText('')}>
            ✕
          </button>
        )}
      </div>

      {/* ── Category filter tabs ── */}
      <div className={styles.filters}>
        <button
          className={`${styles.filterTab} ${activeFilter === '' ? styles.activeTab : ''}`}
          onClick={() => setActiveFilter('')}
        >
          🗂️ All
        </button>

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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', fontSize: '1.2rem', color: '#888' }}>
          Loading items...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#ff6b6b' }}>
          {error}
        </div>
      ) : (
        <>
          <p className={styles.resultsCount}>
            {filteredItems.length === 0
              ? 'No items found'
              : `Showing ${filteredItems.length} item${filteredItems.length > 1 ? 's' : ''}`
            }
          </p>

          {filteredItems.length === 0 ? (
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
            <div className={styles.simpleList}>
              {filteredItems.map((item) => (
                <StackCard
                  key={item._id}
                  item={item}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================
   StackCard Component (Inner content)
   ============================================================ */
function StackCard({ item, formatDate }) {
  const navigate = useNavigate();
  
  const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.other;
  const { session } = useAuth();

  const finderEmail = item.reportedBy?.email || item.foundBy || '';
  const finderDomain = finderEmail ? finderEmail.split('@')[1] : null;
  const userDomain = session?.email ? session.email.split('@')[1] : null;

  const isSameCollege = finderDomain && userDomain && (finderDomain.toLowerCase() === userDomain.toLowerCase());
  const isFinder = session?.email && finderEmail && (session.email.toLowerCase() === finderEmail.toLowerCase());
  const isClaimed = item.status === 'claimed';

  const [showFull, setShowFull] = useState(false);

  return (
    <div className={styles.cardInner}>
      {/* Left: Image */}
      <div className={styles.cardImage}>
            {showFull ? (
              <img
                src={item.images && item.images.length > 0 ? item.images[0] : ''}
                alt={item.shortTitle}
                className={styles.fullImage}
              />
            ) : (
              <BlurableImage
                imageSrc={item.images && item.images.length > 0 ? item.images[0] : ''}
                blurZones={item.blurZones || []}
                alt={item.shortTitle}
                blurStrength={14}
              />
            )}

            {/* Demo toggle — only for the finder */}
            {item.blurZones && item.blurZones.length > 0 && session?.email === item.reportedBy?.email && (
              <button
                className={styles.toggleBtn}
                onClick={() => setShowFull(f => !f)}
              >
                {showFull ? '🔒' : '👁️'}
              </button>
            )}
          </div>

          {/* Right: Info */}
          <div className={styles.cardInfo}>
            {/* Top row: category + status */}
            <div className={styles.cardTopRow}>
              <span className={styles.categoryPill}>
                {catConfig.icon} {catConfig.label}
              </span>
              {isClaimed && (
                <span className={styles.claimedBadge}>🔐 Claimed</span>
              )}
            </div>

            {/* Title */}
            <h3 className={styles.cardTitle}>{item.shortTitle}</h3>

            {/* Location + Date */}
            <div className={styles.cardMeta}>
              <span>📍 {item.location}</span>
              <span>📅 {formatDate(item.dateFound)}</span>
            </div>

            {/* Blur info */}
            {item.blurZones && item.blurZones.length > 0 ? (
              <div className={styles.blurInfo}>
                🔒 {item.blurZones.length} sensitive area{item.blurZones.length > 1 ? 's' : ''} hidden
              </div>
            ) : (
              <div className={styles.noBlurInfo}>
                ⚠️ No blur zones — full image visible
              </div>
            )}

            {/* Claim button */}
            <button
              className={styles.claimBtn}
              id={`claim-btn-${item._id}`}
              onClick={() => {
                if (isClaimed || isFinder) return;
                if (isSameCollege) {
                  navigate(`/claim/${item._id}`);
                } else {
                  alert('Sorry, you can only claim items found by students from your own college domain.');
                }
              }}
              disabled={isClaimed || !isSameCollege || isFinder}
              style={{
                opacity: (isClaimed || !isSameCollege || isFinder) ? 0.6 : 1,
                cursor: (isClaimed || !isSameCollege || isFinder) ? 'not-allowed' : 'pointer'
              }}
            >
              {isClaimed
                ? '🔐 Already Claimed'
                : isFinder
                  ? '✅ You reported this'
                  : isSameCollege
                    ? '🙋 This is Mine — Claim It'
                    : '🚫 Not from your college'}
              {!isClaimed && !isFinder && isSameCollege && <span className={styles.claimNote}>AI will verify your ownership</span>}
            </button>
          </div>
        </div>
  );
}

export default FoundItemsPage;

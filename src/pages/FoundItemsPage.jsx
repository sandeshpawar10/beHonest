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

  // Filter state
  const [activeFilter, setActiveFilter] = useState('');
  
  // Search text state
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalItems, setTotalItems] = useState(0);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 500);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [activeFilter, debouncedSearch]);

  const fetchItems = async (pageNum) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setIsLoadingMore(true);

      const queryParams = new URLSearchParams({
        page: pageNum,
        limit: 10,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(activeFilter && { category: activeFilter })
      });

      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/item/getAllFoundItems?${queryParams}`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        setError("Could not fetch items from the server.");
        return;
      }
      
      const data = await response.json();
      const newItems = data.items || [];
      
      if (pageNum === 1) {
        setAllItems(newItems);
      } else {
        setAllItems(prev => [...prev, ...newItems]);
      }
      
      setHasMore(data.pagination?.hasMore || false);
      setTotalItems(data.pagination?.totalItems || 0);
      
    } catch (error) {
      console.error("Error occurred during fetching items:", error);
      setError("A network error occurred");
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchItems(page);
  }, [page, activeFilter, debouncedSearch]);

  // We don't filter client-side anymore; backend handles it.
  const filteredItems = allItems;

  /* ── Format date for display ── */
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm("Are you sure you want to delete this found item post?")) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/item/delete/${itemId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setAllItems(prev => prev.filter(item => item._id !== itemId));
        setTotalItems(prev => Math.max(0, prev - 1));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete item.");
      }
    } catch (err) {
      console.error(err);
      alert("A network error occurred.");
    }
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
            {totalItems === 0
              ? 'No items found'
              : `Showing ${filteredItems.length} of ${totalItems} item${totalItems > 1 ? 's' : ''}`
            }
          </p>

          {filteredItems.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>🔎</span>
              <h3>No items here yet</h3>
              <p>
                {(!activeFilter && !debouncedSearch)
                  ? 'Nobody has reported a found item yet. Be the first!'
                  : 'Try changing your search or filter.'
                }
              </p>
              {(!activeFilter && !debouncedSearch) && (
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
                  onDelete={() => handleDelete(item._id)}
                />
              ))}
              
              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                  <button 
                    className={styles.reportBtn} 
                    onClick={() => setPage(p => p + 1)}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
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
function StackCard({ item, formatDate, onDelete }) {
  const navigate = useNavigate();
  
  const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.other;
  const { session } = useAuth();

  const isFinder = Boolean(item.isFinder);
  const isSameCollege = Boolean(item.isSameCollege);
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
            {item.blurZones && item.blurZones.length > 0 && isFinder && (
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
            
            {/* Delete button for finder */}
            {isFinder && !isClaimed && (
              <button 
                onClick={onDelete}
                style={{
                  marginTop: '10px',
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 77, 109, 0.3)',
                  backgroundColor: 'rgba(255, 77, 109, 0.05)',
                  color: '#ff4d6d',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: '0.9rem'
                }}
              >
                🗑️ Delete Post
              </button>
            )}
          </div>
        </div>
  );
}

export default FoundItemsPage;

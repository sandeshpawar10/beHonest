/* ============================================================
   RewardPage.jsx
   Route: /reward/:itemId  (protected — must be logged in)

   PURPOSE:
   After the AI verifies ownership (score ≥ 80%), the owner
   comes here to set a reward for the finder.

   FLOW:
   1. Load the item from localStorage
   2. Let the user pick the correct reward CATEGORY (e.g. "Watch")
   3. AI recommends a fair reward within the category's range
   4. User can ADJUST the reward with a slider (but ONLY within the range)
   5. User confirms → reward is "deposited" into escrow
   ============================================================ */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  REWARD_CATEGORIES,     // All item type reward ranges
  calculateReward,       // AI recommendation function
} from '../utils/rewardUtils';
import styles from './RewardPage.module.css';
import { load } from '@cashfreepayments/cashfree-js';

function RewardPage() {
  const { itemId }  = useParams();   // Item ID from URL
  const navigate    = useNavigate();
  const location    = useLocation();
  const { session } = useAuth();
  
  const claimId = location.state?.claimId;

  // ── State ─────────────────────────────────────────────────
  const [item, setItem]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  // Step: 'select' = pick category, 'recommend' = see AI result, 'done' = escrow created
  const [step, setStep]               = useState('select');

  // Selected reward category key (e.g. "watch", "laptop")
  const [selectedCategory, setSelectedCategory] = useState('');

  // Search text for filtering reward categories
  const [searchCategory, setSearchCategory]     = useState('');

  // AI recommendation result
  const [recommendation, setRecommendation]     = useState(null);

  // The reward amount chosen by the user (via slider)
  const [chosenReward, setChosenReward]         = useState(0);

  // Escrow record after confirmation
  const [escrowRecord, setEscrowRecord]         = useState(null);

  // Processing state for the confirm button
  const [processing, setProcessing]             = useState(false);

  // Cashfree SDK instance
  const [cashfree, setCashfree]                 = useState(null);

  // ── Load item on mount ────────────────────────────────────
  useEffect(() => {
    const fetchItem = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/item/getFoundItemById/${itemId}`, {
          credentials: 'include'
        });

        if (!response.ok) {
          setError('Item not found.');
          setLoading(false);
          return;
        }

        const data = await response.json();
        setItem(data.items || data.item || data);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError('Failed to fetch item details.');
      } finally {
        setLoading(false);
      }
    };
    
    if (!claimId) {
      setTimeout(() => {
        setError('Invalid claim session. You must start the claim process from the beginning. Please go back to Found Items and claim the item again.');
        setLoading(false);
      }, 0);
      return;
    }

    fetchItem();
    
    // Initialize Cashfree SDK
    const initCashfree = async () => {
      try {
        const cf = await load({
          mode: import.meta.env.VITE_CASHFREE_ENV === "PRODUCTION" ? "production" : "sandbox"
        });
        setCashfree(cf);
      } catch (err) {
        console.error("Failed to load Cashfree SDK", err);
      }
    };
    initCashfree();

  }, [itemId, claimId]);

  // ── Handle category selection ─────────────────────────────
  const handleCategorySelect = (categoryKey) => {
    setSelectedCategory(categoryKey);
    setError('');
  };

  // ── Generate AI recommendation ────────────────────────────
  const handleGetRecommendation = () => {
    if (!selectedCategory) {
      setError('Please select an item type first.');
      return;
    }

    // Call the AI reward calculation
    const result = calculateReward(item, selectedCategory, 80);

    setRecommendation(result);
    setChosenReward(result.recommendedReward); // Default slider to AI recommendation
    setStep('recommend');
    setError('');
    window.scrollTo(0, 0);
  };

  // ── Confirm and create escrow ─────────────────────────────
  const handleConfirmReward = async () => {
    if (!claimId) {
      setError('Invalid claim session. Please go back to Found Items and restart your claim.');
      return;
    }
    
    setProcessing(true);

    try {
      if (!cashfree) {
        throw new Error('Payment gateway SDK failed to load. Are you online?');
      }

      // 2. Create Order
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/escrow/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          itemId: item._id,
          claimId,
          amount: chosenReward,
          rewardCategory: selectedCategory
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create payment order. Are your API keys correct?');
      }

      const data = await response.json();
      const { paymentSessionId, escrowId } = data;

      // 3. Initialize Cashfree Checkout
      let checkoutOptions = {
        paymentSessionId: paymentSessionId,
        redirectTarget: "_self", // Use _self for mobile reliability
      };
      
      // We do not await this, as the browser will redirect to the Cashfree payment page.
      // After payment, Cashfree will redirect back to /escrow?verify_order_id=...
      cashfree.checkout(checkoutOptions);


    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to process escrow. Please try again.');
    } finally {
      setProcessing(false);
      window.scrollTo(0, 0);
    }
  };

  // ── Filtered categories for search ────────────────────────
  const filteredCategories = Object.entries(REWARD_CATEGORIES).filter(
    ([key, cat]) => {
      if (!searchCategory.trim()) return true;
      const q = searchCategory.toLowerCase();
      return cat.label.toLowerCase().includes(q) || key.includes(q);
    }
  );

  // ── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.centerMsg}>
        <div className={styles.spinner} />
        <p>Loading...</p>
      </div>
    );
  }

  // ── Error state (item not found) ──────────────────────────
  if (error && !item) {
    return (
      <div className={styles.centerMsg}>
        <span style={{ fontSize: '3rem' }}>⚠️</span>
        <h2>{error}</h2>
        <Link to="/found-items" className={styles.linkBtn}>← Back to Found Items</Link>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Top bar */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate('/found-items')}>
          ← Back
        </button>
        <h1 className={styles.pageTitle}>💰 AI Reward Recommendation</h1>
      </div>

      {/* Item summary strip */}
      <div className={styles.itemStrip}>
        <span className={styles.stripIcon}>📦</span>
        <div>
          <strong>{item.shortTitle}</strong>
          <span className={styles.stripMeta}> · 📍 {item.location}</span>
        </div>
      </div>

      {/* ══════════ STEP 1: Select Category ══════════ */}
      {step === 'select' && (
        <div className={styles.stepCard}>
          <h2 className={styles.stepTitle}>🏷️ Step 1: Select Item Type</h2>
          <p className={styles.stepDesc}>
            Choose the category that best matches the item. Each category has a
            fair reward range set by the platform. The AI will recommend an
            amount within this range.
          </p>

          {/* Error */}
          {error && <div className={styles.errorAlert}>⚠️ {error}</div>}

          {/* Search bar */}
          <div className={styles.catSearch}>
            <span>🔍</span>
            <input
              type="text"
              placeholder="Search categories..."
              value={searchCategory}
              onChange={e => setSearchCategory(e.target.value)}
              className={styles.catSearchInput}
            />
          </div>

          {/* Category grid */}
          <div className={styles.catGrid}>
            {filteredCategories.map(([key, cat]) => (
              <button
                key={key}
                className={`${styles.catCard} ${selectedCategory === key ? styles.catSelected : ''}`}
                onClick={() => handleCategorySelect(key)}
              >
                <span className={styles.catCardIcon}>{cat.icon}</span>
                <span className={styles.catCardLabel}>{cat.label}</span>
                <span className={styles.catCardRange}>
                  ₹{cat.minReward} – ₹{cat.maxReward}
                </span>
              </button>
            ))}
          </div>

          {/* Selected category detail */}
          {selectedCategory && (
            <div className={styles.selectedDetail}>
              <div className={styles.selectedHeader}>
                <span className={styles.selectedIcon}>
                  {REWARD_CATEGORIES[selectedCategory].icon}
                </span>
                <div>
                  <strong>{REWARD_CATEGORIES[selectedCategory].label}</strong>
                  <p className={styles.selectedRange}>
                    Reward range: <strong>₹{REWARD_CATEGORIES[selectedCategory].minReward}</strong> – <strong>₹{REWARD_CATEGORIES[selectedCategory].maxReward}</strong>
                  </p>
                </div>
              </div>
              <p className={styles.selectedReason}>
                {REWARD_CATEGORIES[selectedCategory].description}
              </p>
            </div>
          )}

          {/* Next button */}
          <button
            className={styles.primaryBtn}
            onClick={handleGetRecommendation}
            disabled={!selectedCategory}
          >
            🤖 Get AI Recommendation →
          </button>
        </div>
      )}

      {/* ══════════ STEP 2: AI Recommendation ══════════ */}
      {step === 'recommend' && recommendation && (
        <div className={styles.stepCard}>
          <h2 className={styles.stepTitle}>AI Recommendation</h2>
          <p className={styles.stepSubtitle}>
            Based on the item type and BeHonest marketplace data, here is the
            suggested reward. You can adjust this before depositing to escrow.
          </p>

          {error && <div className={styles.errorAlert}>{error}</div>}

          {/* Slider card */}
          <div className={styles.sliderCard}>
            <span className={styles.rupee}>₹</span>
            <span className={styles.amountValue}>{chosenReward}</span>
          </div>

          {/* AI / User label */}
          <p className={styles.amountLabel}>
            {chosenReward === recommendation.recommendedReward
              ? '🤖 AI Recommended Amount'
              : '✏️ Your Adjusted Amount'
            }
          </p>

          {/* Range labels */}
          <div className={styles.rangeLabels}>
            <span>Min: ₹{recommendation.minReward}</span>
            <span className={styles.aiMark}>
              🤖 AI: ₹{recommendation.recommendedReward}
            </span>
            <span>Max: ₹{recommendation.maxReward}</span>
          </div>

          {/* ── The Slider ── */}
          {/*
            The slider lets the user adjust the reward.
            min/max are locked to the category's range.
            step of 10 keeps the values clean.
          */}
          <div className={styles.sliderContainer}>
            <input
              type="range"
              className={styles.slider}
              min={recommendation.minReward}
              max={recommendation.maxReward}
              step={10}
              value={chosenReward}
              onChange={e => setChosenReward(parseInt(e.target.value))}
              style={{
                /*
                  Custom gradient on the slider track:
                  Filled portion = cyan, unfilled = dark grey
                */
                background: `linear-gradient(
                  to right,
                  var(--accent-cyan) 0%,
                  var(--accent-cyan) ${((chosenReward - recommendation.minReward) / (recommendation.maxReward - recommendation.minReward)) * 100}%,
                  rgba(255,255,255,0.08) ${((chosenReward - recommendation.minReward) / (recommendation.maxReward - recommendation.minReward)) * 100}%,
                  rgba(255,255,255,0.08) 100%
                )`
              }}
            />

            {/* AI recommended marker line on slider */}
            <div
              className={styles.aiMarkerLine}
              style={{
                left: `${((recommendation.recommendedReward - recommendation.minReward) / (recommendation.maxReward - recommendation.minReward)) * 100}%`
              }}
              title={`AI recommends: ₹${recommendation.recommendedReward}`}
            >
              <span className={styles.aiMarkerLabel}>AI</span>
            </div>
          </div>

          {/* Reset to AI recommendation button */}
          {chosenReward !== recommendation.recommendedReward && (
            <button
              className={styles.resetBtn}
              onClick={() => setChosenReward(recommendation.recommendedReward)}
            >
              🤖 Reset to AI Recommendation (₹{recommendation.recommendedReward})
            </button>
          )}

          {/* AI Reasoning — how the AI arrived at the number */}
          <div className={styles.reasoningBox}>
            <h4 className={styles.reasoningTitle}>🧠 How AI decided this amount:</h4>
            <ul className={styles.reasoningList}>
              {recommendation.reasoning.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>

          {/* Category info card */}
          <div className={styles.categoryInfoCard}>
            <div className={styles.ciHeader}>
              <span>{recommendation.category.icon}</span>
              <strong>{recommendation.category.label}</strong>
            </div>
            <p className={styles.ciDesc}>{recommendation.category.description}</p>
            <div className={styles.ciRange}>
              <div className={styles.ciRangeBar}>
                <div
                  className={styles.ciRangeFill}
                  style={{
                    width: `${((chosenReward - recommendation.minReward) / (recommendation.maxReward - recommendation.minReward)) * 100}%`
                  }}
                />
              </div>
              <div className={styles.ciRangeText}>
                <span>₹{recommendation.minReward}</span>
                <span>₹{recommendation.maxReward}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className={styles.actionRow}>
            <button
              className={styles.ghostBtn}
              onClick={() => { setStep('select'); setRecommendation(null); }}
            >
              ← Change Category
            </button>
            <button
              className={styles.primaryBtn}
              onClick={handleConfirmReward}
              disabled={processing}
            >
              {processing
                ? <><span className={styles.spinner} /> Processing...</>
                : `✅ Confirm & Deposit ₹${chosenReward} to Escrow`
              }
            </button>
          </div>

          {/* Escrow explanation */}
          <div className={styles.escrowNote}>
            <strong>🔐 What is Escrow?</strong>
            <p>
              The reward amount (₹{chosenReward}) will be held securely by beHonest.
              It will be released to the finder ONLY after the item is physically
              returned to you. If the handover doesn't happen, you get a full refund.
            </p>
          </div>
        </div>
      )}

      {/* ══════════ STEP 3: Done — Escrow Created ══════════ */}
      {step === 'done' && escrowRecord && (
        <div className={styles.doneCard}>
          <div className={styles.doneIcon}>✅</div>
          <h2 className={styles.doneTitle}>Reward Deposited to Escrow!</h2>
          <p className={styles.doneSubtitle}>
            The finder will be notified. Once the item is physically returned,
            the reward will be released to them.
          </p>

          {/* Escrow receipt card */}
          <div className={styles.receiptCard}>
            <h3 className={styles.receiptTitle}>📋 Escrow Receipt</h3>

            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>Item</span>
              <span className={styles.receiptValue}>{item.shortTitle}</span>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>Reward Amount</span>
              <span className={`${styles.receiptValue} ${styles.receiptAmount}`}>
                ₹{escrowRecord.amount}
              </span>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>Deposited By</span>
              <span className={styles.receiptValue}>{session?.fullName || escrowRecord.depositorName || "You"}</span>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>Finder</span>
              <span className={styles.receiptValue}>{item.reportedBy?.email || escrowRecord.finderEmail || "Finder"}</span>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>Status</span>
              <span className={`${styles.receiptValue} ${styles.statusHeld}`}>
                🔒 Held in Escrow
              </span>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>Escrow ID</span>
              <span className={styles.receiptValue} style={{ fontSize: '0.75rem' }}>
                {escrowRecord._id}
              </span>
            </div>
          </div>

          <button
            className={styles.primaryBtn}
            onClick={() => navigate('/escrow')}
          >
            🏦 View Escrow Dashboard
          </button>
          <button
            className={styles.ghostBtn}
            onClick={() => navigate('/found-items')}
          >
            ← Back to Found Items
          </button>
        </div>
      )}

    </div>
  );
}

export default RewardPage;





/*
ClaimItemPage (AI Verification)
  └── Score ≥ 80% → verdict = "verified"
        └── User clicks "💰 Proceed to Reward & Escrow"
              └── navigate('/reward/bh_item_123')
                    │
                    ▼
RewardPage mounts
  │
  ▼
useEffect runs:
  ├── getFoundItemById("bh_item_123") → loads item
  ├── getEscrowForItem("bh_item_123") → checks for existing escrow
  │     ├── If escrow exists → jump to 'done' (show receipt)
  │     └── If no escrow → continue normally
  └── setItem(foundItem), setLoading(false)
  │
  ▼
STEP 1: 'select' renders
  └── User searches and clicks a category card
        └── handleCategorySelect("watch")
              └── selectedCategory = "watch"
  └── User clicks "Get AI Recommendation"
        └── handleGetRecommendation()
              ├── calculateReward(item, "watch", 80)
              │     └── Returns { recommendedReward: 300, min: 100, max: 500, reasoning: [...] }
              ├── setChosenReward(300) → slider starts here
              └── setStep('recommend')
  │
  ▼
STEP 2: 'recommend' renders
  └── User drags the slider
        └── onChange → setChosenReward(350) → big number updates live
  └── User clicks "Confirm & Deposit"
        └── handleConfirmReward()
              ├── setProcessing(true) → spinner
              ├── await 1.5s → fake payment delay
              ├── createEscrow({...}) → saves to localStorage
              ├── setEscrowRecord(escrow)
              └── setStep('done')
  │
  ▼
STEP 3: 'done' renders
  └── Shows the escrow receipt with all details
  └── User clicks "Back to Found Items" → navigate('/found-items')
*/

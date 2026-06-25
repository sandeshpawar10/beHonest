/* ============================================================
   EscrowPage.jsx
   Route: /escrow  (protected — must be logged in)

   PURPOSE:
   The central escrow dashboard. Shows all escrow transactions
   where the logged-in user is involved — either as the OWNER
   (they deposited money) or as the FINDER (they'll receive money).

   THE COMPLETE ESCROW FLOW:
   ┌─────────────────────────────────────────────────────────┐
   │  1. Owner claims item (AI quiz → verified)              │
   │  2. Owner deposits reward → status = "held" 🔒          │
   │  3. Finder returns item physically                      │
   │  4. Owner clicks "Confirm Item Received" → "released" ✅│
   │  5. Platform releases reward to finder                  │
   └─────────────────────────────────────────────────────────┘

   SAFETY:
   - Finder can't take money and disappear (money is held)
   - Owner can't refuse to pay after getting item (money already deposited)
   - If no exchange happens, owner can request a refund
   ============================================================ */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getEscrowsForUser,      // Get user's escrow records
  updateEscrowStatus,     // Change status (release/refund)
  REWARD_CATEGORIES,      // Category info for display
} from '../utils/rewardUtils';
import styles from './EscrowPage.module.css';

function EscrowPage() {
  const navigate    = useNavigate();
  const { session } = useAuth();

  // ── State ─────────────────────────────────────────────────
  const [escrows, setEscrows]     = useState({ asOwner: [], asFinder: [] });
  const [activeTab, setActiveTab] = useState('owner'); // 'owner' | 'finder'
  const [loading, setLoading]     = useState(true);

  // Confirm modal state
  const [confirmModal, setConfirmModal]   = useState(null);  // The escrow being confirmed
  const [confirmAction, setConfirmAction] = useState('');     // 'release' | 'refund'
  const [processing, setProcessing]       = useState(false);

  // ── Load escrows on mount ─────────────────────────────────
  useEffect(() => {
    if (session?.email) {
      const userEscrows = getEscrowsForUser(session.email);
      setEscrows(userEscrows);
    }
    setLoading(false);
  }, [session]);

  // ── Refresh escrows (re-read from localStorage) ───────────
  const refreshEscrows = () => {
    if (session?.email) {
      setEscrows(getEscrowsForUser(session.email));
    }
  };

  // ── Open confirm modal ────────────────────────────────────
  const openConfirmModal = (escrow, action) => {
    setConfirmModal(escrow);
    setConfirmAction(action);
  };

  // ── Close confirm modal ───────────────────────────────────
  const closeConfirmModal = () => {
    setConfirmModal(null);
    setConfirmAction('');
    setProcessing(false);
  };

  // ── Handle release / refund ───────────────────────────────
  const handleConfirmAction = async () => {
    if (!confirmModal || !confirmAction) return;

    setProcessing(true);

    // Simulate processing time
    await new Promise(r => setTimeout(r, 1500));

    if (confirmAction === 'release') {
      // Owner confirms they received the item back → release reward to finder
      updateEscrowStatus(
        confirmModal.id,
        'released',
        `${session.fullName} confirmed item received. ₹${confirmModal.rewardAmount} released to ${confirmModal.finderName}.`
      );
    } else if (confirmAction === 'refund') {
      // Owner requests a refund (exchange didn't happen)
      updateEscrowStatus(
        confirmModal.id,
        'refunded',
        `${session.fullName} requested a refund. ₹${confirmModal.rewardAmount} returned to depositor.`
      );
    }

    // Refresh the list
    refreshEscrows();
    closeConfirmModal();
  };

  // ── Format date helper ────────────────────────────────────
  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // ── Get status config ─────────────────────────────────────
  const getStatusConfig = (status) => {
    const configs = {
      held:     { label: '🔒 Held in Escrow',   color: '#ffb347', bgColor: 'rgba(255, 179, 71, 0.08)' },
      released: { label: '✅ Reward Released',   color: '#00ff88', bgColor: 'rgba(0, 255, 136, 0.08)' },
      refunded: { label: '↩️ Refunded',          color: '#ff8fa3', bgColor: 'rgba(255, 77, 109, 0.08)' },
      disputed: { label: '⚠️ Under Dispute',    color: '#ff4d6d', bgColor: 'rgba(255, 77, 109, 0.08)' },
    };
    return configs[status] || configs.held;
  };

  // ── Get category info ─────────────────────────────────────
  const getCategoryInfo = (key) => {
    return REWARD_CATEGORIES[key] || REWARD_CATEGORIES.other || { icon: '📦', label: 'Item' };
  };

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.centerMsg}>
        <div className={styles.spinner} />
        <p>Loading escrow records...</p>
      </div>
    );
  }

  // Current list based on active tab
  const currentList = activeTab === 'owner' ? escrows.asOwner : escrows.asFinder;

  // Stats
  const totalHeld     = escrows.asOwner.filter(e => e.status === 'held').length
                      + escrows.asFinder.filter(e => e.status === 'held').length;
  const totalReleased = escrows.asOwner.filter(e => e.status === 'released').length
                      + escrows.asFinder.filter(e => e.status === 'released').length;
  const totalAmount   = escrows.asOwner.reduce((sum, e) => sum + e.rewardAmount, 0);
  const earnedAmount  = escrows.asFinder
                          .filter(e => e.status === 'released')
                          .reduce((sum, e) => sum + e.rewardAmount, 0);

  // ── Render ────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Top bar */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate('/dashboard')}>
          ← Dashboard
        </button>
        <h1 className={styles.pageTitle}>🏦 Escrow Dashboard</h1>
      </div>

      {/* Explanation banner */}
      <div className={styles.explainBanner}>
        <h3>🔐 How Escrow Protects Both Parties</h3>
        <div className={styles.flowSteps}>
          <div className={styles.flowStep}>
            <span className={styles.flowNum}>1</span>
            <span>Owner verifies ownership</span>
          </div>
          <div className={styles.flowArrow}>→</div>
          <div className={styles.flowStep}>
            <span className={styles.flowNum}>2</span>
            <span>Owner deposits reward</span>
          </div>
          <div className={styles.flowArrow}>→</div>
          <div className={styles.flowStep}>
            <span className={styles.flowNum}>3</span>
            <span>Finder returns item</span>
          </div>
          <div className={styles.flowArrow}>→</div>
          <div className={styles.flowStep}>
            <span className={styles.flowNum}>4</span>
            <span>Owner confirms receipt</span>
          </div>
          <div className={styles.flowArrow}>→</div>
          <div className={styles.flowStep}>
            <span className={styles.flowNum}>5</span>
            <span>Reward released to finder</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{totalHeld}</span>
          <span className={styles.statLabel}>🔒 Active Escrows</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{totalReleased}</span>
          <span className={styles.statLabel}>✅ Completed</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>₹{totalAmount}</span>
          <span className={styles.statLabel}>💸 Total Deposited</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>₹{earnedAmount}</span>
          <span className={styles.statLabel}>🎉 Total Earned</span>
        </div>
      </div>

      {/* Tab switcher */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'owner' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('owner')}
        >
          💸 As Owner ({escrows.asOwner.length})
          <span className={styles.tabHint}>Items you claimed — you deposited the reward</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'finder' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('finder')}
        >
          🎁 As Finder ({escrows.asFinder.length})
          <span className={styles.tabHint}>Items you found — you'll receive the reward</span>
        </button>
      </div>

      {/* ── Escrow List ── */}
      {currentList.length === 0 ? (
        <div className={styles.emptyState}>
          <span style={{ fontSize: '3rem' }}>
            {activeTab === 'owner' ? '💸' : '🎁'}
          </span>
          <h3>No escrow records {activeTab === 'owner' ? 'as owner' : 'as finder'}</h3>
          <p>
            {activeTab === 'owner'
              ? 'When you claim and verify an item, the reward deposit will appear here.'
              : 'When someone claims an item you found, the escrow will appear here.'
            }
          </p>
          <button
            className={styles.primaryBtn}
            onClick={() => navigate('/found-items')}
          >
            Browse Found Items
          </button>
        </div>
      ) : (
        <div className={styles.escrowList}>
          {currentList.map(escrow => {
            const statusCfg = getStatusConfig(escrow.status);
            const catInfo   = getCategoryInfo(escrow.rewardCategory);

            return (
              <div key={escrow.id} className={styles.escrowCard}>

                {/* Card header */}
                <div className={styles.ecHeader}>
                  <div className={styles.ecItemInfo}>
                    <span className={styles.ecIcon}>{catInfo.icon}</span>
                    <div>
                      <h4 className={styles.ecTitle}>{escrow.itemTitle}</h4>
                      <span className={styles.ecCategory}>{catInfo.label}</span>
                    </div>
                  </div>
                  <div
                    className={styles.ecStatus}
                    style={{ color: statusCfg.color, background: statusCfg.bgColor }}
                  >
                    {statusCfg.label}
                  </div>
                </div>

                {/* Card body — details */}
                <div className={styles.ecBody}>
                  <div className={styles.ecDetailGrid}>
                    <div className={styles.ecDetail}>
                      <span className={styles.ecDetailLabel}>Reward</span>
                      <span className={styles.ecDetailValue} style={{ color: '#00ff88' }}>
                        ₹{escrow.rewardAmount}
                      </span>
                    </div>
                    <div className={styles.ecDetail}>
                      <span className={styles.ecDetailLabel}>
                        {activeTab === 'owner' ? 'Finder' : 'Owner'}
                      </span>
                      <span className={styles.ecDetailValue}>
                        {activeTab === 'owner' ? escrow.finderName : escrow.depositorName}
                      </span>
                    </div>
                    <div className={styles.ecDetail}>
                      <span className={styles.ecDetailLabel}>Deposited On</span>
                      <span className={styles.ecDetailValue}>
                        {formatDate(escrow.createdAt)}
                      </span>
                    </div>
                    {escrow.releasedAt && (
                      <div className={styles.ecDetail}>
                        <span className={styles.ecDetailLabel}>Released On</span>
                        <span className={styles.ecDetailValue} style={{ color: '#00ff88' }}>
                          {formatDate(escrow.releasedAt)}
                        </span>
                      </div>
                    )}
                    {escrow.refundedAt && (
                      <div className={styles.ecDetail}>
                        <span className={styles.ecDetailLabel}>Refunded On</span>
                        <span className={styles.ecDetailValue} style={{ color: '#ff8fa3' }}>
                          {formatDate(escrow.refundedAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ── Timeline ── */}
                  {escrow.timeline && escrow.timeline.length > 0 && (
                    <div className={styles.timeline}>
                      <h5 className={styles.timelineTitle}>📜 Transaction Timeline</h5>
                      {escrow.timeline.map((event, i) => {
                        const evStatus = getStatusConfig(event.status);
                        return (
                          <div key={i} className={styles.timelineItem}>
                            <div
                              className={styles.timelineDot}
                              style={{ background: evStatus.color }}
                            />
                            <div className={styles.timelineContent}>
                              <span className={styles.timelineNote}>{event.note}</span>
                              <span className={styles.timelineDate}>
                                {formatDate(event.at)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Action buttons (only for owner + status is "held") ── */}
                  {activeTab === 'owner' && escrow.status === 'held' && (
                    <div className={styles.ecActions}>
                      <button
                        className={styles.releaseBtn}
                        onClick={() => openConfirmModal(escrow, 'release')}
                      >
                        ✅ Confirm Item Received — Release Reward
                      </button>
                      <button
                        className={styles.refundBtn}
                        onClick={() => openConfirmModal(escrow, 'refund')}
                      >
                        ↩️ Request Refund
                      </button>
                    </div>
                  )}

                  {/* Finder waiting message */}
                  {activeTab === 'finder' && escrow.status === 'held' && (
                    <div className={styles.finderWaiting}>
                      ⏳ Waiting for the owner to confirm item receipt.
                      Once confirmed, ₹{escrow.rewardAmount} will be released to you.
                    </div>
                  )}

                  {/* Released message for finder */}
                  {activeTab === 'finder' && escrow.status === 'released' && (
                    <div className={styles.finderReleased}>
                      🎉 Congratulations! ₹{escrow.rewardAmount} has been released to you
                      for honestly returning the item. Thank you for being honest!
                    </div>
                  )}
                </div>

                {/* Escrow ID footer */}
                <div className={styles.ecFooter}>
                  <span>Escrow ID: {escrow.id}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════ Confirm Modal ══════════ */}
      {confirmModal && (
        <div className={styles.modalOverlay} onClick={closeConfirmModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className={styles.modalHeader}>
              <h2>
                {confirmAction === 'release'
                  ? '✅ Confirm Item Received'
                  : '↩️ Request Refund'
                }
              </h2>
              <button className={styles.modalClose} onClick={closeConfirmModal}>✕</button>
            </div>

            {/* Body */}
            <div className={styles.modalBody}>
              {confirmAction === 'release' ? (
                <>
                  <div className={styles.modalIcon}>🤝</div>
                  <p className={styles.modalText}>
                    You are confirming that you have physically received your item
                    <strong> "{confirmModal.itemTitle}"</strong> from the finder.
                  </p>
                  <div className={styles.modalHighlight}>
                    <span>Reward to be released:</span>
                    <strong style={{ color: '#00ff88', fontSize: '1.4rem' }}>
                      ₹{confirmModal.rewardAmount}
                    </strong>
                  </div>
                  <p className={styles.modalCaption}>
                    This amount will be released to <strong>{confirmModal.finderName}</strong> as
                    a reward for their honesty. This action cannot be undone.
                  </p>
                </>
              ) : (
                <>
                  <div className={styles.modalIcon}>↩️</div>
                  <p className={styles.modalText}>
                    You are requesting a refund for the escrow on
                    <strong> "{confirmModal.itemTitle}"</strong>.
                  </p>
                  <div className={styles.modalHighlight}>
                    <span>Amount to be refunded:</span>
                    <strong style={{ color: '#ffb347', fontSize: '1.4rem' }}>
                      ₹{confirmModal.rewardAmount}
                    </strong>
                  </div>
                  <p className={styles.modalCaption}>
                    Use this only if the exchange didn't happen.
                    The finder will not receive any reward.
                  </p>
                </>
              )}
            </div>

            {/* Footer buttons */}
            <div className={styles.modalFooter}>
              <button className={styles.modalCancel} onClick={closeConfirmModal}>
                Cancel
              </button>
              <button
                className={confirmAction === 'release' ? styles.modalConfirmRelease : styles.modalConfirmRefund}
                onClick={handleConfirmAction}
                disabled={processing}
              >
                {processing
                  ? <><span className={styles.spinner} /> Processing...</>
                  : confirmAction === 'release'
                    ? '✅ Yes, Release Reward'
                    : '↩️ Yes, Refund Me'
                }
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default EscrowPage;

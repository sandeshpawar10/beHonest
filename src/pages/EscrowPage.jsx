/* ============================================================
   EscrowPage.jsx
   Route: /escrow  (protected — must be logged in)

   PURPOSE:
   The central escrow dashboard. Shows all escrow transactions
   where the logged-in user is involved — either as the OWNER
   (they deposited money) or as the FINDER (they'll receive money).

   THE COMPLETE ESCROW FLOW:
   ┌─────────────────────────────────────────────────────────┐
   │  1. Owner deposits reward                               │
   │  2. They arrange meetup via chat                        │
   │  3. Finder confirms handover                            │
   │  4. Owner confirms receipt                              │
   │  5. Reward auto-releases                                │
   └─────────────────────────────────────────────────────────┘
   ============================================================ */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { REWARD_CATEGORIES } from '../utils/rewardUtils';
import styles from './EscrowPage.module.css';

function EscrowPage() {
  const navigate    = useNavigate();
  const { session } = useAuth();

  // ── State ─────────────────────────────────────────────────
  const [escrows, setEscrows]     = useState({ asOwner: [], asFinder: [] });
  const [activeTab, setActiveTab] = useState('owner'); // 'owner' | 'finder'
  const [loading, setLoading]     = useState(true);

  // Confirm modal state (for refund)
  const [confirmModal, setConfirmModal]   = useState(null);  // The escrow being confirmed
  const [confirmAction, setConfirmAction] = useState('');     // 'refund'
  const [processing, setProcessing]       = useState(false);

  // New State for Mutual Confirmation and Dispute
  const [disputeModal, setDisputeModal] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [itemPossession, setItemPossession] = useState('');

  // ── Safety Check Modal state ──
  const [safetyCheckModal, setSafetyCheckModal] = useState(null);
  const [safetyCheck1, setSafetyCheck1] = useState(false);
  const [safetyCheck2, setSafetyCheck2] = useState(false);
  const [safetyCheck3, setSafetyCheck3] = useState(false); // 'me', 'other_party', 'unknown'
  const [confirmingId, setConfirmingId] = useState(null);

  // UPI state for finder
  const [upiInputs, setUpiInputs] = useState({});
  const [savingUpi, setSavingUpi] = useState(null);

  async function fetchEscrows() {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/escrow/my-escrows`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setEscrows(data);
      } else {
        console.error('Failed to fetch escrows');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // ── Load escrows on mount & Handle redirects ───────────────
  useEffect(() => {
    const checkVerifyRedirect = async () => {
      const params = new URLSearchParams(window.location.search);
      const verifyOrderId = params.get('verify_order_id');
      const escrowId = params.get('escrow_id');

      if (verifyOrderId && escrowId) {
        try {
          const verifyRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/escrow/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              order_id: verifyOrderId,
              escrowId: escrowId
            })
          });

          // Remove params from URL so it doesn't re-trigger on refresh
          window.history.replaceState({}, document.title, "/escrow");
          
          if (verifyRes.ok) {
            // Refresh escrows list to show the newly verified one
            fetchEscrows();
          }
        } catch (err) {
          console.error("Verification redirect error:", err);
        }
      }
    };

    // Load instantly
    fetchEscrows();
    
    // Process background verification if needed
    checkVerifyRedirect();
  }, []);

  // ── Refresh escrows (re-read from backend) ───────────
  const refreshEscrows = () => {
    fetchEscrows();
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

  // ── Handle refund ───────────────────────────────
  const handleConfirmAction = async () => {
    if (!confirmModal || confirmAction !== 'refund') return;

    setProcessing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/escrow/refund/${confirmModal._id}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) {
        const errData = await res.json().catch(()=>({}));
        throw new Error(errData.error || 'Failed to refund escrow');
      }
      
      refreshEscrows();
      closeConfirmModal();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // ── Handle Confirm (Release) ──────────────────────────────
  const handleConfirm = async (escrowId) => {
    setConfirmingId(escrowId);
    setSafetyCheckModal(null); // Close modal if open
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/escrow/confirm/${escrowId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to confirm');
      }
      const data = await res.json();
      if (data.bothConfirmed) {
        alert('🎉 Both parties confirmed! The reward has been released!');
      }
      refreshEscrows();
    } catch (err) {
      alert(err.message);
    } finally {
      setConfirmingId(null);
    }
  };

  // ── Handle Dispute ──────────────────────────────────────
  const handleDispute = async () => {
    if (!disputeModal || disputeReason.trim().length < 10 || !itemPossession) return;
    try {
      setProcessing(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/escrow/dispute/${disputeModal._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: disputeReason.trim(), itemPossession })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to raise dispute');
      }
      refreshEscrows();
      setDisputeModal(null);
      setDisputeReason('');
      setItemPossession('');
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // ── Save Finder UPI ID ──────────────────────────────
  const handleSaveUpi = async (escrowId) => {
    const upiId = upiInputs[escrowId];
    if (!upiId || upiId.trim().length < 3) {
      alert('Please enter a valid UPI ID');
      return;
    }
    setSavingUpi(escrowId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/escrow/save-upi/${escrowId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ upiId: upiId.trim() })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save UPI ID');
      }
      refreshEscrows();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingUpi(null);
    }
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
      pending:  { label: '🔒 Held in Escrow',   color: '#ffb347', bgColor: 'rgba(255, 179, 71, 0.08)' },
      released: { label: '✅ Reward Released',   color: 'var(--color-success)', bgColor: 'rgba(16, 185, 129, 0.08)' },
      refunded: { label: '↩️ Refunded',          color: '#ff8fa3', bgColor: 'rgba(255, 77, 109, 0.08)' },
      disputed: { label: '⚠️ Under Dispute',    color: '#ff4d6d', bgColor: 'rgba(255, 77, 109, 0.08)' },
    };
    return configs[status] || configs.pending;
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
  const totalHeld     = escrows.asOwner.filter(e => e.status === 'held' || e.status === 'pending').length
                      + escrows.asFinder.filter(e => e.status === 'held' || e.status === 'pending').length;
  const totalReleased = escrows.asOwner.filter(e => e.status === 'released').length
                      + escrows.asFinder.filter(e => e.status === 'released').length;
  const totalAmount   = escrows.asOwner.reduce((sum, e) => sum + e.amount, 0);
  const earnedAmount  = escrows.asFinder
                          .filter(e => e.status === 'released')
                          .reduce((sum, e) => sum + e.amount, 0);

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
            <span>Owner deposits reward</span>
          </div>
          <div className={styles.flowArrow}>→</div>
          <div className={styles.flowStep}>
            <span className={styles.flowNum}>2</span>
            <span>They arrange meetup via chat</span>
          </div>
          <div className={styles.flowArrow}>→</div>
          <div className={styles.flowStep}>
            <span className={styles.flowNum}>3</span>
            <span>Finder confirms handover</span>
          </div>
          <div className={styles.flowArrow}>→</div>
          <div className={styles.flowStep}>
            <span className={styles.flowNum}>4</span>
            <span>Owner confirms receipt</span>
          </div>
          <div className={styles.flowArrow}>→</div>
          <div className={styles.flowStep}>
            <span className={styles.flowNum}>5</span>
            <span>Reward auto-releases</span>
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
              <div key={escrow._id} className={styles.escrowCard}>

                {/* Card header */}
                <div className={styles.ecHeader}>
                  <div className={styles.ecItemInfo}>
                    <span className={styles.ecIcon}>{catInfo.icon}</span>
                    <div>
                      <h4 className={styles.ecTitle}>{escrow.itemId?.shortTitle}</h4>
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
                      <span className={styles.ecDetailValue} style={{ color: 'var(--color-success)' }}>
                        ₹{escrow.amount}
                      </span>
                    </div>
                    <div className={styles.ecDetail}>
                      <span className={styles.ecDetailLabel}>
                        {activeTab === 'owner' ? 'Finder' : 'Owner'}
                      </span>
                      <span className={styles.ecDetailValue}>
                        {activeTab === 'owner' ? (escrow.finderId?.username || escrow.finderId?.email) : (escrow.depositorId?.username || escrow.depositorId?.email)}
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
                        <span className={styles.ecDetailValue} style={{ color: 'var(--color-success)' }}>
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

                  {/* ── Action buttons (Owner View) ── */}
                  {activeTab === 'owner' && (escrow.status === 'held' || escrow.status === 'pending') && (
                    <div className={styles.ecActions}>
                      
                      <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px', width: '100%', marginBottom: '10px' }}>
                        <p style={{ marginBottom: '10px', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                          <strong>Status:</strong> {escrow.ownerConfirmed ? 'You confirmed ✅' : 'Waiting for your confirmation'}
                          <br />
                          <strong>Finder status:</strong> {escrow.finderConfirmed ? 'Finder confirmed ✅' : "Finder hasn't confirmed yet"}
                        </p>
                        
                        {escrow.finderConfirmed && !escrow.ownerConfirmed && (
                          <div style={{ background: 'rgba(255, 179, 71, 0.1)', padding: '10px', borderRadius: '8px', marginBottom: '12px' }}>
                            <p style={{ color: '#ffb347', fontSize: '0.9rem', marginBottom: '6px' }}>
                              The finder says they've handed over the item. Please confirm if you received it.
                            </p>
                            <p style={{ color: '#ffb347', fontSize: '0.85rem', margin: 0 }}>
                              <strong>Note:</strong> Since the finder confirmed handover, the direct "Request Refund" option is disabled. If they gave you the wrong item or didn't actually hand it over, please click <strong>Raise Dispute</strong> to get your refund.
                            </p>
                          </div>
                        )}
                        
                        <button
                          onClick={() => {
                            setSafetyCheck1(false);
                            setSafetyCheck2(false);
                            setSafetyCheck3(false);
                            setSafetyCheckModal(escrow);
                          }}
                          disabled={escrow.ownerConfirmed || confirmingId === escrow._id}
                          style={{
                            width: '100%',
                            padding: '14px',
                            background: escrow.ownerConfirmed ? 'rgba(0, 255, 136, 0.1)' : 'linear-gradient(135deg, #00ff88, #00d4ff)',
                            color: escrow.ownerConfirmed ? '#0c0f0e' : '#000',
                            border: escrow.ownerConfirmed ? '1px solid rgba(0, 255, 136, 0.3)' : 'none',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            cursor: escrow.ownerConfirmed ? 'default' : 'pointer',
                            opacity: escrow.ownerConfirmed ? 0.7 : (confirmingId === escrow._id ? 0.7 : 1)
                          }}
                        >
                          {confirmingId === escrow._id ? 'Processing...' : escrow.ownerConfirmed ? '✅ Confirmed' : '✅ I have received my item'}
                        </button>
                      </div>

                      <button
                        className={styles.primaryBtn}
                        onClick={() => navigate(`/chat/${escrow._id}`)}
                        style={{ width: '100%', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '12px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        💬 Open Secure Chat
                      </button>

                      <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '10px' }}>
                        <button
                          className={styles.refundBtn}
                          onClick={() => openConfirmModal(escrow, 'refund')}
                          disabled={escrow.finderConfirmed}
                          title={escrow.finderConfirmed ? "Finder confirmed handover. Raise a dispute instead." : ""}
                          style={{ flex: 1, padding: '12px', borderRadius: '10px', opacity: escrow.finderConfirmed ? 0.5 : 1, cursor: escrow.finderConfirmed ? 'not-allowed' : 'pointer' }}
                        >
                          ↩️ Request Refund
                        </button>
                        <button
                          onClick={() => setDisputeModal(escrow)}
                          style={{ flex: 1, background: 'rgba(255, 77, 109, 0.1)', border: '1px solid rgba(255, 77, 109, 0.3)', color: '#0c0f0e', borderRadius: '10px', padding: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          🚨 Raise Dispute
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Action buttons (Finder View) ── */}
                  {activeTab === 'finder' && (escrow.status === 'held' || escrow.status === 'pending') && (
                    <div className={styles.ecActions}>
                      
                      {/* UPI ID Input for Finder */}
                      <div style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(0, 210, 255, 0.05), rgba(0, 255, 136, 0.05))', border: '1px solid rgba(0, 210, 255, 0.2)', borderRadius: '12px', width: '100%', marginBottom: '10px' }}>
                        <p style={{ marginBottom: '8px', fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                          💳 Your UPI ID {escrow.finderUpiId ? '(Saved)' : '(Required to receive payout)'}
                        </p>
                        {escrow.finderUpiId ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ padding: '10px 16px', background: 'rgba(0, 255, 136, 0.1)', border: '1px solid rgba(0, 255, 136, 0.3)', borderRadius: '8px', color: '#00ff88', fontWeight: '600', flex: 1 }}>
                              ✅ {escrow.finderUpiId}
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              placeholder="e.g. yourname@upi"
                              value={upiInputs[escrow._id] || ''}
                              onChange={(e) => setUpiInputs(prev => ({ ...prev, [escrow._id]: e.target.value }))}
                              style={{
                                flex: 1,
                                padding: '10px 14px',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '0.95rem',
                                outline: 'none'
                              }}
                            />
                            <button
                              onClick={() => handleSaveUpi(escrow._id)}
                              disabled={savingUpi === escrow._id}
                              style={{
                                padding: '10px 20px',
                                background: 'linear-gradient(135deg, #00ff88, #00d4ff)',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#000',
                                fontWeight: 'bold',
                                cursor: savingUpi === escrow._id ? 'not-allowed' : 'pointer',
                                opacity: savingUpi === escrow._id ? 0.6 : 1,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {savingUpi === escrow._id ? '...' : 'Save'}
                            </button>
                          </div>
                        )}
                        <p style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          When both parties confirm handover, ₹{escrow.amount} will be instantly sent to this UPI ID.
                        </p>
                      </div>

                      <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px', width: '100%', marginBottom: '10px' }}>
                        <p style={{ marginBottom: '10px', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                          <strong>Status:</strong> {escrow.finderConfirmed ? 'You confirmed ✅' : 'Waiting for your confirmation'}
                          <br />
                          <strong>Owner status:</strong> {escrow.ownerConfirmed ? 'Owner confirmed ✅' : "Owner hasn't confirmed yet"}
                        </p>
                        
                        {escrow.finderConfirmed && !escrow.ownerConfirmed && (
                          <p style={{ color: '#ffb347', fontSize: '0.9rem', marginBottom: '12px', background: 'rgba(255, 179, 71, 0.1)', padding: '10px', borderRadius: '8px' }}>
                            ⚠️ You confirmed handover but the owner hasn't confirmed receipt. If they don't confirm, raise a dispute!
                          </p>
                        )}
                        
                        <button
                          onClick={() => handleConfirm(escrow._id)}
                          disabled={escrow.finderConfirmed || confirmingId === escrow._id}
                          style={{
                            width: '100%',
                            padding: '14px',
                            background: escrow.finderConfirmed ? 'rgba(0, 255, 136, 0.1)' : 'linear-gradient(135deg, #00ff88, #00d4ff)',
                            color: escrow.finderConfirmed ? '#0c0f0e' : '#000',
                            border: escrow.finderConfirmed ? '1px solid rgba(0, 255, 136, 0.3)' : 'none',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            cursor: escrow.finderConfirmed ? 'default' : 'pointer',
                            opacity: escrow.finderConfirmed ? 0.7 : (confirmingId === escrow._id ? 0.7 : 1)
                          }}
                        >
                          {confirmingId === escrow._id ? 'Processing...' : escrow.finderConfirmed ? '✅ Confirmed' : '🤝 I have handed over the item'}
                        </button>
                      </div>

                      <button
                        className={styles.primaryBtn}
                        onClick={() => navigate(`/chat/${escrow._id}`)}
                        style={{ width: '100%', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '12px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        💬 Open Secure Chat
                      </button>

                      <button
                        onClick={() => setDisputeModal(escrow)}
                        style={{ width: '100%', marginTop: '10px', background: 'rgba(255, 77, 109, 0.1)', border: '1px solid rgba(255, 77, 109, 0.3)', color: '#0c0f0e', borderRadius: '10px', padding: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        🚨 Raise Dispute
                      </button>
                    </div>
                  )}

                  {/* ── Disputed View ── */}
                  {escrow.status === 'disputed' && (
                    <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(255, 77, 109, 0.08)', border: '1px solid rgba(255, 77, 109, 0.3)', borderRadius: '12px' }}>
                      <h4 style={{ color: '#ff4d6d', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}>
                        ⚠️ Under Dispute
                      </h4>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                        <strong>Raised by:</strong> {String(escrow.disputeRaisedBy?._id || escrow.disputeRaisedBy) === String(session?._id) ? 'You' : (activeTab === 'owner' ? 'Finder' : 'Owner')} on {formatDate(escrow.disputeRaisedAt)}
                      </p>
                      
                      <div style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        <strong>Who has the item:</strong>{' '}
                        {escrow.itemPossession === 'me' ? (
                          <span>🙋‍♂️ The person who raised the dispute</span>
                        ) : escrow.itemPossession === 'other_party' ? (
                          <span>👉 The other person</span>
                        ) : escrow.itemPossession === 'unknown' ? (
                          <span>❓ Unknown / Lost</span>
                        ) : (
                          <span>Not specified</span>
                        )}
                      </div>

                      <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '12px' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                          <strong>Reason:</strong> {escrow.disputeReason}
                        </p>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: '#ffb347', margin: 0, padding: '10px', background: 'rgba(255, 179, 71, 0.1)', borderRadius: '8px' }}>
                        An admin is reviewing this dispute. The funds are frozen until resolved.
                      </p>
                    </div>
                  )}

                  {/* ── Released message ── */}
                  {escrow.status === 'released' && (
                    <div className={styles.finderReleased} style={{ marginTop: '16px' }}>
                      {escrow.ownerConfirmed && escrow.finderConfirmed 
                        ? '🎉 Both parties confirmed the exchange. Reward released!'
                        : activeTab === 'finder' 
                          ? `🎉 Congratulations! ₹${escrow.amount} has been released to you for honestly returning the item. Thank you for being honest!`
                          : `✅ Reward of ₹${escrow.amount} was successfully released to the finder.`}
                    </div>
                  )}
                </div>

                {/* Escrow ID footer */}
                <div className={styles.ecFooter}>
                  <span>Escrow ID: {escrow._id}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════ Confirm Modal (Refund) ══════════ */}
      {confirmModal && (
        <div className={styles.modalOverlay} onClick={closeConfirmModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>↩️ Request Refund</h2>
              <button className={styles.modalClose} onClick={closeConfirmModal}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalIcon}>↩️</div>
              <p className={styles.modalText}>
                You are requesting a refund for the escrow on
                <strong> "{confirmModal.itemId?.shortTitle}"</strong>.
              </p>
              <div className={styles.modalHighlight}>
                <span>Amount to be refunded:</span>
                <strong style={{ color: '#ffb347', fontSize: '1.4rem' }}>
                  ₹{confirmModal.amount}
                </strong>
              </div>
              <p className={styles.modalCaption}>
                Use this only if the exchange didn't happen.
                The finder will not receive any reward.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancel} onClick={closeConfirmModal}>
                Cancel
              </button>
              <button
                className={styles.modalConfirmRefund}
                onClick={handleConfirmAction}
                disabled={processing}
              >
                {processing
                  ? <><span className={styles.spinner} /> Processing...</>
                  : '↩️ Yes, Refund Me'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ Dispute Modal ══════════ */}
      {disputeModal && (
        <div className={styles.modalOverlay} onClick={() => setDisputeModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 style={{ color: '#ff4d6d' }}>🚨 Raise a Dispute</h2>
              <button className={styles.modalClose} onClick={() => setDisputeModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-primary)' }}>Who currently has the item?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="itemPossession" value="me" checked={itemPossession === 'me'} onChange={(e) => setItemPossession(e.target.value)} />
                    I have it
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="itemPossession" value="other_party" checked={itemPossession === 'other_party'} onChange={(e) => setItemPossession(e.target.value)} />
                    The other person has it
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="itemPossession" value="unknown" checked={itemPossession === 'unknown'} onChange={(e) => setItemPossession(e.target.value)} />
                    I don't know / Lost
                  </label>
                </div>
              </div>

              <p className={styles.modalText} style={{ textAlign: 'left', marginBottom: '8px', fontWeight: 'bold' }}>
                Explain what happened in detail:
              </p>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Please describe the issue in detail (min 10 characters)..."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalCancel} onClick={() => setDisputeModal(null)} disabled={processing}>
                Cancel
              </button>
              <button
                onClick={handleDispute}
                disabled={processing || disputeReason.trim().length < 10 || !itemPossession}
                style={{
                  padding: '11px 22px',
                  background: 'rgba(255, 77, 109, 0.1)',
                  border: '1px solid rgba(255, 77, 109, 0.3)',
                  color: '#ff4d6d',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  cursor: (processing || disputeReason.trim().length < 10 || !itemPossession) ? 'not-allowed' : 'pointer',
                  opacity: (processing || disputeReason.trim().length < 10 || !itemPossession) ? 0.5 : 1
                }}
              >
                {processing ? <><span className={styles.spinner} /> Submitting...</> : 'Submit Dispute'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ Meetup Safety Check Modal ══════════ */}
      {safetyCheckModal && (
        <div className={styles.modalOverlay} onClick={() => setSafetyCheckModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>🛡️ Meetup Safety Check</h2>
              <button className={styles.modalClose} onClick={() => setSafetyCheckModal(null)}>✕</button>
            </div>
            
            <div className={styles.modalBody}>
              <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                Before we release your money to the finder, please confirm the following:
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                  <input type="checkbox" checked={safetyCheck1} onChange={e => setSafetyCheck1(e.target.checked)} style={{ marginTop: '4px', width: '18px', height: '18px' }} />
                  <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    <strong>I am holding the item.</strong> I am currently physically holding the item in my hands.
                  </span>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                  <input type="checkbox" checked={safetyCheck2} onChange={e => setSafetyCheck2(e.target.checked)} style={{ marginTop: '4px', width: '18px', height: '18px' }} />
                  <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    <strong>It is genuine.</strong> I have thoroughly inspected it, checked the contents/serial number, and confirm it is my exact original item (not a dummy or fake).
                  </span>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                  <input type="checkbox" checked={safetyCheck3} onChange={e => setSafetyCheck3(e.target.checked)} style={{ marginTop: '4px', width: '18px', height: '18px' }} />
                  <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    <strong>This is irreversible.</strong> I understand that clicking Release is 100% final. The funds will leave escrow instantly and cannot be refunded.
                  </span>
                </label>
              </div>
            </div>
            
            <div className={styles.modalFooter}>
              <button className={styles.modalCancel} onClick={() => setSafetyCheckModal(null)}>Cancel</button>
              <button 
                className={styles.primaryBtn} 
                onClick={() => handleConfirm(safetyCheckModal._id)}
                disabled={!safetyCheck1 || !safetyCheck2 || !safetyCheck3}
                style={{ 
                  background: (!safetyCheck1 || !safetyCheck2 || !safetyCheck3) ? 'rgba(0, 0, 0, 0.1)' : 'linear-gradient(135deg, #00ff88, #00d4ff)',
                  color: (!safetyCheck1 || !safetyCheck2 || !safetyCheck3) ? 'rgba(0, 0, 0, 0.3)' : '#000',
                  opacity: (!safetyCheck1 || !safetyCheck2 || !safetyCheck3) ? 0.7 : 1,
                  cursor: (!safetyCheck1 || !safetyCheck2 || !safetyCheck3) ? 'not-allowed' : 'pointer',
                  border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold'
                }}
              >
                Release Reward
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EscrowPage;

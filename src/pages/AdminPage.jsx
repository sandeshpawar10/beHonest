import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AdminPage.module.css';

function AdminPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalUsers: 0, totalItems: 0, totalEscrows: 0, totalDisputes: 0 });
  const [disputes, setDisputes] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [pendingClaims, setPendingClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [resolveAction, setResolveAction] = useState(''); // 'release_to_finder' or 'refund_to_owner'
  const [resolving, setResolving] = useState(false);

  const fetchAdminData = useCallback(async () => {
    try {
      const statsRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/stats`, {
        method: 'GET',
        credentials: 'include'
      });

      if (statsRes.status === 401 || statsRes.status === 403) {
        navigate('/admin/login');
        return;
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      const disputesRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/disputes`, {
        method: 'GET',
        credentials: 'include'
      });

      if (disputesRes.ok) {
        const disputesData = await disputesRes.json();
        setDisputes(disputesData.disputes || []);
      }

      const itemsRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/pending-items`, { method: 'GET', credentials: 'include' });
      if (itemsRes.ok) {
        const d = await itemsRes.json();
        setPendingItems(d.items || []);
      }

      const claimsRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/pending-claims`, { method: 'GET', credentials: 'include' });
      if (claimsRes.ok) {
        const d = await claimsRes.json();
        setPendingClaims(d.claims || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchAdminData();
    });
  }, [fetchAdminData]);

  const handleLogout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      navigate('/admin/login');
    } catch (err) {
      console.error('Failed to logout admin', err);
    }
  };

  const openConfirmModal = (dispute, action) => {
    setSelectedDispute(dispute);
    setResolveAction(action);
    setModalOpen(true);
  };

  const handleResolve = async () => {
    if (!selectedDispute) return;
    setResolving(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/resolve/${selectedDispute._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resolution: resolveAction })
      });

      if (response.ok) {
        setModalOpen(false);
        setSelectedDispute(null);
        fetchAdminData(); // refresh lists
      } else {
        console.error('Failed to resolve dispute');
      }
    } catch (err) {
      console.error('Error resolving dispute', err);
    } finally {
      setResolving(false);
    }
  };

  const handleApproveItem = async (id) => {
    if (!window.confirm("Approve this item? It will go live.")) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/item/${id}/approve`, { method: 'PUT', credentials: 'include' });
      fetchAdminData();
    } catch (err) { console.error(err); }
  };
  
  const handleRejectItem = async (id) => {
    const feedback = prompt("Enter rejection reason for Finder:");
    if (!feedback) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/item/${id}/reject`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ feedback })
      });
      fetchAdminData();
    } catch (err) { console.error(err); }
  };
  
  const handleApproveClaim = async (id) => {
    if (!window.confirm("Approve this claim? The owner will be directed to pay the reward.")) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/claim/${id}/approve`, { method: 'PUT', credentials: 'include' });
      fetchAdminData();
    } catch (err) { console.error(err); }
  };
  
  const handleRejectClaim = async (id) => {
    const feedback = prompt("Enter rejection reason for Owner:");
    if (!feedback) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/claim/${id}/reject`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ feedback })
      });
      fetchAdminData();
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loaderContainer}>
          <div className={styles.spinner}></div>
          <p>Loading Admin Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Top Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navBrand}>
          <img src="/logo.png" alt="beHonest logo" className={styles.navLogo} />
          <span className={styles.navTitle}>Admin</span>
        </div>
        <button onClick={handleLogout} className={styles.logoutBtn}>
          Logout
        </button>
      </nav>

      <main className={styles.main}>
        {/* Stats Row */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>👥</span>
            <span className={styles.statValue}>{stats.totalUsers}</span>
            <span className={styles.statLabel}>Total Users</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>📦</span>
            <span className={styles.statValue}>{stats.totalItems}</span>
            <span className={styles.statLabel}>Total Items</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>💰</span>
            <span className={styles.statValue}>{stats.totalEscrows}</span>
            <span className={styles.statLabel}>Total Escrows</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>🚨</span>
            <span className={styles.statValue}>{stats.totalDisputes}</span>
            <span className={styles.statLabel}>Active Disputes</span>
          </div>
        </div>

        {/* Pending Items Section */}
        <div className={styles.disputesSection} style={{ marginTop: '2rem' }}>
          <h2 className={styles.sectionTitle}>Pending Items (Found Reports)</h2>
          {pendingItems.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>✅</span>
              <p>No items pending review.</p>
            </div>
          ) : (
            <div className={styles.disputesList}>
              {pendingItems.map((item, index) => (
                <div key={index} className={styles.disputeCard}>
                  <div className={styles.disputeHeader}>
                    <h3>{item.shortTitle}</h3>
                    <span className={styles.rewardBadge}>{item.category}</span>
                  </div>
                  <div style={{ padding: '0 1rem' }}>
                    <p><strong>Finder:</strong> {item.reportedBy?.username || item.reportedBy?.email}</p>
                    <p><strong>Description:</strong> {item.description}</p>
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '8px 0' }}>
                      {item.images?.map((img, i) => (
                        <img key={i} src={img} alt="Item proof" style={{ height: '100px', borderRadius: '8px', objectFit: 'cover' }} />
                      ))}
                    </div>
                  </div>
                  <div className={styles.disputeActions}>
                    <button className={styles.resolveBtn} onClick={() => handleApproveItem(item._id)}>✅ Approve</button>
                    <button className={styles.refundBtn} onClick={() => handleRejectItem(item._id)}>❌ Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Claims Section */}
        <div className={styles.disputesSection} style={{ marginTop: '2rem' }}>
          <h2 className={styles.sectionTitle}>Pending Claims (Owner Proofs)</h2>
          {pendingClaims.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>✅</span>
              <p>No claims pending review.</p>
            </div>
          ) : (
            <div className={styles.disputesList}>
              {pendingClaims.map((claim, index) => (
                <div key={index} className={styles.disputeCard}>
                  <div className={styles.disputeHeader}>
                    <h3>Claim for: {claim.itemId?.shortTitle}</h3>
                  </div>
                  <div style={{ padding: '0 1rem' }}>
                    <p><strong>Owner:</strong> {claim.claimantId?.username || claim.claimantId?.email}</p>
                    <p><strong>Secret Guess:</strong> {claim.secretGuess}</p>
                    {claim.proofImage && (
                      <div style={{ marginTop: '8px' }}>
                        <p><strong>Proof Photo:</strong></p>
                        <img src={claim.proofImage} alt="Owner Proof" style={{ height: '150px', borderRadius: '8px', objectFit: 'cover' }} />
                      </div>
                    )}
                    <details style={{ marginTop: '10px' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>View Interview Transcript</summary>
                      <div style={{ background: '#f5f5f5', padding: '10px', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                        {claim.answers?.map((msg, i) => (
                          <p key={i}><strong>{msg.role}:</strong> {msg.text}</p>
                        ))}
                      </div>
                    </details>
                  </div>
                  <div className={styles.disputeActions}>
                    <button className={styles.resolveBtn} onClick={() => handleApproveClaim(claim._id)}>✅ Approve</button>
                    <button className={styles.refundBtn} onClick={() => handleRejectClaim(claim._id)}>❌ Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Disputes Section */}
        <div className={styles.disputesSection}>
          <h2 className={styles.sectionTitle}>Active Disputes</h2>
          
          {disputes.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>✅</span>
              <p>No active disputes. Everything is running smoothly!</p>
            </div>
          ) : (
            <div className={styles.disputesList}>
              {disputes.map((dispute, index) => (
                <div key={index} className={styles.disputeCard}>
                  <div className={styles.disputeHeader}>
                    <h3>{dispute.itemId?.shortTitle || 'Unknown Item'}</h3>
                    <span className={styles.rewardBadge}>₹{dispute.amount || 0}</span>
                  </div>
                  
                  <div className={styles.disputeInfoGrid}>
                    <div className={styles.infoBox}>
                      <span className={styles.infoLabel}>Owner</span>
                      <p className={styles.infoValue}>
                        {dispute.depositorId?.username || 'Unknown'} 
                        <span title="Owner Confirmation">{dispute.ownerConfirmed ? ' ✅' : ' ❌'}</span>
                      </p>
                    </div>
                    <div className={styles.infoBox}>
                      <span className={styles.infoLabel}>Finder</span>
                      <p className={styles.infoValue}>
                        {dispute.finderId?.username || 'Unknown'}
                        <span title="Finder Confirmation">{dispute.finderConfirmed ? ' ✅' : ' ❌'}</span>
                      </p>
                    </div>
                  </div>

                  <div className={styles.disputeReasonBox}>
                    <div className={styles.reasonHeader}>
                      <strong>Raised by:</strong> {dispute.disputeRaisedBy?.username || 'System'} on {new Date(dispute.disputeRaisedAt || dispute.updatedAt).toLocaleDateString()}
                    </div>
                    <div style={{ marginBottom: '8px', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      <strong>Who has the item:</strong>{' '}
                      {dispute.itemPossession === 'me' ? (
                        <span>🙋‍♂️ The person who raised the dispute</span>
                      ) : dispute.itemPossession === 'other_party' ? (
                        <span>👉 The other person</span>
                      ) : dispute.itemPossession === 'unknown' ? (
                        <span>❓ Unknown / Lost</span>
                      ) : (
                        <span>Not specified</span>
                      )}
                    </div>
                    <p className={styles.disputeReason}>
                      "{dispute.disputeReason || 'No reason provided.'}"
                    </p>
                  </div>

                  <div className={styles.disputeActions}>
                    <button 
                      className={styles.resolveBtn}
                      onClick={() => openConfirmModal(dispute, 'release_to_finder')}
                    >
                      💰 Release to Finder
                    </button>
                    <button 
                      className={styles.refundBtn}
                      onClick={() => openConfirmModal(dispute, 'refund_to_owner')}
                    >
                      ↩️ Refund to Owner
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Confirmation Modal */}
      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Confirm Resolution</h3>
            </div>
            <div className={styles.modalBody}>
              <p>Are you sure you want to <strong>{resolveAction === 'release_to_finder' ? 'Release funds to Finder' : 'Refund to Owner'}</strong>?</p>
              <p className={styles.warningText}>This action is irreversible.</p>
            </div>
            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => setModalOpen(false)}
                disabled={resolving}
              >
                Cancel
              </button>
              <button 
                className={resolveAction === 'release_to_finder' ? styles.confirmResolveBtn : styles.confirmRefundBtn}
                onClick={handleResolve}
                disabled={resolving}
              >
                {resolving ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;

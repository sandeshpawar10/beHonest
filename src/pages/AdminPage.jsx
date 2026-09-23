/* eslint-disable */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import styles from './AdminPage.module.css';

function AdminPage() {
  const navigate = useNavigate();
  const socket = useSocket();
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
    // eslint-disable-next-line
    // eslint-disable-next-line
    fetchAdminData();
    
    if (socket) {
      // Admins might want to join a specific room if we set that up,
      // but for now, they can just listen to global broadcasts or specific events
      socket.emit('join_admin_room');

      const handleUpdate = () => {
        // eslint-disable-next-line
    fetchAdminData();
      };

      socket.on('admin_new_item', handleUpdate);
      socket.on('admin_new_claim', handleUpdate);
      
      return () => {
        socket.off('admin_new_item', handleUpdate);
        socket.off('admin_new_claim', handleUpdate);
      };
    }
  }, [fetchAdminData, socket]);

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
        // eslint-disable-next-line
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

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectType, setRejectType] = useState(''); // 'item' or 'claim'
  const [rejectTargetId, setRejectTargetId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [approvingId, setApprovingId] = useState(null);

  const handleApproveItem = async (id) => {
    setApprovingId(id);
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/item/${id}/approve`, { method: 'PUT', credentials: 'include' });
      await fetchAdminData();
    } catch (err) { console.error(err); }
    finally { setApprovingId(null); }
  };
  
  const openRejectItemModal = (id) => {
    setRejectType('item');
    setRejectTargetId(id);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleApproveClaim = async (id) => {
    setApprovingId(id);
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/claim/${id}/approve`, { method: 'PUT', credentials: 'include' });
      await fetchAdminData();
    } catch (err) { console.error(err); }
    finally { setApprovingId(null); }
  };
  
  const openRejectClaimModal = (id) => {
    setRejectType('claim');
    setRejectTargetId(id);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const submitRejection = async () => {
    if (!rejectReason.trim()) return;
    setIsRejecting(true);
    try {
      const endpoint = rejectType === 'item' 
        ? `/api/admin/item/${rejectTargetId}/reject`
        : `/api/admin/claim/${rejectTargetId}/reject`;

      await fetch(`${import.meta.env.VITE_API_URL || ''}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ feedback: rejectReason })
      });
      setRejectModalOpen(false);
      // eslint-disable-next-line
    fetchAdminData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRejecting(false);
    }
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
            <div className={styles.disputesList} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
              {pendingItems.map((item, index) => (
                <div key={index} className={styles.disputeCard} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div className={styles.disputeHeader} style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#333' }}>{item.shortTitle}</h3>
                    <span className={styles.rewardBadge} style={{ fontSize: '0.8rem', padding: '4px 8px' }}>{item.category}</span>
                  </div>
                  
                  <div style={{ padding: '1rem', flexGrow: 1 }}>
                    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '15px' }}>
                      {item.images?.map((img, i) => (
                        <img key={i} src={img} alt="Item proof" style={{ height: '120px', width: 'auto', borderRadius: '8px', objectFit: 'cover', border: '1px solid #eee' }} />
                      ))}
                    </div>
                    
                    <div style={{ fontSize: '0.9rem', color: '#555', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ margin: 0 }}><strong>📅 Date:</strong> {new Date(item.dateFound || item.createdAt ).toLocaleString()}</p>
                      <p style={{ margin: 0 }}><strong>👤 Finder:</strong> {item.reportedBy?.username || item.reportedBy?.email}</p>
                      <p style={{ margin: 0 }}><strong>📍 Public Location:</strong> {item.location}</p>
                      {item.exactLocation && (
                        <p style={{ margin: 0, color: '#d9534f' }}><strong>🕵️ Exact Location (Hidden):</strong> {item.exactLocation}</p>
                      )}
                      <div style={{ marginTop: '5px', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '6px', border: '1px solid #e9e9e9' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem' }}><strong>Description:</strong> {item.description}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.disputeActions} style={{ padding: '15px', borderTop: '1px solid #eee', marginTop: 'auto' }}>
                    <button className={styles.resolveBtn} onClick={() => handleApproveItem(item._id)} style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} disabled={approvingId === item._id}>
                      {approvingId === item._id ? <><div className={styles.buttonSpinner}></div> Approving...</> : '✅ Approve'}
                    </button>
                    <button className={styles.refundBtn} onClick={() => openRejectItemModal(item._id)} style={{ flex: 1, padding: '10px' }}>❌ Reject</button>
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
            <div className={styles.disputesList} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
              {pendingClaims.map((claim, index) => (
                <div key={index} className={styles.disputeCard} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div className={styles.disputeHeader} style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#333' }}>Claim for: {claim.itemId?.shortTitle}</h3>
                    <span className={styles.rewardBadge} style={{ fontSize: '0.8rem', padding: '4px 8px', backgroundColor: '#eef2ff', color: '#4f46e5' }}>Claim</span>
                  </div>
                  
                  <div style={{ padding: '1rem', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}><strong>📅 Date:</strong> {new Date(claim.createdAt ).toLocaleString()}</p>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}><strong>👤 Owner:</strong> {claim.claimantId?.username || claim.claimantId?.email}</p>
                    
                    <div style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '6px', border: '1px solid #ffeeba', fontSize: '0.9rem' }}>
                      <strong style={{ color: '#856404' }}>Secret Guess:</strong>
                      <p style={{ margin: '5px 0 0 0', color: '#333' }}>{claim.secretGuess}</p>
                    </div>

                    {claim.proofImage && (
                      <div style={{ marginTop: '8px' }}>
                        <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', fontWeight: 'bold', color: '#555' }}>📸 Proof Photo:</p>
                        <img src={claim.proofImage} alt="Owner Proof" style={{ height: '150px', width: '100%', borderRadius: '8px', objectFit: 'contain', backgroundColor: '#f5f5f5', border: '1px solid #eee' }} />
                      </div>
                    )}
                    
                    <details open style={{ marginTop: '10px', border: '1px solid #ddd', borderRadius: '6px', overflow: 'hidden' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 'bold', padding: '10px', backgroundColor: '#f8f9fa', fontSize: '0.9rem', userSelect: 'none' }}>
                        💬 AI Interview Transcript
                      </summary>
                      <div style={{ background: '#fff', padding: '12px', maxHeight: '250px', overflowY: 'auto', fontSize: '0.85rem' }}>
                        {claim.answers?.map((msg, i) => (
                          <div key={i} style={{ marginBottom: '8px', padding: '8px', backgroundColor: msg.role === 'ai' ? '#f0f7ff' : '#f5f5f5', borderRadius: '6px' }}>
                            <strong style={{ color: msg.role === 'ai' ? '#0066cc' : '#333' }}>{msg.role === 'ai' ? '🤖 AI' : '👤 Owner'}:</strong> 
                            <span style={{ marginLeft: '6px', whiteSpace: 'pre-wrap' }}>{msg.text}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                  
                  <div className={styles.disputeActions} style={{ padding: '15px', borderTop: '1px solid #eee', marginTop: 'auto' }}>
                    <button className={styles.resolveBtn} onClick={() => handleApproveClaim(claim._id)} style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} disabled={approvingId === claim._id}>
                      {approvingId === claim._id ? <><div className={styles.buttonSpinner}></div> Approving...</> : '✅ Approve'}
                    </button>
                    <button className={styles.refundBtn} onClick={() => openRejectClaimModal(claim._id)} style={{ flex: 1, padding: '10px' }}>❌ Reject</button>
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
      {/* Rejection Modal */}
      {rejectModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Reject {rejectType === 'item' ? 'Item Report' : 'Claim'}</h3>
            </div>
            <div className={styles.modalBody}>
              <p style={{ marginBottom: '8px' }}>Please provide a reason for rejection. This will be sent to the {rejectType === 'item' ? 'finder' : 'owner'}.</p>
              <textarea 
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Type your feedback here..."
                style={{ width: '100%', minHeight: '100px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontFamily: 'inherit' }}
              />
            </div>
            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelBtn} 
                onClick={() => setRejectModalOpen(false)}
                disabled={isRejecting}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmRefundBtn}
                onClick={submitRejection}
                disabled={isRejecting || !rejectReason.trim()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {isRejecting ? <><div className={styles.buttonSpinner}></div> Rejecting...</> : 'Submit Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;


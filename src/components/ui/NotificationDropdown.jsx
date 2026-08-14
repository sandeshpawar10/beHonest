import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './NotificationDropdown.module.css';

function NotificationDropdown() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/notifications`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.notifications.filter(n => !n.isRead).length);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/notifications/read/${id}`, {
        method: 'PUT',
        credentials: 'include'
      });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/notifications/read-all`, {
        method: 'PUT',
        credentials: 'include'
      });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await markAsRead(notif._id);
    }
    setIsOpen(false);

    // Route based on type
    if (notif.type === 'CHAT_MESSAGE' && notif.relatedItemId) {
      navigate(`/chat/${notif.relatedItemId}`);
    } else if ((notif.type === 'CLAIM_VERDICT' || notif.type === 'DISPUTE_RAISED' || notif.type === 'REWARD_RELEASED' || notif.type === 'REFUND') && notif.relatedItemId) {
      navigate(`/escrow`); // Could go to specific item, but escrow dashboard is good
    }
  };

  return (
    <div className={styles.dropdownContainer} ref={dropdownRef}>
      <button 
        className={styles.bellButton} 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdownMenu}>
          <div className={styles.dropdownHeader}>
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className={styles.markAllBtn} onClick={markAllAsRead}>
                Mark all as read
              </button>
            )}
          </div>
          
          <div className={styles.notificationList}>
            {notifications.length === 0 ? (
              <div className={styles.emptyState}>No notifications yet.</div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif._id} 
                  className={`${styles.notificationItem} ${!notif.isRead ? styles.unread : ''}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className={styles.notifTitle}>{notif.title}</div>
                  <div className={styles.notifMessage}>{notif.message}</div>
                  <div className={styles.notifTime}>
                    {new Date(notif.createdAt).toLocaleDateString()} {new Date(notif.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationDropdown;

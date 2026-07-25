/* ============================================================
   ChatPage.jsx
   Route: /chat/:escrowId (protected)

   A secure, anonymous chat room for a specific escrow transaction.
   Only the Finder and the Owner of the item can access this page.
   They can communicate to arrange a meetup without sharing
   their personal contact information.
   ============================================================ */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './ChatPage.module.css';

function ChatPage() {
  const { escrowId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  
  const [escrow, setEscrow] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState('');
  
  // Reference to the bottom of the messages list to auto-scroll
  const messagesEndRef = useRef(null);

  // ── 1. Load Data & Verify Access on Mount ──
  useEffect(() => {
    const fetchChatAndEscrow = async () => {
      if (!session) return;
      try {
        const chatRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/chat/${escrowId}`, {
          credentials: 'include'
        });
        
        if (!chatRes.ok) {
          if (chatRes.status === 403 || chatRes.status === 401) {
            setError('Access Denied. You are not authorized to view this chat.');
          } else {
            setError('Chat room not found or access denied.');
          }
          return;
        }

        const chatData = await chatRes.json();
        setMessages(chatData.messages || []);
        setUserRole(chatData.userRole);

        const escrowsRes = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/escrow/my-escrows`, {
          credentials: 'include'
        });
        if (escrowsRes.ok) {
          const escrowsData = await escrowsRes.json();
          const allEscrows = [...(escrowsData.asOwner || []), ...(escrowsData.asFinder || [])];
          const found = allEscrows.find(e => e._id === escrowId);
          if (found) {
            setEscrow(found);
          } else {
            setEscrow({ _id: escrowId, itemTitle: 'Item' });
          }
        } else {
          setEscrow({ _id: escrowId, itemTitle: 'Item' });
        }
      } catch (err) {
        console.error(err);
        setError('Error connecting to server.');
      }
    };

    fetchChatAndEscrow();
    const interval = setInterval(fetchChatAndEscrow, 3000);
    return () => clearInterval(interval);
  }, [escrowId, session]);

  // ── 2. Auto-scroll to bottom when messages change ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── 3. Handle Sending a Message ──
  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !escrow) return;

    const firstName = session?.username || session?.email?.split('@')[0] || 'User';
    const messageText = inputText;
    setInputText('');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          escrowId,
          message: messageText,
          senderAlias: firstName
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.chatMessage]);
      } else {
        console.error('Failed to send message');
        setInputText(messageText);
      }
    } catch (err) {
      console.error(err);
      setInputText(messageText);
    }
  };

  // ── Render Error State ──
  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.errorState}>
          <h2>🛑 Access Denied</h2>
          <p>{error}</p>
          <button className={styles.backBtn} onClick={() => navigate('/escrow')} style={{ marginTop: '20px' }}>
            ← Back to Escrow Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Render Loading State ──
  if (!escrow) {
    return <div className={styles.page}>Loading chat...</div>;
  }

  // Determine who the current user is in this context
  const iAmOwner = userRole === 'owner';
  const myRole = iAmOwner ? 'Owner' : 'Finder';
  const theirRole = iAmOwner ? 'Finder' : 'Owner';

  return (
    <div className={styles.page}>
      
      {/* ── Top Bar ── */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate('/escrow')}>
          ← Back to Escrow
        </button>
        
        {/* Context Badge showing what item this chat is about */}
        <div className={styles.contextBadge}>
          📦 {escrow.itemTitle}
        </div>
      </div>

      {/* ── Chat Interface ── */}
      <div className={styles.chatContainer}>
        
        {/* Header */}
        <div className={styles.chatHeader}>
          <div className={styles.avatar}>
            {theirRole === 'Owner' ? '👑' : '🕵️'}
          </div>
          <div className={styles.headerInfo}>
            <h2>Chat with {theirRole}</h2>
            <p>Arrange a secure meetup. Your contact details are hidden.</p>
          </div>
        </div>

        {/* Messages Area */}
        <div className={styles.messagesArea}>
          {messages.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No messages yet.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>
                Say hi and figure out a safe public place on campus to return the item!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = String(msg.senderId) === String(session?._id);
              return (
                <div 
                  key={msg._id} 
                  className={`${styles.messageWrapper} ${isMe ? styles.sent : styles.received}`}
                >
                  <span className={styles.messageSender}>
                    {isMe ? 'You' : msg.senderAlias}
                  </span>
                  <div className={styles.messageBubble}>
                    {msg.message}
                  </div>
                  <span className={styles.messageTime}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
          {/* Invisible div to anchor the auto-scroll */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form className={styles.inputArea} onSubmit={handleSend}>
          <input
            type="text"
            className={styles.chatInput}
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            maxLength={500}
          />
          <button 
            type="submit" 
            className={styles.sendBtn}
            disabled={!inputText.trim()}
            aria-label="Send message"
          >
            ➤
          </button>
        </form>

      </div>
    </div>
  );
}

export default ChatPage;

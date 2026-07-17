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
import { getEscrowForItem, getAllEscrows } from '../utils/rewardUtils';
import { getMessagesForEscrow, sendMessage } from '../utils/chatUtils';
import styles from './ChatPage.module.css';

function ChatPage() {
  const { escrowId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  
  const [escrow, setEscrow] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState('');
  
  // Reference to the bottom of the messages list to auto-scroll
  const messagesEndRef = useRef(null);

  // ── 1. Load Data & Verify Access on Mount ──
  useEffect(() => {
    // Find the escrow record
    const all = getAllEscrows();
    const foundEscrow = all.find(e => e.id === escrowId);
    
    if (!foundEscrow) {
      setError('Chat room not found or escrow does not exist.');
      return;
    }

    // Verify access: Only the depositor (owner) or finder can view this chat
    const isOwner = foundEscrow.depositorEmail === session?.email;
    const isFinder = foundEscrow.finderEmail === session?.email;

    if (!isOwner && !isFinder) {
      setError('Access Denied. You are not authorized to view this chat.');
      return;
    }

    setEscrow(foundEscrow);
    
    // Load existing messages
    setMessages(getMessagesForEscrow(escrowId));
  }, [escrowId, session]);

  // ── 2. Auto-scroll to bottom when messages change ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── 3. Handle Sending a Message ──
  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !escrow) return;

    // Use Option 2: First Name only to keep it friendly but anonymous
    const firstName = session.fullName.split(' ')[0];

    const newMsg = sendMessage(
      escrowId, 
      session.email, 
      firstName, 
      inputText
    );

    // Update local state so it appears instantly
    setMessages(prev => [...prev, newMsg]);
    setInputText('');
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
  const iAmOwner = escrow.depositorEmail === session?.email;
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
              const isMe = msg.senderEmail === session?.email;
              return (
                <div 
                  key={msg.id} 
                  className={`${styles.messageWrapper} ${isMe ? styles.sent : styles.received}`}
                >
                  <span className={styles.messageSender}>
                    {isMe ? 'You' : msg.senderName}
                  </span>
                  <div className={styles.messageBubble}>
                    {msg.text}
                  </div>
                  <span className={styles.messageTime}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

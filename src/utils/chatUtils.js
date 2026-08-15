/* ============================================================
   chatUtils.js — Anonymous Chat Storage Utility
   
   Handles saving and retrieving chat messages from localStorage.
   Each message is tied to a specific escrow transaction (escrowId),
   ensuring that only the finder and the owner of that item can
   see the messages.
   ============================================================ */

const CHAT_KEY = 'bh_chats';

/**
 * Get all messages for a specific escrow transaction.
 * @param {string} escrowId 
 * @returns {Array} Array of message objects sorted by timestamp
 */
export function getMessagesForEscrow(escrowId) {
  const raw = localStorage.getItem(CHAT_KEY);
  if (!raw) return [];

  try {
    const allMessages = JSON.parse(raw);
    // Filter messages that belong to this escrowId
    const roomMessages = allMessages.filter(msg => msg.escrowId === escrowId);
    // Sort chronologically (oldest to newest)
    return roomMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  } catch (err) {
    console.error('Error parsing chat data:', err);
    return [];
  }
}

/**
 * Send a new message in an escrow chat room.
 * @param {string} escrowId - The ID of the escrow transaction
 * @param {string} senderEmail - The email of the person sending the message
 * @param {string} senderName - The display name of the sender (e.g. first name)
 * @param {string} text - The message content
 * @returns {Object} The saved message object
 */
export function sendMessage(escrowId, senderEmail, senderName, text) {
  const raw = localStorage.getItem(CHAT_KEY);
  let allMessages = [];
  
  if (raw) {
    try {
      allMessages = JSON.parse(raw);
    } catch {
      allMessages = [];
    }
  }

  const newMessage = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    escrowId,
    senderEmail,
    senderName,
    text: text.trim(),
    timestamp: new Date().toISOString()
  };

  allMessages.push(newMessage);
  localStorage.setItem(CHAT_KEY, JSON.stringify(allMessages));

  return newMessage;
}

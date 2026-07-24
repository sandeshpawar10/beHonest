const express = require("express");
const router = express.Router();
const { verifyJWT } = require("../middlewares/authMiddleware");
const controller = require("../controllers/chatController");

// Send a new anonymous chat message
router.post('/api/chat/send', verifyJWT, controller.sendMessage);

// Get all messages for an escrow chat
router.get('/api/chat/:escrowId', verifyJWT, controller.getMessages);

module.exports = router;

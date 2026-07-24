const express = require("express");
const router = express.Router();
const { verifyJWT } = require("../middlewares/authMiddleware");
const controller = require("../controllers/escrowController");

// Create a new escrow (after verified claim + reward selection)
router.post('/api/escrow/create', verifyJWT, controller.createEscrow);

// Get all escrows for the logged-in user (as owner OR finder)
router.get('/api/escrow/my-escrows', verifyJWT, controller.getMyEscrows);

// Release escrow (finder enters PIN)
router.post('/api/escrow/release/:escrowId', verifyJWT, controller.releaseEscrow);

// Refund escrow (owner requests refund)
router.post('/api/escrow/refund/:escrowId', verifyJWT, controller.refundEscrow);

module.exports = router;

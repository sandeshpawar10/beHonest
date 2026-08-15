const express = require("express");
const router = express.Router();
const { verifyJWT } = require("../middlewares/authMiddleware");
const controller = require("../controllers/escrowController");

// Create a new escrow (after verified claim + reward selection)
router.post('/api/escrow/create', verifyJWT, controller.createEscrow);

// Verify Razorpay payment
router.post('/api/escrow/verify-payment', verifyJWT, controller.verifyPayment);

// Get all escrows for the logged-in user (as owner OR finder)
router.get('/api/escrow/my-escrows', verifyJWT, controller.getMyEscrows);

// Confirm handover (owner or finder confirms)
router.post('/api/escrow/confirm/:escrowId', verifyJWT, controller.confirmHandover);

// Raise dispute
router.post('/api/escrow/dispute/:escrowId', verifyJWT, controller.raiseDispute);

// Refund escrow (owner requests refund)
router.post('/api/escrow/refund/:escrowId', verifyJWT, controller.refundEscrow);

module.exports = router;

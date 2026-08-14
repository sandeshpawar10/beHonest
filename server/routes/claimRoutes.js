const express = require("express");
const router = express.Router();
const { verifyJWT } = require("../middlewares/authMiddleware");
const controller = require("../controllers/claimController");

// Evaluate a new AI verification claim result
router.post('/api/claim/evaluate', verifyJWT, controller.evaluateClaim);

// Get all claims for a specific item
router.get('/api/claim/item/:itemId', verifyJWT, controller.getClaimsForItem);

// Get all claims made by the logged-in user
router.get('/api/claim/my-claims', verifyJWT, controller.getMyClaims);

module.exports = router;

const express = require("express");
const router = express.Router();
const { verifyJWT } = require("../middlewares/authMiddleware");
const controller = require("../controllers/claimController");

// Save a new AI verification claim result
router.post('/api/claim/create', verifyJWT, controller.createClaim);

// Get all claims for a specific item
router.get('/api/claim/item/:itemId', verifyJWT, controller.getClaimsForItem);

// Get all claims made by the logged-in user
router.get('/api/claim/my-claims', verifyJWT, controller.getMyClaims);

module.exports = router;

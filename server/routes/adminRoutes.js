const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const adminOriginalImagesController = require("../controllers/adminOriginalImagesController");
const { verifyAdmin } = require("../middlewares/adminMiddleware");
const { getLegacyItemsCount, getLegacyItemsBreakdown, getLegacyItemsList } = require("../utils/legacyImageChecker");
const { getAllConnectedSockets, getSocketStats, testRoomAuthorization } = require("../utils/socketTestingUtils");
const rateLimit = require("express-rate-limit");

// ── Rate Limiter for Admin Login ──
// Limits an IP to 5 login attempts every 15 minutes
const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
        error: "Too many login attempts. Please try again after 15 minutes."
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// ── Rate Limiter for Original Image Access ──
// Limits access to original images to prevent abuse
const originalImagesLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // Max 20 requests per 5 minutes per IP
    message: {
        error: "Too many requests for original images. Please try again later."
    },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post("/api/admin/login", adminLoginLimiter, adminController.adminLogin);
router.post("/api/admin/logout", verifyAdmin, adminController.adminLogout);
router.post("/api/admin/refresh", adminController.refreshAdminToken);
router.get("/api/admin/disputes", verifyAdmin, adminController.getAllDisputes);
router.post("/api/admin/resolve/:escrowId", verifyAdmin, adminController.resolveDispute);
router.get("/api/admin/stats", verifyAdmin, adminController.getAdminStats);
router.get("/api/admin/pending-items", verifyAdmin, adminController.getPendingItems);
router.get("/api/admin/pending-claims", verifyAdmin, adminController.getPendingClaims);
router.put("/api/admin/item/:id/approve", verifyAdmin, adminController.approveItem);
router.put("/api/admin/item/:id/reject", verifyAdmin, adminController.rejectItem);
router.put("/api/admin/claim/:id/approve", verifyAdmin, adminController.approveClaim);
router.put("/api/admin/claim/:id/reject", verifyAdmin, adminController.rejectClaim);
router.get("/api/admin/pending-payouts", verifyAdmin, adminController.getPendingPayouts);
router.post("/api/admin/mark-payout-complete/:escrowId", verifyAdmin, adminController.markPayoutComplete);

// ── Original Images Access (Admin Only) ──
// View unredacted original images with audit logging
router.get("/api/admin/item/:itemId/original-images", verifyAdmin, originalImagesLimiter, adminOriginalImagesController.getOriginalImages);
router.get("/api/admin/item/:itemId/original-images/audit", verifyAdmin, adminOriginalImagesController.getOriginalImageAuditLog);

// ── Legacy Items Management ──
// Check legacy items for migration planning
router.get("/api/admin/legacy-items/count", verifyAdmin, async (req, res) => {
    try {
        const count = await getLegacyItemsCount();
        const breakdown = await getLegacyItemsBreakdown();
        res.json({ count, breakdown });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch legacy items count" });
    }
});

router.get("/api/admin/legacy-items/list", verifyAdmin, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const items = await getLegacyItemsList(limit);
        res.json({ items, count: items.length });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch legacy items list" });
    }
});

// ── Socket.IO Testing & Monitoring ──
// Admin tools to verify socket connections and authorization
router.get("/api/admin/socket/stats", verifyAdmin, (req, res) => {
    try {
        const io = req.app.get('io');
        const stats = getSocketStats(io);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch socket stats" });
    }
});

router.get("/api/admin/socket/connections", verifyAdmin, (req, res) => {
    try {
        const io = req.app.get('io');
        const connections = getAllConnectedSockets(io);
        res.json({ connections, count: connections.length });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch socket connections" });
    }
});

router.post("/api/admin/socket/test-authorization", verifyAdmin, async (req, res) => {
    try {
        const { userId, roomType, roomId } = req.body;
        const io = req.app.get('io');
        const result = await testRoomAuthorization(io, userId, roomType, roomId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: "Failed to test authorization" });
    }
});

module.exports = router;

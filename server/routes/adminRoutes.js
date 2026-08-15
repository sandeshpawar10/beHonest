const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { verifyAdmin } = require("../middlewares/adminMiddleware");
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

router.post("/api/admin/login", adminLoginLimiter, adminController.adminLogin);
router.post("/api/admin/logout", verifyAdmin, adminController.adminLogout);
router.post("/api/admin/refresh", adminController.refreshAdminToken);
router.get("/api/admin/disputes", verifyAdmin, adminController.getAllDisputes);
router.post("/api/admin/resolve/:escrowId", verifyAdmin, adminController.resolveDispute);
router.get("/api/admin/stats", verifyAdmin, adminController.getAdminStats);

module.exports = router;

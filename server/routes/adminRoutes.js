const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { verifyAdmin } = require("../middlewares/adminMiddleware");

router.post("/api/admin/login", adminController.adminLogin);
router.post("/api/admin/logout", verifyAdmin, adminController.adminLogout);
router.get("/api/admin/disputes", verifyAdmin, adminController.getAllDisputes);
router.post("/api/admin/resolve/:escrowId", verifyAdmin, adminController.resolveDispute);
router.get("/api/admin/stats", verifyAdmin, adminController.getAdminStats);

module.exports = router;

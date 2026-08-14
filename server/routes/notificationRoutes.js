const express = require('express');
const router = express.Router();
const controller = require('../controllers/notificationController');
const { verifyJWT } = require('../middlewares/authMiddleware');

router.get('/api/notifications', verifyJWT, controller.getNotifications);
router.put('/api/notifications/read/:id', verifyJWT, controller.markAsRead);
router.put('/api/notifications/read-all', verifyJWT, controller.markAllAsRead);

module.exports = router;

const notificationModel = require('../models/notificationModel');

// Helper to create notifications internally from other controllers
exports.createNotification = async function(userId, type, title, message, relatedItemId = "") {
    try {
        await notificationModel.create({
            userId,
            type,
            title,
            message,
            relatedItemId
        });
        return true;
    } catch (error) {
        console.error("Error creating notification:", error);
        return false;
    }
};

// Fetch notifications for the logged-in user
exports.getNotifications = async function(req, res) {
    try {
        const userId = req.user._id;
        // Fetch last 50 notifications, newest first
        const notifications = await notificationModel.find({ userId })
            .sort({ createdAt: -1 })
            .limit(50);
        
        return res.status(200).json({ status: "success", notifications });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

// Mark a single notification as read
exports.markAsRead = async function(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const notification = await notificationModel.findOneAndUpdate(
            { _id: id, userId: userId },
            { isRead: true },
            { returnDocument: 'after' }
        );

        if (!notification) {
            return res.status(404).json({ error: "Notification not found" });
        }

        return res.status(200).json({ status: "success", notification });
    } catch (error) {
        console.error("Error marking notification as read:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

// Mark all notifications as read
exports.markAllAsRead = async function(req, res) {
    try {
        const userId = req.user._id;
        await notificationModel.updateMany(
            { userId: userId, isRead: false },
            { $set: { isRead: true } }
        );
        return res.status(200).json({ status: "success", message: "All notifications marked as read" });
    } catch (error) {
        console.error("Error marking all as read:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

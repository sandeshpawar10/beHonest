const itemModel = require("../models/foundItemModel");

/**
 * Check how many legacy items exist (items without imagePrivacyVersion: 1)
 * Run this after deployment to understand migration needs
 */
async function getLegacyItemsCount() {
    try {
        const count = await itemModel.countDocuments({
            imagePrivacyVersion: { $ne: 1 }
        });
        return count;
    } catch (error) {
        console.error("Error counting legacy items:", error);
        return null;
    }
}

/**
 * Get detailed breakdown of legacy items by status
 */
async function getLegacyItemsBreakdown() {
    try {
        const breakdown = await itemModel.aggregate([
            { $match: { imagePrivacyVersion: { $ne: 1 } } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        return breakdown;
    } catch (error) {
        console.error("Error getting legacy items breakdown:", error);
        return [];
    }
}

/**
 * Get list of legacy items with basic info (for admin review)
 */
async function getLegacyItemsList(limit = 50) {
    try {
        const items = await itemModel.find({
            imagePrivacyVersion: { $ne: 1 }
        })
        .select('shortTitle category status images createdAt reportedBy')
        .populate('reportedBy', 'email name')
        .limit(limit)
        .sort('-createdAt');

        return items;
    } catch (error) {
        console.error("Error getting legacy items list:", error);
        return [];
    }
}

module.exports = {
    getLegacyItemsCount,
    getLegacyItemsBreakdown,
    getLegacyItemsList
};

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const escrowModel = require("../models/escrowModel");
const userModel = require("../models/userModel");
const itemModel = require("../models/foundItemModel");
const chatModel = require("../models/chatModel");
const claimModel = require("../models/claimModel");
const { createNotification } = require("./notificationController");
const { sendApprovalEmail, sendRejectionEmail } = require("../utils/emailUtils");

const adminModel = require("../models/adminModel");

exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check directly against environment variables!
        const validEmail = process.env.ADMIN_EMAIL;
        const validPassword = process.env.ADMIN_PASSWORD;

        if (email.toLowerCase() !== validEmail.toLowerCase() || password !== validPassword) {
            return res.status(401).json({ 
                error: "Invalid admin credentials", 
                message: "Incorrect email or password." 
            });
        }

        // We don't need the database anymore, just generate a simple JWT
        const accesstoken = jwt.sign(
            { role: "superadmin", email: validEmail },
            process.env.access_token_secret,
            { expiresIn: process.env.access_token_expiry || "15m" }
        );
        
        const refreshtoken = jwt.sign(
            { role: "superadmin" },
            process.env.refresh_token_secret,
            { expiresIn: process.env.refresh_token_expiry || "7d" }
        );

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
            path: '/'
        };

        return res.status(200)
            .cookie("adminaccesstoken", accesstoken, options)
            .cookie("adminrefreshtoken", refreshtoken, options)
            .json({ status: "success", message: "Admin logged in successfully" });

    } catch (error) {
        console.error("Error in adminLogin:", error);
        return res.status(500).json({ error: "Internal server error", message: `Server error: ${error.message}` });
    }
};

exports.getAllDisputes = async (req, res) => {
    try {
        const disputes = await escrowModel.find({ status: "disputed" })
            .populate("itemId")
            .populate("depositorId", "email username")
            .populate("finderId", "email username")
            .populate("disputeRaisedBy", "email username");

        return res.status(200).json({ status: "success", disputes });
    } catch (error) {
        console.error("Error in getAllDisputes:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

exports.resolveDispute = async (req, res) => {
    try {
        const { escrowId } = req.params;
        const { resolution } = req.body;

        if (!["release_to_finder", "refund_to_owner"].includes(resolution)) {
            return res.status(400).json({ error: "Invalid resolution type." });
        }

        const escrow = await escrowModel.findById(escrowId);
        if (!escrow) {
            return res.status(404).json({ error: "Escrow not found." });
        }

        if (escrow.status !== "disputed") {
            return res.status(400).json({ error: "Escrow is not in disputed status." });
        }

        escrow.adminResolvedAt = new Date();
        escrow.adminResolution = resolution;

        const item = await itemModel.findById(escrow.itemId);
        const owner = await userModel.findById(escrow.depositorId);
        const finder = await userModel.findById(escrow.finderId);

        if (resolution === "release_to_finder") {
            escrow.status = "released";
            escrow.payoutStatus = "pending"; // Admin needs to pay finder
            if (item && finder) {
                const { sendRewardReleasedEmail } = require('../utils/emailUtils');
                sendRewardReleasedEmail(finder.email, item.shortTitle, escrow.amount, escrow.finderUpiId).catch(console.error);

                await createNotification(
                    finder._id,
                    'REWARD_RELEASED',
                    'Dispute Resolved in Your Favor! 🎉',
                    `The dispute for ${item.shortTitle} was resolved in your favor. ₹${escrow.amount} will be transferred to your UPI within 2-3 business days.`,
                    escrow._id
                );
            }
            await itemModel.deleteOne({ _id: escrow.itemId });
            await claimModel.deleteMany({itemId: escrow.itemId})
            await chatModel.deleteMany({escrowId: escrow._id})
        } else if (resolution === "refund_to_owner") {
            escrow.status = "refunded";
            if (item && owner) {
                const { sendRefundEmail } = require('../utils/emailUtils');
                sendRefundEmail(owner.email, item.shortTitle, escrow.amount).catch(console.error);

                await createNotification(
                    owner._id,
                    'REFUND',
                    'Dispute Resolved — Refund Initiated',
                    `The dispute for ${item.shortTitle} was resolved in your favor. Your refund of ₹${escrow.amount} has been initiated and may take 5-7 business days to reflect in your account.`,
                    escrow._id
                );
            }
            // Reset the item so it can be claimed again
            await itemModel.findByIdAndUpdate(escrow.itemId, { status: "found" });
            await claimModel.deleteMany({ itemId: escrow.itemId });
        }

        await escrow.save();

        return res.status(200).json({ status: "success", message: "Dispute resolved successfully", escrow });
    } catch (error) {
        console.error("Error in resolveDispute:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

exports.getAdminStats = async (req, res) => {
    try {
        const totalUsers = await userModel.countDocuments();
        const totalItems = await itemModel.countDocuments();
        const totalEscrows = await escrowModel.countDocuments();
        const disputedEscrows = await escrowModel.countDocuments({ status: "disputed" });

        return res.status(200).json({
            status: "success",
            stats: {
                totalUsers,
                totalItems,
                totalEscrows,
                disputedEscrows
            }
        });
    } catch (error) {
        console.error("Error in getAdminStats:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

exports.adminLogout = async (req, res) => {
    try {
        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/'
        };

        return res.status(200)
            .clearCookie("adminaccesstoken", options)
            .clearCookie("adminrefreshtoken", options)
            .json({ status: "success", message: "Admin logged out successfully" });
    } catch (error) {
        console.error("Error in adminLogout:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

exports.refreshAdminToken = async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies?.adminrefreshtoken;
        if (!incomingRefreshToken) {
            return res.status(401).json({ error: "Unauthorized request" });
        }

        // Just verify it's a valid token for our env
        jwt.verify(incomingRefreshToken, process.env.refresh_token_secret);
        
        // Generate new tokens directly using env vars
        const validEmail = process.env.ADMIN_EMAIL;
        
        const accesstoken = jwt.sign(
            { role: "superadmin", email: validEmail },
            process.env.access_token_secret,
            { expiresIn: process.env.access_token_expiry || "15m" }
        );
        
        const newRefreshToken = jwt.sign(
            { role: "superadmin" },
            process.env.refresh_token_secret,
            { expiresIn: process.env.refresh_token_expiry || "7d" }
        );

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/'
        };

        return res.status(200)
            .cookie("adminaccesstoken", accesstoken, options)
            .cookie("adminrefreshtoken", newRefreshToken, options)
            .json({ message: "Admin Access token refreshed" });

    } catch (error) {
        return res.status(401).json({ error: error?.message || "Invalid refresh token" });
    }
};

exports.approveItem = async (req,res) => {
    try {
        const item = await itemModel.findById(req.params.id).populate("reportedBy")
        if(!item){
            return res.status(404).json({ error: "Item not found" }); 
        }
        item.status = "found"
        item.adminFeedback = "";
        await item.save();
        if (item.reportedBy && item.reportedBy.email) {
            const { sendApprovalEmail } = require('../utils/emailUtils');
            await sendApprovalEmail(item.reportedBy.email, "Item", item.shortTitle);
            await createNotification(item.reportedBy._id, 'SYSTEM', 'Item Approved', `Your found item report for ${item.shortTitle} has been approved and is now live.`, item._id);
            
            const io = req.app.get('io');
            if (io) {
                io.to(item.reportedBy._id.toString()).emit('new_notification');
                io.to(item.reportedBy._id.toString()).emit('item_updated');
            }
        }
        return res.status(200).json({ message: "Item approved and is now live." });
    } catch (error) {
        return res.status(500).json({ error: "Internal server error" });
    }
}

exports.rejectItem = async (req,res) => {
    try {
        const { feedback } = req.body;
        if (!feedback) return res.status(400).json({ error: "Feedback is required for rejection." });
        const item = await itemModel.findById(req.params.id).populate("reportedBy")
        if(!item){
            return res.status(404).json({ error: "Item not found" }); 
        }
        if(item.hasResubmitted){
            item.status = "permanently_rejected";
        }
        else{
            item.status = "rejected"
        }
        item.adminFeedback = feedback;
        await item.save()
        if (item.reportedBy && item.reportedBy.email) {
            const { sendRejectionEmail } = require('../utils/emailUtils');
            await sendRejectionEmail(item.reportedBy.email, "Item", item.shortTitle, feedback, item.hasResubmitted);
            await createNotification(item.reportedBy._id, 'SYSTEM', 'Item Rejected', `Your found item report for ${item.shortTitle} was rejected. Reason: ${feedback}`, item._id);
            
            const io = req.app.get('io');
            if (io) {
                io.to(item.reportedBy._id.toString()).emit('new_notification');
                io.to(item.reportedBy._id.toString()).emit('item_updated');
            }
        }
        return res.status(200).json({ message: "Item rejected and user notified." });
    } catch (error) {
        return res.status(500).json({ error: "Internal server error" });
    }
}

exports.approveClaim = async (req,res)=>{
    try {
        const claim = await claimModel.findById(req.params.id).populate("claimantId").populate("itemId");
        if(!claim){
            return res.status(404).json({ error: "Claim not found" });
        }
        claim.verdict = "verified";
        claim.adminFeedback = "";
        await claim.save()
        await itemModel.findByIdAndUpdate(claim.itemId, {
            status: "claimed"
        })
        if (claim.claimantId && claim.claimantId.email) {
            const { sendApprovalEmail } = require('../utils/emailUtils');
            await sendApprovalEmail(claim.claimantId.email, "Claim", claim.itemId?.shortTitle || "Item");
            await createNotification(claim.claimantId._id, 'CLAIM_VERDICT', 'Claim Approved', `Your claim for ${claim.itemId?.shortTitle || "Item"} has been approved! Proceed to pay the escrow reward.`, claim.itemId._id);
            
            // Emit real-time notification & claim update to user
            const io = req.app.get('io');
            if (io) {
                io.to(claim.claimantId._id.toString()).emit('new_notification');
                io.to(claim.claimantId._id.toString()).emit('claim_updated');
            }
        }
        return res.status(200).json({ message: "Claim approved and is now live." });
    } catch (error) {
        return res.status(500).json({ error: "Internal server error" });
    }
}

exports.rejectClaim = async (req,res)=>{
    try {
        const { feedback } = req.body;
        if (!feedback) return res.status(400).json({ error: "Feedback is required for rejection." });
        const claim = await claimModel.findById(req.params.id).populate("claimantId").populate("itemId");
        if(!claim){
            return res.status(404).json({ error: "Claim not found" });
        }
        if(claim.hasResubmitted){
            claim.verdict = "permanently_rejected"
        }
        else{
            claim.verdict = "rejected";
        }
        claim.adminFeedback = feedback;
        await claim.save()
        if (claim.claimantId && claim.claimantId.email) {
            const { sendRejectionEmail } = require('../utils/emailUtils');
            await sendRejectionEmail(claim.claimantId.email, "Claim", claim.itemId?.shortTitle || "Item", feedback, claim.hasResubmitted);
            await createNotification(claim.claimantId._id, 'CLAIM_VERDICT', 'Claim Rejected', `Your claim for ${claim.itemId?.shortTitle || "Item"} was rejected. Reason: ${feedback}`, claim.itemId._id);
            
            const io = req.app.get('io');
            if (io) {
                io.to(claim.claimantId._id.toString()).emit('new_notification');
                io.to(claim.claimantId._id.toString()).emit('claim_updated');
            }
        }
        return res.status(200).json({ message: "Claim rejected and user notified." });
    } catch (error) {
        return res.status(500).json({ error: "Internal server error" });
    }
}

exports.getPendingItems = async function(req, res) {
    try {
        const items = await itemModel.find({ status: "pending_admin_review" }).populate("reportedBy", "email username");
        return res.status(200).json({ items });
    } catch (err) {
        console.error("Error fetching pending items:", err);
        return res.status(500).json({ error: "Server error" });
    }
};

exports.getPendingClaims = async function(req, res) {
    try {
        const claims = await claimModel.find({ verdict: "pending_admin_review" })
            .populate("claimantId", "email username")
            .populate("itemId", "shortTitle images");
        return res.status(200).json({ claims });
    } catch (err) {
        console.error("Error fetching pending claims:", err);
        return res.status(500).json({ error: "Server error" });
    }
};

// ── Payouts: Get all escrows that need manual payout ──
exports.getPendingPayouts = async function(req, res) {
    try {
        const payouts = await escrowModel.find({ 
            status: "released", 
            payoutStatus: "pending" 
        })
            .populate("itemId", "shortTitle")
            .populate("depositorId", "email username")
            .populate("finderId", "email username")
            .sort({ updatedAt: 1 }); // oldest first so admin pays in order

        // Also get recently completed payouts for reference
        const completedPayouts = await escrowModel.find({
            payoutStatus: "completed"
        })
            .populate("itemId", "shortTitle")
            .populate("finderId", "email username")
            .sort({ payoutCompletedAt: -1 })
            .limit(20);

        return res.status(200).json({ 
            status: "success", 
            pendingPayouts: payouts,
            completedPayouts 
        });
    } catch (err) {
        console.error("Error fetching pending payouts:", err);
        return res.status(500).json({ error: "Server error" });
    }
};

// ── Payouts: Mark a payout as completed ──
exports.markPayoutComplete = async function(req, res) {
    try {
        const { escrowId } = req.params;

        const escrow = await escrowModel.findById(escrowId)
            .populate("itemId", "shortTitle")
            .populate("finderId", "email username");

        if (!escrow) {
            return res.status(404).json({ error: "Escrow not found." });
        }

        if (escrow.payoutStatus !== "pending") {
            return res.status(400).json({ error: `Payout is not pending. Current status: ${escrow.payoutStatus}` });
        }

        escrow.payoutStatus = "completed";
        escrow.payoutCompletedAt = new Date();
        await escrow.save();

        // Notify the finder that their reward has been sent
        if (escrow.finderId) {
            const finderName = escrow.finderId.username || "Finder";
            const finderEmail = escrow.finderId.email;
            const itemTitle = escrow.itemId?.shortTitle || "item";

            // Send Email
            if (finderEmail) {
                const { sendPayoutCompleteEmail } = require('../utils/emailUtils');
                sendPayoutCompleteEmail(finderEmail, itemTitle, escrow.amount, escrow.finderUpiId).catch(console.error);
            }

            await createNotification(
                escrow.finderId._id,
                "REWARD_RELEASED",
                "Reward Sent to Your Account! 🎉",
                `Your reward of ₹${escrow.amount} for returning "${itemTitle}" has been transferred to your UPI ID (${escrow.finderUpiId}). Thank you for being honest!`,
                `/escrow`
            ).catch(err => console.error("Notification error:", err));

            // Real-time socket notification
            const io = req.app.get('io');
            if (io) {
                io.to(escrow.finderId._id.toString()).emit('escrow_updated', { escrowId: escrow._id });
                io.to(escrow.finderId._id.toString()).emit('new_notification');
            }
        }

        return res.status(200).json({ 
            status: "success", 
            message: "Payout marked as completed. Finder has been notified." 
        });
    } catch (err) {
        console.error("Error marking payout complete:", err);
        return res.status(500).json({ error: "Server error" });
    }
};


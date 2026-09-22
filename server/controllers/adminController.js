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
            if (item && finder) {
                const { sendRewardReleasedEmail } = require('../utils/emailUtils');
                sendRewardReleasedEmail(finder.email, item.shortTitle, escrow.amount).catch(console.error);

                await createNotification(
                    finder._id,
                    'REWARD_RELEASED',
                    'Reward Released by Admin',
                    `The dispute for ${item.shortTitle} was resolved in your favor. ₹${escrow.amount} has been released to you.`,
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
                    'Refund Issued by Admin',
                    `The dispute for ${item.shortTitle} was resolved in your favor. ₹${escrow.amount} has been refunded to you.`,
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
            await sendApprovalEmail(item.reportedBy.email, "Item");
        }
        return res.status(200).json({ message: "Item approved and is now live." });
    } catch (error) {
        return res.status(500).json({ error: "Internal server error" });
    }
}

exports.rejectItem = async (req,res) => {
    try {
        const feedBack = req.body
        if (!feedBack) return res.status(400).json({ error: "Feedback is required for rejection." });
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
        item.adminFeedback = feedBack;
        await item.save()
        if (item.reportedBy && item.reportedBy.email) {
            await sendRejectionEmail(item.reportedBy.email, "Item", feedback, item.hasResubmitted);
        }
        return res.status(200).json({ message: "Item rejected and user notified." });
    } catch (error) {
        return res.status(500).json({ error: "Internal server error" });
    }
}

exports.approveClaim = async (req,res)=>{
    try {
        const claim = await claimModel.findById(req.params.id).populate("claimantId");
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
            await sendApprovalEmail(claim.claimantId.email, "Claim");
        }
        return res.status(200).json({ message: "Claim approved. Item is now marked as claimed." });
    } catch (error) {
        return res.status(500).json({ error: "Internal server error" });
    }
}

exports.rejectClaim = async (req,res)=>{
    try {
        const feedBack = req.body
        if (!feedBack) return res.status(400).json({ error: "Feedback is required for rejection." });
        const claim = await claimModel.findById(req.params.id).populate("claimantId");
        if(!claim){
            return res.status(404).json({ error: "Claim not found" });
        }
        if(claim.hasResubmitted){
            claim.verdict = "permanently_rejected"
        }
        else{
            claim.verdict = "rejected";
        }
        await claim.save()
        if (claim.claimantId && claim.claimantId.email) {
            await sendRejectionEmail(claim.claimantId.email, "Claim", feedback, claim.hasResubmitted);
        }
        return res.status(200).json({ message: "Claim rejected and user notified." });
    } catch (error) {
        return res.status(500).json({ error: "Internal server error" });
    }
}
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const escrowModel = require("../models/escrowModel");
const userModel = require("../models/userModel");
const itemModel = require("../models/foundItemModel");
const chatModel = require("../models/chatModel");
const claimModel = require("../models/claimModel");
const { createNotification } = require("./notificationController");

exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const envEmail = process.env.ADMIN_EMAIL || "";
        const envPassword = process.env.ADMIN_PASSWORD || "";

        // Prevent timing attacks using crypto.timingSafeEqual
        // Both strings must be converted to Buffers of the EXACT same length to be compared safely
        let isEmailMatch = false;
        let isPasswordMatch = false;

        if (email && envEmail && email.length === envEmail.length) {
            isEmailMatch = crypto.timingSafeEqual(Buffer.from(email), Buffer.from(envEmail));
        }

        if (password && envPassword && password.length === envPassword.length) {
            isPasswordMatch = crypto.timingSafeEqual(Buffer.from(password), Buffer.from(envPassword));
        }

        if (isEmailMatch && isPasswordMatch) {
            const token = jwt.sign(
                { email, role: "admin" },
                process.env.access_token_secret,
                { expiresIn: "1d" }
            );

            res.cookie("admintoken", token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 24 * 60 * 60 * 1000 // 1 day
            });

            return res.status(200).json({ status: "success", message: "Admin logged in successfully" });
        } else {
            return res.status(401).json({ error: "Invalid admin credentials" });
        }
    } catch (error) {
        console.error("Error in adminLogin:", error);
        return res.status(500).json({ error: "Internal server error" });
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
        res.clearCookie("admintoken");
        return res.status(200).json({ status: "success", message: "Admin logged out successfully" });
    } catch (error) {
        console.error("Error in adminLogout:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

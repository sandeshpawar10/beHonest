const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const escrowModel = require("../models/escrowModel");
const userModel = require("../models/userModel");
const itemModel = require("../models/foundItemModel");
const chatModel = require("../models/chatModel");
const claimModel = require("../models/claimModel");
const { createNotification } = require("./notificationController");

const adminModel = require("../models/adminModel");

exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await adminModel.findOne({ email: email.toLowerCase() });
        if (!admin) {
            return res.status(401).json({ error: "Invalid admin credentials" });
        }

        const isMatch = await admin.isPasswordCorrect(password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid admin credentials" });
        }

        const accesstoken = admin.generateAccesstoken();
        const refreshtoken = admin.generateRefreshToken();

        admin.refreshTokens = admin.refreshTokens || [];
        admin.refreshTokens.push(refreshtoken);
        if (admin.refreshTokens.length > 5) {
            admin.refreshTokens.shift();
        }
        await admin.save({ validateBeforeSave: false });

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: '/'
        };

        return res.status(200)
            .cookie("adminaccesstoken", accesstoken, options)
            .cookie("adminrefreshtoken", refreshtoken, options)
            .json({ status: "success", message: "Admin logged in successfully" });

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
        const refreshToken = req.cookies?.adminrefreshtoken;
        if (req.user && req.user._id) {
            await adminModel.findByIdAndUpdate(req.user._id, {
                $pull: { refreshTokens: refreshToken }
            });
        }
        
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

        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        
        const admin = await adminModel.findById(decodedToken._id);
        if (!admin) {
            return res.status(401).json({ error: "Invalid refresh token" });
        }

        if (!admin.refreshTokens.includes(incomingRefreshToken)) {
            return res.status(401).json({ error: "Refresh token is expired or used" });
        }

        const accesstoken = admin.generateAccesstoken();
        const newRefreshToken = admin.generateRefreshToken();

        admin.refreshTokens = admin.refreshTokens.filter(t => t !== incomingRefreshToken);
        admin.refreshTokens.push(newRefreshToken);
        await admin.save({ validateBeforeSave: false });

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

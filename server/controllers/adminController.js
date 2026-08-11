const jwt = require("jsonwebtoken");
const escrowModel = require("../models/escrowModel");
const userModel = require("../models/userModel");
const itemModel = require("../models/foundItemModel");

exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
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
            .populate("finderId", "email username");

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

        if (resolution === "release_to_finder") {
            escrow.status = "released";
            await itemModel.deleteOne({ _id: escrow.itemId });
        } else if (resolution === "refund_to_owner") {
            escrow.status = "refunded";
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

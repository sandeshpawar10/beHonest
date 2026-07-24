const escrowModel = require("../models/escrowModel");
const claimModel = require("../models/claimModel");
const itemModel = require("../models/foundItemModel");

// ── Helper: Generate a random 6-digit PIN ──────────────────────
function generatePin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Create a new escrow (after verified claim + reward selection) ─
exports.createEscrow = async function(req, res) {
    try {
        const { itemId, claimId, amount, rewardCategory } = req.body;

        if (!itemId || !claimId || amount === undefined) {
            return res.status(400).json({
                error: "Missing required fields: itemId, claimId, and amount."
            });
        }

        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: "Unauthorized." });
        }

        // Verify the claim exists and is verified
        const claim = await claimModel.findById(claimId);
        if (!claim) {
            return res.status(404).json({ error: "Claim not found." });
        }
        if (claim.verdict !== "verified") {
            return res.status(400).json({ error: "Escrow can only be created for verified claims." });
        }

        // The depositor is the person who claimed (the owner)
        // The finder is the person who reported the item
        const item = await itemModel.findById(itemId);
        if (!item) {
            return res.status(404).json({ error: "Item not found." });
        }

        const finderId = item.reportedBy;
        const depositorId = req.user._id; // The verified owner

        // Prevent the finder from creating an escrow for themselves
        if (finderId.toString() === depositorId.toString()) {
            return res.status(403).json({ error: "Finder cannot create an escrow for themselves." });
        }

        // Generate a unique 6-digit release PIN
        const releasePin = generatePin();

        const newEscrow = await escrowModel.create({
            itemId,
            claimId,
            depositorId,
            finderId,
            amount,
            rewardCategory: rewardCategory || "standard",
            releasePin,
            status: "pending"
        });

        return res.status(201).json({
            status: "success",
            message: "Escrow created successfully.",
            escrow: {
                _id: newEscrow._id,
                itemId: newEscrow.itemId,
                amount: newEscrow.amount,
                rewardCategory: newEscrow.rewardCategory,
                releasePin: newEscrow.releasePin, // Owner sees the PIN
                status: newEscrow.status,
                createdAt: newEscrow.createdAt
            }
        });

    } catch (error) {
        console.error("Error creating escrow:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

// ── Get all escrows for the logged-in user (as owner OR finder) ─
exports.getMyEscrows = async function(req, res) {
    try {
        const userId = req.user._id;

        // Find escrows where user is either the depositor (owner) or finder
        const escrows = await escrowModel.find({
            $or: [
                { depositorId: userId },
                { finderId: userId }
            ]
        })
        .populate("itemId", "shortTitle category images location")
        .populate("claimId", "verdict score")
        .populate("depositorId", "email username")
        .populate("finderId", "email username")
        .sort({ createdAt: -1 });

        // Separate into "as owner" and "as finder" for the frontend
        const asOwner = [];
        const asFinder = [];

        escrows.forEach(escrow => {
            const escrowObj = escrow.toObject();
            if (escrow.depositorId._id.toString() === userId.toString()) {
                // User is the owner — they can see the release PIN
                asOwner.push(escrowObj);
            }
            if (escrow.finderId._id.toString() === userId.toString()) {
                // User is the finder — hide the PIN (they need to receive it from the owner)
                const { releasePin, ...safeEscrow } = escrowObj;
                asFinder.push(safeEscrow);
            }
        });

        return res.status(200).json({
            status: "success",
            asOwner,
            asFinder
        });

    } catch (error) {
        console.error("Error fetching escrows:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

// ── Release escrow (finder enters PIN to claim reward) ──────────
exports.releaseEscrow = async function(req, res) {
    try {
        const { escrowId } = req.params;
        const { pin } = req.body;

        if (!pin) {
            return res.status(400).json({ error: "PIN is required." });
        }

        const escrow = await escrowModel.findById(escrowId);
        if (!escrow) {
            return res.status(404).json({ error: "Escrow not found." });
        }

        // Only the finder can release the escrow
        if (escrow.finderId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Only the finder can release this escrow." });
        }

        // Check escrow is still pending
        if (escrow.status !== "pending") {
            return res.status(400).json({ error: `Escrow has already been ${escrow.status}.` });
        }

        // Verify the PIN
        if (escrow.releasePin !== pin) {
            return res.status(400).json({ error: "Incorrect PIN. Please try again." });
        }

        // Release the escrow!
        escrow.status = "released";
        await escrow.save();

        return res.status(200).json({
            status: "success",
            message: "Escrow released! The reward has been claimed.",
            escrow: {
                _id: escrow._id,
                status: escrow.status,
                amount: escrow.amount
            }
        });

    } catch (error) {
        console.error("Error releasing escrow:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

// ── Refund escrow (owner requests a refund) ─────────────────────
exports.refundEscrow = async function(req, res) {
    try {
        const { escrowId } = req.params;

        const escrow = await escrowModel.findById(escrowId);
        if (!escrow) {
            return res.status(404).json({ error: "Escrow not found." });
        }

        // Only the depositor (owner) can request a refund
        if (escrow.depositorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Only the owner can request a refund." });
        }

        // Check escrow is still pending
        if (escrow.status !== "pending") {
            return res.status(400).json({ error: `Escrow has already been ${escrow.status}.` });
        }

        // Refund the escrow
        escrow.status = "refunded";
        await escrow.save();

        return res.status(200).json({
            status: "success",
            message: "Escrow refunded successfully.",
            escrow: {
                _id: escrow._id,
                status: escrow.status,
                amount: escrow.amount
            }
        });

    } catch (error) {
        console.error("Error refunding escrow:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

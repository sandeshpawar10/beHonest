const claimModel = require("../models/claimModel");
const itemModel = require("../models/foundItemModel");

// ── Create a new claim (save AI interview result) ──────────────
exports.createClaim = async function(req, res) {
    try {
        const { itemId, answers, verdict, score, verdictMessage } = req.body;

        if (!itemId || !verdict) {
            return res.status(400).json({
                error: "Missing required fields: itemId and verdict are required."
            });
        }

        // Ensure the user is authenticated
        if (!req.user || !req.user._id) {
            return res.status(401).json({
                error: "Unauthorized. You must be logged in."
            });
        }

        // Verify the item exists
        const item = await itemModel.findById(itemId);
        if (!item) {
            return res.status(404).json({
                error: "Item not found."
            });
        }

        // Prevent claiming your own item
        if (item.reportedBy.toString() === req.user._id.toString()) {
            return res.status(403).json({
                error: "You cannot claim an item you reported yourself."
            });
        }

        // Create the claim record
        const newClaim = await claimModel.create({
            itemId,
            claimantId: req.user._id,
            answers: answers || [],
            verdict,
            score: score || 0,
            verdictMessage: verdictMessage || ""
        });

        // If the AI verified the owner, update the item status to "claimed"
        if (verdict === "verified") {
            await itemModel.findByIdAndUpdate(itemId, { status: "claimed" });
        }

        return res.status(201).json({
            status: "success",
            message: "Claim saved successfully.",
            claim: newClaim
        });

    } catch (error) {
        console.error("Error creating claim:", error);
        return res.status(500).json({
            error: "Internal server error while saving claim."
        });
    }
};

// ── Get all claims for a specific item ─────────────────────────
exports.getClaimsForItem = async function(req, res) {
    try {
        const { itemId } = req.params;

        if (!itemId) {
            return res.status(400).json({ error: "Item ID is required." });
        }

        const claims = await claimModel.find({ itemId })
            .populate("claimantId", "email username")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            status: "success",
            claims
        });

    } catch (error) {
        console.error("Error fetching claims for item:", error);
        return res.status(500).json({
            error: "Internal server error."
        });
    }
};

// ── Get all claims made by the logged-in user ──────────────────
exports.getMyClaims = async function(req, res) {
    try {
        const claims = await claimModel.find({ claimantId: req.user._id })
            .populate("itemId", "shortTitle category images status")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            status: "success",
            claims
        });

    } catch (error) {
        console.error("Error fetching user claims:", error);
        return res.status(500).json({
            error: "Internal server error."
        });
    }
};

const claimModel = require("../models/claimModel");
const itemModel = require("../models/foundItemModel");

const { runInteractiveInterrogation } = require("../utils/geminiUtils");

// ── Securely Evaluate Claim via Server-Side AI ──────────────
exports.evaluateClaim = async function(req, res) {
    try {
        const { itemId, chatHistory } = req.body;

        if (!itemId) {
            return res.status(400).json({ error: "Missing required field: itemId" });
        }

        // Ensure the user is authenticated
        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: "Unauthorized. You must be logged in." });
        }

        // Verify the item exists
        const item = await itemModel.findById(itemId);
        if (!item) {
            return res.status(404).json({ error: "Item not found." });
        }

        // Prevent claiming your own item
        if (item.reportedBy.toString() === req.user._id.toString()) {
            return res.status(403).json({ error: "You cannot claim an item you reported yourself." });
        }

        // Run the AI interrogation securely on the server
        const aiResponse = await runInteractiveInterrogation(item, chatHistory || []);

        let claim = null;
        
        // If the AI has made a final verdict, save it to the database
        if (aiResponse.status !== 'continue') {
            claim = await claimModel.create({
                itemId,
                claimantId: req.user._id,
                answers: chatHistory || [],
                verdict: aiResponse.status === 'verified' || aiResponse.status === 'needs_review' ? aiResponse.status : 'rejected',
                score: aiResponse.score || 0,
                verdictMessage: aiResponse.message || ""
            });

            // Update item status if verified
            if (aiResponse.status === "verified") {
                await itemModel.findByIdAndUpdate(itemId, { status: "claimed" });
            }
        }

        return res.status(200).json({
            status: "success",
            aiResponse: aiResponse,
            claim: claim
        });

    } catch (error) {
        console.error("Error evaluating claim:", error);
        return res.status(500).json({
            error: "Internal server error while evaluating claim."
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

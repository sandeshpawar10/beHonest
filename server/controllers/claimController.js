const claimModel = require("../models/claimModel");
const itemModel = require("../models/foundItemModel");

const { runInteractiveInterrogation } = require("../utils/geminiUtils");
const z = require("zod");

// Zod schema for claim evaluation
const evaluateClaimSchema = z.object({
    itemId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Item ID"),
    chatHistory: z.array(z.object({
        role: z.enum(["user", "ai"]),
        text: z.string().max(2000)
    })).optional(),
    secretGuess: z.string().max(200).optional(),
    proofImage: z.string().optional()
});

// ── Securely Evaluate Claim via Server-Side AI ──────────────
exports.evaluateClaim = async function(req, res) {
    try {
        const validation = evaluateClaimSchema.safeParse(req.body);
        if (!validation.success) {
            const issues = validation.error?.issues || validation.error?.errors || [];
            return res.status(400).json({ error: issues.map(e => e.message).join(", ") || validation.error?.message || "Invalid request payload" });
        }
        
        let { itemId, chatHistory, secretGuess, proofImage } = validation.data;

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

        // Prevent claiming an item that is already claimed
        if (item.status === 'claimed') {
            return res.status(400).json({ error: "This item has already been claimed and verified." });
        }

        // Upload proofImage to Cloudinary if it's a base64 string
        if (proofImage && proofImage.startsWith('data:image')) {
            try {
                const { uploadImage } = require("../utils/cloudinary");
                proofImage = await uploadImage(proofImage);
            } catch (uploadErr) {
                console.error("Cloudinary upload failed for proof image:", uploadErr);
                return res.status(500).json({ error: "Failed to upload proof image securely." });
            }
        }

        // Run the AI interrogation securely on the server
        const aiResponse = await runInteractiveInterrogation(item, chatHistory || [], proofImage);

        let claim = null;
        // Hybrid rules-based logic: If AI verified them, but they failed the secret string match, downgrade to manual review
        let finalStatus = aiResponse.status;
        if (finalStatus === 'verified' && item.secretIdentity) {
            const guess = (secretGuess || "").toLowerCase().trim();
            const actual = item.secretIdentity.toLowerCase().trim();
            if (guess !== actual) {
                finalStatus = 'needs_review';
                aiResponse.status = 'needs_review';
                aiResponse.message += "\n\n(System Note: Your visual verification passed, but your secret identifier guess was incorrect or missing. A human will review your claim.)";
            }
        }
        
        // We DO NOT save the claim to the DB yet. The user still needs to go to the proof stage.
        return res.status(200).json({
            status: "success",
            aiResponse: aiResponse,
            claim: null // no claim saved yet
        });

    } catch (error) {
        console.error("Error evaluating claim:", error);
        return res.status(500).json({
            error: "Internal server error while evaluating claim."
        });
    }
};

// Zod schema for finalize claim
const finalizeClaimSchema = z.object({
    itemId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Item ID"),
    chatHistory: z.array(z.object({
        role: z.enum(["user", "ai"]),
        text: z.string().max(2000)
    })).optional(),
    secretGuess: z.string().max(200).optional(),
    tentativeVerdict: z.object({
        status: z.enum(["verified", "needs_review", "rejected", "continue"]),
        message: z.string(),
        score: z.number().optional()
    }),
    proofImage: z.string().optional()
});

// ── Finalize Claim with Proof ──────────────────────────────
exports.finalizeClaim = async function(req, res) {
    try {
        const validation = finalizeClaimSchema.safeParse(req.body);
        if (!validation.success) {
            const issues = validation.error?.issues || validation.error?.errors || [];
            return res.status(400).json({ error: issues.map(e => e.message).join(", ") || validation.error?.message || "Invalid request payload" });
        }
        
        let { itemId, chatHistory, secretGuess, tentativeVerdict, proofImage } = validation.data;

        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: "Unauthorized. You must be logged in." });
        }

        const item = await itemModel.findById(itemId);
        if (!item) {
            return res.status(404).json({ error: "Item not found." });
        }

        if (item.status === 'claimed') {
            return res.status(400).json({ error: "This item has already been claimed and verified." });
        }

        // Upload proofImage to Cloudinary if provided
        if (proofImage && proofImage.startsWith('data:image')) {
            try {
                const { uploadImage } = require("../utils/cloudinary");
                proofImage = await uploadImage(proofImage);
            } catch (uploadErr) {
                console.error("Cloudinary upload failed for proof image:", uploadErr);
                return res.status(500).json({ error: "Failed to upload proof image securely." });
            }
        }

        const { runFinalCombinedScoring } = require("../utils/geminiUtils");
        const aiResponse = await runFinalCombinedScoring(item, chatHistory || [], tentativeVerdict, proofImage);

        let finalStatus = aiResponse.status;

        // Save to Database
        const claim = await claimModel.create({
            itemId,
            claimantId: req.user._id,
            answers: chatHistory || [],
            verdict: finalStatus === 'verified' || finalStatus === 'needs_review' ? finalStatus : 'rejected',
            score: aiResponse.score || 0,
            verdictMessage: aiResponse.message || "",
            aiModelUsed: aiResponse.aiModelUsed || "gemini-3.1-flash-lite",
            aiVersion: aiResponse.aiVersion || "v1",
            secretGuess: secretGuess || "",
            proofImage: proofImage || ""
        });

        // Update item status if verified
        if (finalStatus === "verified") {
            const updatedItem = await itemModel.findOneAndUpdate(
                { _id: itemId, status: "found" },
                { status: "claimed" },
                { returnDocument: 'after' }
            );

            if (!updatedItem) {
                claim.verdict = "rejected";
                claim.verdictMessage = "Conflict: Item was claimed by another user simultaneously.";
                await claim.save();

                return res.status(409).json({
                    error: "We're sorry, but another user successfully verified ownership of this item moments ago."
                });
            }
        }

        return res.status(200).json({
            status: "success",
            claim: claim
        });

    } catch (error) {
        console.error("Error finalizing claim:", error);
        return res.status(500).json({
            error: "Internal server error while finalizing claim."
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

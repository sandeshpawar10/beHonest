const escrowModel = require("../models/escrowModel");
const claimModel = require("../models/claimModel");
const itemModel = require("../models/foundItemModel");
const userModel = require("../models/userModel");
const chatModel = require("../models/chatModel");
const { createNotification } = require("./notificationController");
const z = require("zod");
const crypto = require("crypto");
const Razorpay = require("razorpay");

// Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const createEscrowSchema = z.object({
    itemId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Mongo ID"),
    claimId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Mongo ID"),
    amount: z.number().int().min(10).max(10000), // Must be an integer, max ₹10,000
    rewardCategory: z.string().min(1)
});

const raiseDisputeSchema = z.object({
    reason: z.string().min(10, "Dispute reason must be at least 10 characters").max(2000),
    itemPossession: z.enum(["me", "other_party", "unknown"]).optional().default("unknown")
});

// ── Create a new escrow (after verified claim + reward selection) ─
exports.createEscrow = async function(req, res) {
    try {
        const validation = createEscrowSchema.safeParse(req.body);
        if (!validation.success) {
            const issues = validation.error?.issues || validation.error?.errors || [];
            return res.status(400).json({ error: issues.map(e => e.message).join(", ") || validation.error?.message || "Invalid request payload" });
        }
        
        const { itemId, claimId, amount, rewardCategory } = validation.data;

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

        if (claim.claimantId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Only the verified claimant can create an escrow." });
        }
        
        if (claim.itemId.toString() !== itemId) {
            return res.status(400).json({ error: "Item ID mismatch. The provided item does not match the claim." });
        }

        const existingEscrow = await escrowModel.findOne({ 
            $or: [{ claimId }, { itemId }] 
        });
        if (existingEscrow) {
            if (existingEscrow.status === "payment_pending") {
                // Delete orphaned incomplete escrow so they can retry
                await escrowModel.findByIdAndDelete(existingEscrow._id);
            } else {
                return res.status(400).json({ error: "An escrow already exists for this item or claim." });
            }
        }

        // The depositor is the person who claimed (the owner)
        // The finder is the person who reported the item
        const item = await itemModel.findById(itemId);
        if (!item) {
            return res.status(404).json({ error: "Item not found." });
        }
        
        if (item.status !== "claimed") {
            return res.status(400).json({ error: "Item is no longer available for escrow." });
        }

        const finderId = item.reportedBy;
        const depositorId = req.user._id; // The verified owner

        // Prevent the finder from creating an escrow for themselves
        if (finderId.toString() === depositorId.toString()) {
            return res.status(403).json({ error: "Finder cannot create an escrow for themselves." });
        }

        if (amount < 1) {
            return res.status(400).json({ error: "Amount must be at least ₹1." });
        }

        // Create the escrow with payment_pending status first
        const newEscrow = await escrowModel.create({
            itemId,
            claimId,
            depositorId,
            finderId,
            amount,
            rewardCategory: rewardCategory || "standard",
            status: "payment_pending"
        });

        // Create Razorpay order
        const order = await razorpay.orders.create({
            amount: amount * 100, // Razorpay expects amount in paise
            currency: "INR",
            receipt: `escrow_${newEscrow._id}`,
            notes: {
                escrowId: newEscrow._id.toString(),
                itemId: itemId,
                depositorId: depositorId.toString()
            }
        });

        // Update the escrow with the Razorpay order ID
        newEscrow.razorpayOrderId = order.id;
        await newEscrow.save();

        res.status(201).json({
            message: "Payment order created successfully",
            orderId: order.id,
            escrowId: newEscrow._id,
            amount: amount,
            currency: "INR",
            keyId: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error("Error in createEscrow:", error);
        res.status(500).json({ error: error.message || "Failed to create payment order. Check API Keys." });
    }
};

// ── Verify Payment (Razorpay signature verification) ──────────────────────
exports.verifyPayment = async function(req, res) {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, escrowId } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !escrowId) {
            return res.status(400).json({ error: "Missing required payment details." });
        }

        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: "Unauthorized." });
        }

        const escrow = await escrowModel.findById(escrowId);
        if (!escrow) {
            return res.status(404).json({ error: "Escrow not found." });
        }

        // SECURITY: Verify the escrow belongs to the logged-in user (depositor)
        if (escrow.depositorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Forbidden. This escrow does not belong to you." });
        }

        // SECURITY: Verify the Razorpay order ID matches the escrow's order
        if (escrow.razorpayOrderId !== razorpay_order_id) {
            return res.status(400).json({ error: "Payment verification failed. Order ID mismatch." });
        }

        // Verify Razorpay signature using HMAC SHA256
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ error: "Payment verification failed. Invalid signature." });
        }

        // Store whether it was already paid to avoid duplicate notifications
        const wasAlreadyPaid = escrow.status !== "payment_pending";

        // Signature is valid, update the escrow
        escrow.status = "pending";
        escrow.razorpayPaymentId = razorpay_payment_id;
        escrow.razorpaySignature = razorpay_signature;
        await escrow.save();

        // Emit real-time update to both owner and finder
        const io = req.app.get('io');
        if (io) {
            io.to(escrow.depositorId.toString()).emit('escrow_updated', { escrowId: escrow._id });
            io.to(escrow.finderId.toString()).emit('escrow_updated', { escrowId: escrow._id });
        }

        // 1. Immediately tell the frontend it was successful so the UI doesn't freeze
        res.status(200).json({ message: "Payment verified successfully", escrow });

        // 2. Send notifications in the background (Render free tier blocks emails, which causes freezing if awaited)
        if (!wasAlreadyPaid) {
            const item = await itemModel.findById(escrow.itemId);
            const { sendClaimNotification } = require('../utils/emailUtils');
            const finder = await userModel.findById(escrow.finderId);
            
            if(finder){
                // Do NOT await this, let it fail silently in the background if SMTP is blocked
                sendClaimNotification(finder.email, item.shortTitle, escrow.amount).catch(err => console.error("Email blocked by Render:", err));
            }

            createNotification(
                escrow.finderId,
                "GENERAL",
                "Reward Deposited! 💰",
                `The owner has verified their claim and deposited a reward of ₹${escrow.amount} into escrow for your found item: ${item.shortTitle}. Meet them to complete the handover!`,
                `/escrow`
            ).catch(err => console.error("Notification error:", err));
        }

    } catch (error) {
        console.error("Error verifying payment:", error);
        // Only send 500 if we haven't already sent a response
        if (!res.headersSent) {
            return res.status(500).json({ error: "Internal server error." });
        }
    }
};

// ── Get all escrows for the logged-in user (as owner OR finder) ─
exports.getMyEscrows = async function(req, res) {
    try {
        const userId = req.user._id;
        console.log("[getMyEscrows] userId:", userId.toString());

        // Find escrows where user is either the depositor (owner) or finder
        const escrows = await escrowModel.find({
            $or: [
                { depositorId: userId },
                { finderId: userId }
            ]
        })
        .populate("itemId", "shortTitle category images imagePrivacyVersion location")
        .populate("claimId", "verdict score")
        .populate("depositorId", "email username")
        .populate("finderId", "email username")
        .sort({ createdAt: -1 });

        console.log("[getMyEscrows] Total escrows found:", escrows.length);

        const asOwner = [];
        const asFinder = [];

        const now = new Date();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

        for (let escrow of escrows) {
            // Auto-refund check for pending escrows > 24 hours with no dispute
            // if (escrow.status === 'pending' && !escrow.disputeRaisedAt) {
            //     if (now.getTime() - new Date(escrow.createdAt).getTime() > TWENTY_FOUR_HOURS) {
            //         escrow.status = 'refunded';
            //         await escrow.save();

            //         // Reset the item so it can be claimed again
            //         await itemModel.findByIdAndUpdate(escrow.itemId, { status: "found" });
            //         await claimModel.deleteMany({ itemId: escrow.itemId });
            //     }
            // }

            const escrowObj = escrow.toObject();
            
            // Get the IDs safely (after populate, these are user objects)
            const depositorIdStr = escrow.depositorId?._id?.toString() || escrow.depositorId?.toString();
            const finderIdStr = escrow.finderId?._id?.toString() || escrow.finderId?.toString();
            
            console.log(`[getMyEscrows] Escrow ${escrow._id}: status=${escrow.status}, depositorId=${depositorIdStr}, finderId=${finderIdStr}`);

            if (depositorIdStr === userId.toString()) {
                asOwner.push(escrowObj);
            }
            if (finderIdStr === userId.toString()) {
                asFinder.push(escrowObj);
            }
        }

        console.log(`[getMyEscrows] Results: asOwner=${asOwner.length}, asFinder=${asFinder.length}`);

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

// ── Confirm handover ──────────
exports.confirmHandover = async function(req, res) {
    try {
        const { escrowId } = req.params;

        const escrow = await escrowModel.findById(escrowId);
        if (!escrow) {
            return res.status(404).json({ error: "Escrow not found." });
        }

        if (escrow.status !== "pending") {
            return res.status(400).json({ error: `Cannot confirm escrow with status: ${escrow.status}.` });
        }

        if (req.user._id.toString() === escrow.depositorId.toString()) {
            escrow.ownerConfirmed = true;
            escrow.ownerConfirmedAt = new Date();
        } else if (req.user._id.toString() === escrow.finderId.toString()) {
            escrow.finderConfirmed = true;
            escrow.finderConfirmedAt = new Date();
        } else {
            return res.status(403).json({ error: "You are not authorized to confirm this escrow." });
        }

        let bothConfirmed = false;

        if (escrow.ownerConfirmed && escrow.finderConfirmed) {
            escrow.status = "released";
            bothConfirmed = true;

            // Mark payout as pending so admin dashboard picks it up
            if (escrow.finderUpiId) {
                escrow.payoutStatus = "pending";
                console.log(`[PAYOUT] Reward of ₹${escrow.amount} should be sent to UPI: ${escrow.finderUpiId} (Finder: ${escrow.finderId})`);
            }

            const item = await itemModel.findById(escrow.itemId);
            const finder = await userModel.findById(escrow.finderId);
            
            if (item && finder) {
                const { sendRewardReleasedEmail } = require('../utils/emailUtils');
                // send the email asynchronously so we don't block
                sendRewardReleasedEmail(finder.email, item.shortTitle, escrow.amount, escrow.finderUpiId).catch(console.error);

                await createNotification(
                    finder._id,
                    'REWARD_RELEASED',
                    'Handover Confirmed! 🎉',
                    `Both you and the owner confirmed the handover for ${item.shortTitle}. Your reward of ₹${escrow.amount} will be transferred to your UPI within 2-3 business days.`,
                    escrow._id
                );
            }

        }

        await escrow.save();

        // Emit real-time update to both owner and finder
        const io = req.app.get('io');
        if (io) {
            io.to(escrow.depositorId.toString()).emit('escrow_updated', { escrowId: escrow._id });
            io.to(escrow.finderId.toString()).emit('escrow_updated', { escrowId: escrow._id });
        }

        return res.status(200).json({
            status: "success",
            bothConfirmed,
            escrow
        });

    } catch (error) {
        console.error("Error confirming handover:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

// ── Save Finder UPI ID ──────────
exports.saveFinderUpi = async function(req, res) {
    try {
        const { escrowId } = req.params;
        const { upiId } = req.body;

        if (!upiId || typeof upiId !== 'string' || upiId.trim().length < 3) {
            return res.status(400).json({ error: "Please enter a valid UPI ID." });
        }

        // Basic UPI format validation (something@something)
        const upiRegex = /^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9]+$/;
        if (!upiRegex.test(upiId.trim())) {
            return res.status(400).json({ error: "Invalid UPI ID format. Example: yourname@upi" });
        }

        const escrow = await escrowModel.findById(escrowId);
        if (!escrow) {
            return res.status(404).json({ error: "Escrow not found." });
        }

        // Only the finder can save their UPI
        if (escrow.finderId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Only the finder can save their UPI ID." });
        }

        if (escrow.status !== 'pending') {
            return res.status(400).json({ error: "UPI can only be saved for active escrows." });
        }

        escrow.finderUpiId = upiId.trim();
        await escrow.save();

        return res.status(200).json({
            status: "success",
            message: "UPI ID saved successfully.",
            finderUpiId: escrow.finderUpiId
        });

    } catch (error) {
        console.error("Error saving finder UPI:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

// ── Raise Dispute ──────────
exports.raiseDispute = async function(req, res) {
    try {
        const { escrowId } = req.params;
        
        const validation = raiseDisputeSchema.safeParse(req.body);
        if (!validation.success) {
            const issues = validation.error?.issues || validation.error?.errors || [];
            return res.status(400).json({ error: issues.map(e => e.message).join(", ") || validation.error?.message || "Invalid request payload" });
        }
        
        const { reason, itemPossession } = validation.data;

        const escrow = await escrowModel.findById(escrowId);
        if (!escrow) {
            return res.status(404).json({ error: "Escrow not found." });
        }

        if (req.user._id.toString() !== escrow.depositorId.toString() && req.user._id.toString() !== escrow.finderId.toString()) {
            return res.status(403).json({ error: "You are not authorized to dispute this escrow." });
        }

        if (escrow.status !== "pending") {
            return res.status(400).json({ error: `Cannot raise dispute for escrow with status: ${escrow.status}.` });
        }

        escrow.status = "disputed";
        escrow.disputeReason = reason;
        escrow.disputeRaisedBy = req.user._id;
        escrow.disputeRaisedAt = new Date();
        escrow.itemPossession = itemPossession || "unknown";

        await escrow.save();

        const u = await userModel.findById(escrow.disputeRaisedBy)
        if(!u){
            return res.status(404).json({error: "User not found to send email"});
        }
        // const f = await userModel.findById(escrow.finderId)
        // if(!f){
        //     return res.status(404).json({error: "Finder not found to send email"});
        // }
        const i = await itemModel.findById(escrow.itemId)
        if(!i){
            return res.status(404).json({error: "Item not found to send email"});
        }

        const {sendDisputeEmailToAdmin, sendDisputeEmail} = require("../utils/emailUtils")
        const emailSent = await sendDisputeEmail(u.email, i.shortTitle, escrow.disputeReason)
        if (!emailSent) {
            return res.status(500).json({ error: "Failed to send notification email. Please try again." });
        }
        const emailSentToAdmin = await sendDisputeEmailToAdmin(process.env.ADMIN_EMAIL, i.shortTitle, escrow.disputeReason,u.username )
        if (!emailSentToAdmin) {
            return res.status(500).json({ error: "Failed to send notification email to admin. Please try again." });
        }

        // Notify the other party in-app
        const otherUserId = req.user._id.toString() === escrow.depositorId.toString() ? escrow.finderId : escrow.depositorId;
        await createNotification(
            otherUserId,
            'DISPUTE_RAISED',
            'A Dispute Has Been Raised',
            `${u.username} has raised a dispute regarding ${i.shortTitle}. Reason: ${escrow.disputeReason}.`,
            escrowId
        );

        const io = req.app.get('io');
        if (io) {
            io.to(escrow.depositorId.toString()).emit('escrow_updated', { escrowId: escrow._id });
            io.to(escrow.finderId.toString()).emit('escrow_updated', { escrowId: escrow._id });
        }

        return res.status(200).json({
            status: "success",
            message: "Dispute raised successfully.",
            escrow
        });

    } catch (error) {
        console.error("Error raising dispute:", error);
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

        // Prevent refund if the finder claims to have already handed it over
        if (escrow.finderConfirmed) {
            return res.status(403).json({ error: "Finder has already confirmed handover. You must raise a dispute instead." });
        }

        // Check if payment was actually captured
        if (!escrow.razorpayPaymentId) {
            return res.status(400).json({ error: "No payment found to refund." });
        }

        // Check if refund is already in progress
        if (escrow.refundStatus === "requested" || escrow.refundStatus === "processing") {
            return res.status(400).json({ error: "Refund is already being processed." });
        }

        if (escrow.refundStatus === "completed") {
            return res.status(400).json({ error: "Refund has already been completed." });
        }

        // Mark refund as requested
        escrow.refundStatus = "requested";
        escrow.refundRequestedAt = new Date();
        await escrow.save();

        try {
            // Process real Razorpay refund
            escrow.refundStatus = "processing";
            await escrow.save();

            const refund = await razorpay.payments.refund(escrow.razorpayPaymentId, {
                amount: escrow.amount * 100, // Amount in paise
                speed: "normal", // Can be 'normal' or 'optimum'
                notes: {
                    escrowId: escrow._id.toString(),
                    itemId: escrow.itemId.toString(),
                    reason: "Owner requested refund"
                },
                receipt: `refund_${escrow._id}`
            });

            // Update escrow with refund details
            escrow.refundId = refund.id;
            escrow.refundStatus = "completed";
            escrow.refundCompletedAt = new Date();
            escrow.status = "refunded";
            escrow.refundFailedReason = null;
            await escrow.save();

            // Reset the item so it can be claimed again
            const item = await itemModel.findByIdAndUpdate(escrow.itemId, { status: "found" });
            await claimModel.deleteMany({ itemId: escrow.itemId });

            // Send refund email to the owner
            const user = await userModel.findById(req.user._id);
            if (user && item) {
                const { sendRefundEmail } = require('../utils/emailUtils');
                sendRefundEmail(user.email, item.shortTitle, escrow.amount).catch(err =>
                    console.error("Refund email failed:", err)
                );
            }

            const io = req.app.get('io');
            if (io) {
                io.to(escrow.depositorId.toString()).emit('escrow_updated', { escrowId: escrow._id });
                io.to(escrow.finderId.toString()).emit('escrow_updated', { escrowId: escrow._id });
                io.emit('item_updated', { itemId: escrow.itemId });
            }

            return res.status(200).json({
                status: "success",
                message: "Refund processed successfully. Money will be credited to your account within 5-7 business days.",
                escrow: {
                    _id: escrow._id,
                    status: escrow.status,
                    amount: escrow.amount,
                    refundId: escrow.refundId,
                    refundStatus: escrow.refundStatus,
                    refundCompletedAt: escrow.refundCompletedAt
                }
            });

        } catch (razorpayError) {
            // Razorpay refund failed - update status and store error
            escrow.refundStatus = "failed";
            escrow.refundFailedReason = razorpayError.error?.description || razorpayError.message || "Razorpay refund failed";
            await escrow.save();

            console.error("Razorpay refund failed:", razorpayError);
            return res.status(500).json({
                error: "Refund failed. Please contact support.",
                details: escrow.refundFailedReason
            });
        }

    } catch (error) {
        console.error("Error refunding escrow:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

// ── Check Refund Status (query Razorpay for current refund status) ──────────
exports.getRefundStatus = async function(req, res) {
    try {
        const { escrowId } = req.params;

        const escrow = await escrowModel.findById(escrowId);
        if (!escrow) {
            return res.status(404).json({ error: "Escrow not found." });
        }

        // Only the depositor (owner) can check refund status
        if (escrow.depositorId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: "Forbidden. You can only check your own refund status." });
        }

        // If no refund was initiated, return current status
        if (escrow.refundStatus === "not_requested") {
            return res.status(200).json({
                status: "success",
                refundStatus: "not_requested",
                message: "No refund has been requested for this escrow."
            });
        }

        // If refund is completed or failed, return stored status
        if (escrow.refundStatus === "completed" || escrow.refundStatus === "failed") {
            return res.status(200).json({
                status: "success",
                refundStatus: escrow.refundStatus,
                refundId: escrow.refundId,
                refundRequestedAt: escrow.refundRequestedAt,
                refundCompletedAt: escrow.refundCompletedAt,
                refundFailedReason: escrow.refundFailedReason,
                message: escrow.refundStatus === "completed"
                    ? "Refund has been processed successfully."
                    : "Refund failed. Please contact support."
            });
        }

        // If refund is processing, query Razorpay for latest status
        if (escrow.refundId) {
            try {
                const refund = await razorpay.refunds.fetch(escrow.refundId);

                // Update escrow with latest status from Razorpay
                if (refund.status === "processed") {
                    escrow.refundStatus = "completed";
                    escrow.refundCompletedAt = new Date();
                    await escrow.save();
                } else if (refund.status === "failed") {
                    escrow.refundStatus = "failed";
                    escrow.refundFailedReason = refund.error_description || "Refund failed";
                    await escrow.save();
                }

                return res.status(200).json({
                    status: "success",
                    refundStatus: escrow.refundStatus,
                    razorpayStatus: refund.status,
                    refundId: escrow.refundId,
                    refundRequestedAt: escrow.refundRequestedAt,
                    refundCompletedAt: escrow.refundCompletedAt,
                    message: `Refund is ${refund.status}.`
                });

            } catch (razorpayError) {
                console.error("Error fetching refund from Razorpay:", razorpayError);
                // Return stored status if Razorpay query fails
                return res.status(200).json({
                    status: "success",
                    refundStatus: escrow.refundStatus,
                    refundId: escrow.refundId,
                    message: "Refund is being processed. Please check back later."
                });
            }
        }

        // Fallback
        return res.status(200).json({
            status: "success",
            refundStatus: escrow.refundStatus,
            refundRequestedAt: escrow.refundRequestedAt,
            message: "Refund is being processed."
        });

    } catch (error) {
        console.error("Error checking refund status:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

const escrowModel = require("../models/escrowModel");
const claimModel = require("../models/claimModel");
const itemModel = require("../models/foundItemModel");
const userModel = require("../models/userModel");
const chatModel = require("../models/chatModel");
const { createNotification } = require("./notificationController");
const z = require("zod");
const crypto = require("crypto");

const createEscrowSchema = z.object({
    itemId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Item ID"),
    claimId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Claim ID"),
    amount: z.number().min(0, "Amount cannot be negative"),
    rewardCategory: z.string().optional().default("standard")
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

        // Create Cashfree order
        const cashfreeEnv = process.env.CASHFREE_ENV === "PRODUCTION" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
        
        const response = await fetch(`${cashfreeEnv}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-version': '2023-08-01',
                'x-client-id': process.env.CASHFREE_APP_ID,
                'x-client-secret': process.env.CASHFREE_SECRET_KEY
            },
            body: JSON.stringify({
                order_amount: amount,
                order_currency: "INR",
                order_id: `escrow_${newEscrow._id}`,
                customer_details: {
                    customer_id: depositorId.toString(),
                    customer_phone: "9999999999" // Dummy phone required by CF
                },
                order_meta: {
                    // For drop-in checkout, return_url isn't strictly necessary but good practice
                    return_url: `${process.env.VITE_FRONTEND_URL || 'http://localhost:5173'}/escrow?order_id={order_id}`
                }
            })
        });

        const orderData = await response.json();
        
        if (!response.ok) {
            console.error("Cashfree API Error:", orderData);
            throw new Error(orderData.message || "Failed to create Cashfree Order");
        }

        // Update the escrow with the generated IDs
        newEscrow.cashfreeOrderId = orderData.order_id;
        newEscrow.cashfreePaymentSessionId = orderData.payment_session_id;
        await newEscrow.save();

        res.status(201).json({
            message: "Payment order created successfully",
            orderId: orderData.order_id,
            paymentSessionId: orderData.payment_session_id,
            escrowId: newEscrow._id,
            amount: amount,
            currency: "INR"
        });

    } catch (error) {
        console.error("Error in createEscrow:", error);
        res.status(500).json({ error: error.message || "Failed to communicate with Cashfree. Check API Keys." });
    }
};

// ── Verify Payment ──────────────────────────────────────────────────────────
exports.verifyPayment = async function(req, res) {
    try {
        const { order_id, escrowId } = req.body;

        if (!order_id || !escrowId) {
            return res.status(400).json({ error: "Missing required payment details." });
        }

        const escrow = await escrowModel.findById(escrowId);
        if (!escrow) {
            return res.status(404).json({ error: "Escrow not found." });
        }

        // Verify with Cashfree API
        const cashfreeEnv = process.env.CASHFREE_ENV === "PRODUCTION" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
        
        const response = await fetch(`${cashfreeEnv}/orders/${order_id}`, {
            method: 'GET',
            headers: {
                'x-api-version': '2023-08-01',
                'x-client-id': process.env.CASHFREE_APP_ID,
                'x-client-secret': process.env.CASHFREE_SECRET_KEY
            }
        });

        const orderData = await response.json();
        
        if (!response.ok) {
            return res.status(400).json({ error: "Failed to verify order with Cashfree." });
        }

        if (orderData.order_status !== "PAID") {
            return res.status(400).json({ error: "Payment not completed or failed." });
        }

        // Signature is valid (since we queried CF directly), update the escrow
        escrow.status = "pending";
        await escrow.save();

        // Send notifications
        const item = await itemModel.findById(escrow.itemId);
        const { sendClaimNotification } = require('../utils/emailUtils');
        const finder = await userModel.findById(escrow.finderId);
        
        if(finder){
            await sendClaimNotification(finder.email, item.shortTitle, escrow.amount);
        }

        await createNotification(
            escrow.finderId,
            "GENERAL",
            "Reward Deposited! 💰",
            `The owner has verified their claim and deposited a reward of ₹${escrow.amount} into escrow for your found item: ${item.shortTitle}. Meet them to complete the handover!`,
            `/escrow`
        );
        res.status(200).json({ message: "Payment verified successfully", escrow });
    } catch (error) {
        console.error("Error verifying payment:", error);
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

        const asOwner = [];
        const asFinder = [];

        const now = new Date();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

        for (let escrow of escrows) {
            // Auto-refund check for pending escrows > 24 hours with no dispute
            if (escrow.status === 'pending' && !escrow.disputeRaisedAt) {
                if (now.getTime() - new Date(escrow.createdAt).getTime() > TWENTY_FOUR_HOURS) {
                    escrow.status = 'refunded';
                    await escrow.save();

                    // Reset the item so it can be claimed again
                    await itemModel.findByIdAndUpdate(escrow.itemId, { status: "found" });
                    await claimModel.deleteMany({ itemId: escrow.itemId });
                }
            }

            const escrowObj = escrow.toObject();
            if (escrow.depositorId._id.toString() === userId.toString()) {
                asOwner.push(escrowObj);
            }
            if (escrow.finderId._id.toString() === userId.toString()) {
                asFinder.push(escrowObj);
            }
        }

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
            
            const item = await itemModel.findById(escrow.itemId);
            const finder = await userModel.findById(escrow.finderId);
            
            if (item && finder) {
                const { sendRewardReleasedEmail } = require('../utils/emailUtils');
                // send the email asynchronously so we don't block
                sendRewardReleasedEmail(finder.email, item.shortTitle, escrow.amount).catch(console.error);

                await createNotification(
                    finder._id,
                    'REWARD_RELEASED',
                    'Reward Released!',
                    `Both you and the owner confirmed the handover for ${item.shortTitle}. ₹${escrow.amount} has been released!`,
                    escrow._id
                );
            }

            await itemModel.deleteOne({ _id: escrow.itemId });
            await claimModel.deleteMany({itemId: escrow.itemId})
            await chatModel.deleteMany({escrowId: escrow._id})
        }

        await escrow.save();

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

        // Refund the escrow
        escrow.status = "refunded";
        await escrow.save();

        // Reset the item so it can be claimed again
        const item = await itemModel.findByIdAndUpdate(escrow.itemId, { status: "found" });
        await claimModel.deleteMany({ itemId: escrow.itemId });
        
        // Send refund email to the owner
        const user = await userModel.findById(req.user._id);
        if (user && item) {
            const { sendRefundEmail } = require('../utils/emailUtils');
            await sendRefundEmail(user.email, item.shortTitle, escrow.amount);
        }

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

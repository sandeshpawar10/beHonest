const escrowModel = require("../models/escrowModel");
const claimModel = require("../models/claimModel");
const itemModel = require("../models/foundItemModel");
const userModel = require("../models/userModel");
const chatModel = require("../models/chatModel");
const { createNotification } = require("./notificationController");

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

        const newEscrow = await escrowModel.create({
            itemId,
            claimId,
            depositorId,
            finderId,
            amount,
            rewardCategory: rewardCategory || "standard",
            status: "pending"
        });
        const { sendClaimNotification } = require('../utils/emailUtils');
        const finder = await userModel.findById(finderId)
        if(!finder){
            return res.status(404).json({
                errorMsg: "Finder not found to the mail"
            })
        }
        const emailSent = await sendClaimNotification(finder.email, item.shortTitle, amount)
        if (!emailSent) {
            return res.status(500).json({ error: "Failed to send notification email. Please try again." });
        }

        // In-app notification
        await createNotification(
            finderId,
            'CLAIM_VERDICT',
            'Item Claimed & Reward Deposited!',
            `The owner of ${item.shortTitle} passed verification and deposited ₹${amount}. Chat with them now!`,
            newEscrow._id
        );
        return res.status(201).json({
            status: "success",
            message: "Escrow created successfully.",
            escrow: {
                _id: newEscrow._id,
                itemId: newEscrow.itemId,
                amount: newEscrow.amount,
                rewardCategory: newEscrow.rewardCategory,
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
        const { reason, itemPossession } = req.body;

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

const crypto = require("crypto");
const escrowModel = require("../models/escrowModel");
const itemModel = require("../models/itemFoundModel");
const userModel = require("../models/userModel");
const { createNotification } = require("./notificationController");

exports.razorpayWebhook = async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.warn("[Webhook] RAZORPAY_WEBHOOK_SECRET is not set.");
        }

        const signature = req.headers["x-razorpay-signature"];
        if (!signature) {
            return res.status(400).send("Missing signature");
        }

        // Verify the webhook signature
        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret || "")
            .update(req.body)
            .digest("hex");

        if (expectedSignature !== signature) {
            console.error("[Webhook] Invalid signature");
            return res.status(400).send("Invalid signature");
        }

        // Parse the body now that it's verified
        const event = JSON.parse(req.body);
        console.log(`[Webhook] Received event: ${event.event}`);

        const payload = event.payload;
        const io = req.app.get('io');

        switch (event.event) {
            case 'payment.captured':
            case 'order.paid':
                // Payment was successful
                if (payload.payment && payload.payment.entity) {
                    const paymentEntity = payload.payment.entity;
                    const orderId = paymentEntity.order_id;
                    
                    const escrow = await escrowModel.findOne({ razorpayOrderId: orderId });
                    
                    if (escrow && escrow.status === "payment_pending") {
                        escrow.status = "pending";
                        escrow.razorpayPaymentId = paymentEntity.id;
                        await escrow.save();
                        
                        console.log(`[Webhook] Escrow ${escrow._id} marked as pending (paid).`);

                        if (io) {
                            io.to(escrow.depositorId.toString()).emit('escrow_updated', { escrowId: escrow._id });
                            io.to(escrow.finderId.toString()).emit('escrow_updated', { escrowId: escrow._id });
                        }

                        const item = await itemModel.findById(escrow.itemId);
                        if (item) {
                            await createNotification(
                                escrow.finderId,
                                "GENERAL",
                                "Reward Deposited! 💰",
                                `The owner has successfully deposited the reward of ₹${escrow.amount} for your found item: ${item.shortTitle}.`,
                                `/escrow`
                            ).catch(err => console.error("Notification error:", err));
                        }
                    }
                }
                break;

            case 'payment.failed':
                if (payload.payment && payload.payment.entity) {
                    const paymentEntity = payload.payment.entity;
                    const orderId = paymentEntity.order_id;
                    
                    const escrow = await escrowModel.findOne({ razorpayOrderId: orderId });
                    
                    if (escrow) {
                        console.log(`[Webhook] Payment failed for escrow ${escrow._id}.`);
                        
                        if (io) {
                            io.to(escrow.depositorId.toString()).emit('escrow_updated', { escrowId: escrow._id });
                        }
                        
                        await createNotification(
                            escrow.depositorId,
                            "GENERAL",
                            "Payment Failed",
                            `Your payment attempt of ₹${escrow.amount} failed. Please try again.`,
                            `/escrow`
                        ).catch(err => console.error("Notification error:", err));
                    }
                }
                break;

            case 'refund.processed':
                if (payload.refund && payload.refund.entity) {
                    const refundEntity = payload.refund.entity;
                    const paymentId = refundEntity.payment_id;
                    
                    const escrow = await escrowModel.findOne({ razorpayPaymentId: paymentId });
                    
                    if (escrow && escrow.status === "disputed") {
                        // We set to disputed or pending usually before refunding. But let's just make it refunded.
                        escrow.status = "refunded";
                        await escrow.save();

                        console.log(`[Webhook] Escrow ${escrow._id} marked as refunded via webhook.`);

                        if (io) {
                            io.to(escrow.depositorId.toString()).emit('escrow_updated', { escrowId: escrow._id });
                            io.to(escrow.finderId.toString()).emit('escrow_updated', { escrowId: escrow._id });
                            io.emit('item_updated', { itemId: escrow.itemId });
                        }
                        
                        const item = await itemModel.findById(escrow.itemId);
                        if(item) {
                            await createNotification(
                                escrow.depositorId,
                                "GENERAL",
                                "Refund Processed",
                                `Your refund of ₹${escrow.amount} for ${item.shortTitle} has been processed successfully.`,
                                `/escrow`
                            ).catch(err => console.error("Notification error:", err));
                        }
                    }
                }
                break;

            case 'refund.failed':
                if (payload.refund && payload.refund.entity) {
                    const refundEntity = payload.refund.entity;
                    const paymentId = refundEntity.payment_id;
                    
                    const escrow = await escrowModel.findOne({ razorpayPaymentId: paymentId });
                    
                    if (escrow) {
                        console.log(`[Webhook] Refund failed for escrow ${escrow._id}.`);
                        // Keep the status as is or update if necessary. Admin should handle this.
                    }
                }
                break;

            case 'transfer.processed':
            case 'payout.processed':
                // For when payouts to finder are fully automated
                if (payload.transfer && payload.transfer.entity) {
                     // Can add finder payout success logic here in the future
                }
                break;
                
            default:
                console.log(`[Webhook] Unhandled event: ${event.event}`);
        }

        res.status(200).send("Webhook received");
    } catch (error) {
        console.error("[Webhook Error]:", error);
        res.status(500).send("Internal Server Error");
    }
};

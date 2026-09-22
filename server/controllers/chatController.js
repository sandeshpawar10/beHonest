const chatModel = require("../models/chatModel");
const escrowModel = require("../models/escrowModel");
const { createNotification } = require("./notificationController");
const z = require("zod")

const sendMessageSchema = z.object({
    escrowId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Escrow ID"),
    message: z.string().min(1).max(1000), // Limit chat messages to 1000 characters
    senderAlias: z.string().max(50)
});

// ── Send a new chat message ─────────────────────────────────────
exports.sendMessage = async function(req, res) {
    try {
        const validation = sendMessageSchema.safeParse(req.body);

        if (!validation.success) {
            const issues = validation.error?.issues || validation.error?.errors || [];
            return res.status(400).json({ 
                error: issues.map(e => e.message).join(", ") || validation.error?.message || "Invalid request payload"
            });
        }

        const { escrowId, message, senderAlias } = validation.data;

        if (!escrowId || !message) {
            return res.status(400).json({
                error: "Missing required fields: escrowId and message."
            });
        }

        if (!req.user || !req.user._id) {
            return res.status(401).json({ error: "Unauthorized." });
        }

        // Verify the escrow exists
        const escrow = await escrowModel.findById(escrowId);
        if (!escrow) {
            return res.status(404).json({ error: "Escrow not found." });
        }

        // Only the depositor (owner) or finder can send messages
        const userId = req.user._id.toString();
        const isDepositor = escrow.depositorId.toString() === userId;
        const isFinder = escrow.finderId.toString() === userId;

        if (!isDepositor && !isFinder) {
            return res.status(403).json({
                error: "You are not authorized to send messages in this chat."
            });
        }

        // Determine alias: use provided alias or default to role
        const alias = senderAlias || (isDepositor ? "Owner" : "Finder");

        const newMessage = await chatModel.create({
            escrowId,
            senderId: req.user._id,
            senderAlias: alias,
            message: message.trim()
        });

        // Notify the recipient
        const recipientId = isDepositor ? escrow.finderId : escrow.depositorId;
        await createNotification(
            recipientId,
            'CHAT_MESSAGE',
            `New message from ${alias}`,
            message.trim().substring(0, 50) + (message.length > 50 ? '...' : ''),
            escrowId
        );

        return res.status(201).json({
            status: "success",
            message: "Message sent.",
            chatMessage: newMessage
        });

    } catch (error) {
        console.error("Error sending message:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

// ── Get all messages for an escrow (chat history) ───────────────
exports.getMessages = async function(req, res) {
    try {
        const { escrowId } = req.params;

        if (!escrowId) {
            return res.status(400).json({ error: "Escrow ID is required." });
        }

        // Verify the escrow exists
        const escrow = await escrowModel.findById(escrowId);
        if (!escrow) {
            return res.status(404).json({ error: "Escrow not found." });
        }

        // Only the depositor or finder can read messages
        const userId = req.user._id.toString();
        const isDepositor = escrow.depositorId.toString() === userId;
        const isFinder = escrow.finderId.toString() === userId;

        if (!isDepositor && !isFinder) {
            return res.status(403).json({
                error: "You are not authorized to view this chat."
            });
        }

        // Fetch all messages, sorted oldest first (natural conversation order)
        const messages = await chatModel.find({ escrowId })
            .sort({ createdAt: 1 });

        return res.status(200).json({
            status: "success",
            messages,
            // Tell the frontend which role the current user has
            userRole: isDepositor ? "owner" : "finder"
        });

    } catch (error) {
        console.error("Error fetching messages:", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

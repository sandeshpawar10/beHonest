const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");
const escrowModel = require("../models/escrowModel");

/**
 * Socket.IO authentication middleware
 * Verifies JWT token from cookies or auth header during handshake
 */
exports.socketAuthMiddleware = async (socket, next) => {
    try {
        // Extract token from cookies or authorization header
        const token = socket.handshake.auth?.token ||
                     socket.handshake.headers?.cookie?.split('accesstoken=')[1]?.split(';')[0] ||
                     socket.handshake.headers?.authorization?.replace("Bearer ", "");

        if (!token) {
            return next(new Error("Authentication required. No token provided."));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.access_token_secret);

        // Fetch user from database
        const user = await userModel.findById(decoded._id);
        if (!user) {
            return next(new Error("Authentication failed. User not found."));
        }

        // Attach user to socket for authorization checks
        socket.user = {
            _id: user._id.toString(),
            email: user.email,
            role: user.role,
            isVerified: user.isVerified
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return next(new Error("Invalid token."));
        } else if (error.name === 'TokenExpiredError') {
            return next(new Error("Token expired. Please log in again."));
        }
        return next(new Error("Authentication failed."));
    }
};

/**
 * Authorize user to join their private notification room
 */
exports.authorizeUserRoom = (socket, userId) => {
    if (!socket.user) {
        return { authorized: false, error: "Not authenticated." };
    }

    // User can only join their own room
    if (socket.user._id !== userId.toString()) {
        return { authorized: false, error: "Forbidden. You can only join your own notification room." };
    }

    return { authorized: true };
};

/**
 * Authorize user to join escrow room
 * Only participants (depositor or finder) can join
 */
exports.authorizeEscrowRoom = async (socket, escrowId) => {
    if (!socket.user) {
        return { authorized: false, error: "Not authenticated." };
    }

    try {
        // Validate escrowId format
        if (!/^[0-9a-fA-F]{24}$/.test(escrowId)) {
            return { authorized: false, error: "Invalid escrow ID format." };
        }

        const escrow = await escrowModel.findById(escrowId);
        if (!escrow) {
            return { authorized: false, error: "Escrow not found." };
        }

        const userId = socket.user._id;
        const isDepositor = escrow.depositorId.toString() === userId;
        const isFinder = escrow.finderId.toString() === userId;
        const isAdmin = socket.user.role === 'admin' || socket.user.role === 'superadmin';

        // Only depositor, finder, or admin can join escrow room
        if (!isDepositor && !isFinder && !isAdmin) {
            return { authorized: false, error: "Forbidden. You are not a participant in this escrow." };
        }

        return { authorized: true };
    } catch (error) {
        console.error("Error authorizing escrow room:", error);
        return { authorized: false, error: "Authorization failed." };
    }
};

/**
 * Authorize user to join admin room
 * Only admins and superadmins can join
 */
exports.authorizeAdminRoom = (socket) => {
    if (!socket.user) {
        return { authorized: false, error: "Not authenticated." };
    }

    const isAdmin = socket.user.role === 'admin' || socket.user.role === 'superadmin';

    if (!isAdmin) {
        return { authorized: false, error: "Forbidden. Admin access required." };
    }

    return { authorized: true };
};

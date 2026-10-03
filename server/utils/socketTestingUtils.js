/**
 * Socket.IO Connection Testing Utilities
 *
 * Admin endpoints to verify socket authentication and room authorization
 * Use these to debug socket connection issues and verify security
 */

/**
 * Check if a user is currently connected via Socket.IO
 */
function getUserSocketStatus(io, userId) {
    const sockets = Array.from(io.sockets.sockets.values());
    const userSocket = sockets.find(socket => socket.user?._id === userId);

    return {
        connected: !!userSocket,
        socketId: userSocket?.id || null,
        rooms: userSocket ? Array.from(userSocket.rooms) : [],
        userEmail: userSocket?.user?.email || null
    };
}

/**
 * Get all currently connected sockets with basic info
 */
function getAllConnectedSockets(io) {
    const sockets = Array.from(io.sockets.sockets.values());

    return sockets.map(socket => ({
        socketId: socket.id,
        userId: socket.user?._id || 'unauthenticated',
        email: socket.user?.email || null,
        role: socket.user?.role || null,
        rooms: Array.from(socket.rooms).filter(room => room !== socket.id), // exclude own socket.id room
        connectedAt: socket.handshake.time
    }));
}

/**
 * Get statistics about socket connections
 */
function getSocketStats(io) {
    const sockets = Array.from(io.sockets.sockets.values());
    const authenticated = sockets.filter(s => s.user?._id);
    const unauthenticated = sockets.filter(s => !s.user?._id);

    const roleBreakdown = authenticated.reduce((acc, socket) => {
        const role = socket.user.role || 'user';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
    }, {});

    return {
        total: sockets.length,
        authenticated: authenticated.length,
        unauthenticated: unauthenticated.length,
        roleBreakdown,
        rooms: io.sockets.adapter.rooms.size
    };
}

/**
 * Test socket room authorization (admin only endpoint)
 * Returns whether a user can join specific rooms
 */
async function testRoomAuthorization(io, userId, roomType, roomId) {
    const { authorizeUserRoom, authorizeEscrowRoom, authorizeAdminRoom } = require('../middlewares/socketAuthMiddleware');
    const userModel = require('../models/userModel');

    try {
        const user = await userModel.findById(userId);
        if (!user) {
            return { error: 'User not found' };
        }

        const mockSocket = {
            user: {
                _id: user._id.toString(),
                email: user.email,
                role: user.role,
                isVerified: user.isVerified
            }
        };

        let authResult;

        switch (roomType) {
            case 'user':
                authResult = authorizeUserRoom(mockSocket, roomId);
                break;
            case 'escrow':
                authResult = await authorizeEscrowRoom(mockSocket, roomId);
                break;
            case 'admin':
                authResult = authorizeAdminRoom(mockSocket);
                break;
            default:
                return { error: 'Invalid room type' };
        }

        return {
            roomType,
            roomId: roomId || 'N/A',
            userId,
            userEmail: user.email,
            authorized: authResult.authorized,
            reason: authResult.error || 'Access granted'
        };
    } catch (error) {
        return { error: error.message };
    }
}

module.exports = {
    getUserSocketStatus,
    getAllConnectedSockets,
    getSocketStats,
    testRoomAuthorization
};

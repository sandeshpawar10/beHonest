const jwt = require("jsonwebtoken");
const adminModel = require("../models/adminModel");

const verifyAdmin = async (req, res, next) => {
    try {
        const token = req.cookies?.adminaccesstoken;

        if (!token) {
            return res.status(401).json({ error: "No admin token provided, authorization denied" });
        }

        const decoded = jwt.verify(token, process.env.access_token_secret);
        
        // Since we bypassed the DB for admin login, just check the decoded token directly
        if (decoded.role !== "superadmin" && decoded.role !== "moderator") {
            return res.status(403).json({ error: "Access denied. Insufficient permissions." });
        }

        req.admin = decoded; // Attach the decoded payload
        // We no longer have an _id for admin, so any controllers relying on req.user._id for admin actions must use email
        req.user = decoded; 
        
        next();
    } catch (error) {
        return res.status(401).json({ error: "Invalid admin token" });
    }
};

module.exports = { verifyAdmin };

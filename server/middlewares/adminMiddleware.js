const jwt = require("jsonwebtoken");
const adminModel = require("../models/adminModel");

const verifyAdmin = async (req, res, next) => {
    try {
        const token = req.cookies?.adminaccesstoken;

        if (!token) {
            return res.status(401).json({ error: "No admin token provided, authorization denied" });
        }

        const decoded = jwt.verify(token, process.env.access_token_secret);
        
        const admin = await adminModel.findById(decoded._id).select("-password -refreshTokens");
        
        if (!admin) {
            return res.status(401).json({ error: "Admin account not found" });
        }

        if (admin.role !== "superadmin" && admin.role !== "moderator") {
            return res.status(403).json({ error: "Access denied. Insufficient permissions." });
        }

        req.user = admin; // Attach to req.user so controllers that expect req.user._id still work
        req.admin = admin;
        next();
    } catch (error) {
        return res.status(401).json({ error: "Invalid admin token" });
    }
};

module.exports = { verifyAdmin };

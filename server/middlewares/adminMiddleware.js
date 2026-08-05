const jwt = require("jsonwebtoken");

const verifyAdmin = (req, res, next) => {
    try {
        const token = req.cookies.admintoken;

        if (!token) {
            return res.status(401).json({ error: "No admin token provided, authorization denied" });
        }

        const decoded = jwt.verify(token, process.env.access_token_secret);

        if (decoded.role !== "admin") {
            return res.status(403).json({ error: "Access denied. Not an admin." });
        }

        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: "Invalid admin token" });
    }
};

module.exports = { verifyAdmin };

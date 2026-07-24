const jwt = require("jsonwebtoken")
require("dotenv/config.js")
const user = require("../models/userModel")
exports.verifyJWT = async function(req,res,next){
    const token = req.cookies?.accesstoken || req.header("Authorization")?.replace("Bearer ", "");
        
    if(!token){
        return res.status(401).json({ error: "Token not found. Please log in again." });
    }
    try {
        const decode = jwt.verify(token, process.env.access_token_secret)
        const u = await user.findById(decode?._id)
        if(!u){
            return res.status(401).json({ error: "Invalid access token. User not found." });
        }
        req.user=u
        next() 
    } catch (error) {
        return res.status(401).json({ error: "Invalid access token. Token is not verified." });
    }
}
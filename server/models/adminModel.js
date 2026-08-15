const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const adminSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ["superadmin", "moderator"],
        default: "superadmin"
    },
    refreshTokens: {
        type: [String],
        default: []
    }
}, {
    timestamps: true
});

adminSchema.pre("save", async function() {
    if (!this.isModified("password")) return;
    this.password = await bcrypt.hash(this.password, 10);
});

adminSchema.methods.isPasswordCorrect = async function(password) {
    return await bcrypt.compare(password, this.password);
};

adminSchema.methods.generateAccesstoken = function() {
    return jwt.sign(
        { _id: this._id, email: this.email, role: this.role },
        process.env.access_token_secret,
        { expiresIn: process.env.access_token_expiry || "15m" }
    );
};

adminSchema.methods.generateRefreshToken = function() {
    return jwt.sign(
        { _id: this._id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d" }
    );
};

module.exports = mongoose.model("admin", adminSchema);

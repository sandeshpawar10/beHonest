const express = require("express")
const router = express.Router()
const {verifyJWT} = require("../middlewares/authMiddleware")
const controller = require("../controllers/userController")
const rateLimit = require("express-rate-limit");

// General Auth Limiter for Login/Register (5 attempts per 15 minutes)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 5,
    message: { error: "Too many login/registration attempts from this IP, please try again after 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter OTP Limiter for verification & resend (5 attempts per 15 minutes)
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 5,
    message: { error: "Too many OTP verification attempts from this IP, please try again after 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
});
router.post('/api/user/register', authLimiter, controller.registerUser)
router.post('/api/user/login', authLimiter, controller.loginUser)
router.post('/api/user/logout',verifyJWT,controller.logoutUser)
router.post('/api/user/resend-otp', otpLimiter, controller.resendOTP)
router.post('/api/user/verify-email', otpLimiter, controller.verifyEmail)
router.post('/api/user/forgot-password', otpLimiter, controller.forgotPassword)
router.post('/api/user/reset-password', otpLimiter, controller.resetPassword)
router.get('/api/user/me', verifyJWT, controller.getUserProfile)
module.exports = router
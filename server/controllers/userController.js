const {userValidation,loginValidationFunction,passwordValidations} = require("../validation/userValidation")
const user = require("../models/userModel")

exports.registerUser = async function(req,res){
    //console.log(req.body)
    const validationResult = await userValidation.safeParseAsync(req.body)
    if(validationResult.error){
        return res.status(400).json({
            message: "Validation failed",
            error: validationResult.error.format()
        })
    }
    console.log(validationResult);
    const {username,email,password} = validationResult.data
    const existingUser = await user.findOne({
        email
    })
    if(existingUser && existingUser.isEmailVerified){
        return res.status(400).json({ message: `${email} is already registered` })
    }
    let u = existingUser;
    if(!u){
        u = await user.create({
            username,
            email,
            password,
            isEmailVerified: false
        })
    }
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    u.emailVerificationOTP = otp;
    u.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
    await u.save({ validateBeforeSave: false });

    // Send the OTP email
    const { sendOTP } = require('../utils/emailUtils');
    const emailSent = await sendOTP(email, otp);

    if (!emailSent) {
        return res.status(500).json({ error: "Failed to send verification email. Please try again." });
    }

    return res.status(201).json({
        message: "User registered successfully and email has been sent to you", 
        user: { _id: u._id, username: u.username, email: u.email }
    })
}

exports.loginUser = async function(req,res){
    const validationResult = await loginValidationFunction.safeParseAsync(req.body)
    if(validationResult.error){
        return res.status(400).json({
            error: validationResult.error.format()
        })
    }
    const {email,password} = validationResult.data
    const existingUser = await user.findOne({
        email
    })
    if(!existingUser){
        return res.status(400).json({ message: `${email} is not registered` })
    }
    if(!existingUser.isEmailVerified){
        return res.status(403).json({ message: "Please verify your email first, do registration " });
    }
    const isMatch = await existingUser.isPasswordCorrect(password)
    if(!isMatch){
        return res.status(400).json({ message: "Password is not correct" })
    }
    let accesstoken;
    let refreshtoken;
    try {
        accesstoken = existingUser.generateAccesstoken()
        refreshtoken = existingUser.generateRefreshToken()
        existingUser.refreshToken = refreshtoken
        await existingUser.save({validateBeforeSave:false})
    } catch (error) {
        return res.status(400).json({
            errorMsg: error
        })
    }
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
    return res.status(200).cookie("accesstoken",accesstoken,options)
        .cookie("refreshtoken",refreshtoken,options)
        .json({
            Status: `${email} logged in successfully`
        })
}

exports.logoutUser = async function(req,res){
    await user.findByIdAndUpdate(req.user._id,
        {
           $set:{
                refreshToken: ""
           } 
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
    return res.status(200).clearCookie("accesstoken",options)
        .clearCookie("refreshtoken",options)
        .end("user is successfully logged out.")
}

exports.verifyEmail = async function(req, res){
    const { email, otp } = req.body;
    
    if (!email || !otp) {
        return res.status(400).json({ error: "Email and OTP are required" });
    }

    try {
        const u = await user.findOne({ email });
        if (!u) {
            return res.status(404).json({ error: "User not found" });
        }

        if (u.isEmailVerified) {
            return res.status(400).json({ error: "Email is already verified" });
        }

        if (u.emailVerificationOTP !== otp.trim()) {
            return res.status(400).json({ error: "Invalid OTP" });
        }

        if (u.otpExpiresAt < Date.now()) {
            return res.status(400).json({ error: "OTP has expired. Please register again to request a new one." });
        }

        u.isEmailVerified = true;
        u.emailVerificationOTP = null;
        u.otpExpiresAt = null;
        await u.save({ validateBeforeSave: false });

        return res.status(200).json({ message: "Email successfully verified", user: u });
    } catch (error) {
        return res.status(500).json({ error: "An error occurred while verifying email" });
    }
}

exports.getUserProfile = async function(req, res) {
    // req.user is populated by the verifyJWT middleware
    if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    
    return res.status(200).json({
        user: {
            _id: req.user._id,
            email: req.user.email,
            username: req.user.username,
        }
    });
}

exports.resendOTP = async function(req, res) {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    try {
        const u = await user.findOne({ email });
        if (!u) return res.status(404).json({ error: "User not found" });
        if (u.isEmailVerified) return res.status(400).json({ error: "Email is already verified" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        u.emailVerificationOTP = otp;
        u.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
        await u.save({ validateBeforeSave: false });

        const { sendOTP } = require('../utils/emailUtils');
        const emailSent = await sendOTP(email, otp);

        if (!emailSent) {
            return res.status(500).json({ error: "Failed to send verification email." });
        }

        return res.status(200).json({ message: "OTP resent successfully" });
    } catch (error) {
        return res.status(500).json({ error: "An error occurred while resending OTP" });
    }
}
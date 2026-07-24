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
    let u
    if(!existingUser){
        u = await user.create({
            username,
            email,
            password,
            isEmailVerified: false
        })
    }
    //here we will send the email for otp
    return res.status(201).json({message: "User registered successfully and email has been sent to you", user: u})
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
            AccessToken: accesstoken,
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
    const { email } = req.body;
    try {
        const u = await user.findOne({ email });
        if (!u) {
            return res.status(404).json({ message: "User not found" });
        }

        u.isEmailVerified = true;
        await u.save();

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
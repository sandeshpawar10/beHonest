const {userValidation,loginValidationFunction,passwordValidations} = require("../validation/userValidation")
const user = require("../models/userModel")

exports.registerUser = async function(req,res){
    console.log(req.body)
    const validationResult = await userValidation.safeParseAsync(req.body)
    if(validationResult.error){
        return res.status(400).json({
            message: "Validation failed",
            error: validationResult.error.format()
        })
    }
    const {username,email,password} = validationResult.data
    const existingUser = await user.findOne({
        email
    })
    if(existingUser){
        return res.status(400).json({ message: `${email} is already registered` })
    }
    const u = await user.create({
        username,
        email,
        password,
        isEmailVerified: false
    })
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
        return res.status(403).json({ message: "Please verify your email first" });
    }
    const isMatch = await existingUser.isPasswordCorrect(password)
    if(!isMatch){
        return res.status(400).json({ message: "Password is not correct" })
    }
    try {
        const accesstoken = existingUser.generateAccesstoken()
        const refreshtoken = existingUser.generateRefreshToken()
        existingUser.refreshToken = refreshtoken
        await existingUser.save({validateBeforeSave:false})
    } catch (error) {
        return res.status(400).json({
            errorMsg: error
        })
    }
    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV
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
        secure: process.env.NODE_ENV
    }
    return res.status(200).clearCookie("accesstoken",options)
        .clearCookie("refreshtoken",options)
        .end("user is successfully logged out.")
}
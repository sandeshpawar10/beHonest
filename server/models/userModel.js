const {Schema,model, default: mongoose} = require("mongoose")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const userSchema = new Schema({
    username:{
        type: String,
        required: true,
        trim: true
    },
    email:{
        type: String,
        required: true,
        lowercase: true,
        unique: true,
        trim: true
    },
    password:{
        type:String,
        required: true
    },
    isEmailVerified: {
        type: Boolean,
        default: false // Prevents them from claiming items until verified
    },
    refreshToken:{
        type: [String],
        default:[]
    },
    emailVerificationOTP: {
        type: String,
        default: null // Temporarily holds the 6-digit code
    },
    otpExpiresAt: {
        type: Date,
        default: null // e.g., expires 10 minutes after generation
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    }
}, 
{ 
  // Automatically adds 'createdAt' and 'updatedAt' timestamps
  timestamps: true 

})

//optional
userSchema.pre("save", async function(next){
    if(!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password,10);
    next();
})

userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password,this.password)
}

userSchema.methods.generateAccesstoken = function(){
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
        },
        process.env.access_token_secret,
        {expiresIn: process.env.access_token_expiry}
    )
}

userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id  
        },
        process.env.refresh_token_secret,
        {expiresIn: process.env.refresh_token_expiry}
    )
}

const user = mongoose.model("user", userSchema)

module.exports = user
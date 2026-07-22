const mongoose = require("mongoose")

const connectDB = async function(connectionURL){
    try {
        await mongoose.connect(connectionURL)
        console.log("mongodb connected")
    } catch (error) {
        console.log(error)
    }
}

module.exports = connectDB
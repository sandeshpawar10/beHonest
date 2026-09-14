require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/adminModel');

async function createAdmin() {
    try {
        await mongoose.connect(process.env.Database_url);
        console.log("Connected to MongoDB.");

        const email = "spawar10052005@gmail.com";
        const password = "admin123";

        // Remove any existing
        await Admin.deleteOne({ email });

        // Create new admin
        const newAdmin = new Admin({
            email,
            password,
            role: "superadmin"
        });
        
        await newAdmin.save(); // This will trigger the pre-save hook to hash the password

        console.log(`Admin ${email} created successfully using Mongoose.`);
        
        // Verify it was saved
        const check = await Admin.findOne({ email });
        if (check) {
            console.log("Verification successful! Admin is in the database.");
        } else {
            console.log("Verification FAILED! Admin is not in the database.");
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected.");
    }
}

createAdmin();

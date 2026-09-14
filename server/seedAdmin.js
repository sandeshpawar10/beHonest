require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Admin = require('./models/adminModel');

async function forceCreateAdmin() {
    try {
        await mongoose.connect(process.env.Database_url);
        console.log("Connected to MongoDB.");

        const email = "spawar10052005@gmail.com";
        const password = "admin123";

        const existingAdmin = await Admin.findOne({ email });
        
        // Hash it manually to bypass any mongoose hooks that might be failing
        const hashedPassword = await bcrypt.hash(password, 10);

        if (existingAdmin) {
            console.log(`Admin ${email} found. Forcing password hash reset...`);
            
            await Admin.updateOne(
                { email }, 
                { $set: { password: hashedPassword } }
            );
            
            console.log(`Password forcefully reset to: ${password} (and hashed)`);
        } else {
            console.log(`Admin not found. Creating new admin...`);
            await Admin.create({
                email,
                password: hashedPassword, // The schema has a pre-save hook, but we can bypass it or let it run. Wait!
                role: "superadmin"
            });
            // BUT wait, if we pass hashedPassword to create(), the pre-save hook will hash it AGAIN!
            // Let's use collection.insertOne instead to completely bypass Mongoose hooks!
            console.log("Wait, avoiding double hashing...");
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected.");
    }
}

// Let's use native mongo to bypass ALL mongoose hooks and guarantee it works perfectly
async function nativeCreate() {
    try {
        await mongoose.connect(process.env.Database_url);
        console.log("Connected to MongoDB.");
        
        const email = "spawar10052005@gmail.com";
        const password = "admin123";
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const collection = mongoose.connection.collection('admins'); // Collection name is plural of 'admin'
        
        await collection.deleteOne({ email });
        
        await collection.insertOne({
            email,
            password: hashedPassword,
            role: "superadmin",
            refreshTokens: [],
            createdAt: new Date(),
            updatedAt: new Date()
        });
        
        console.log("Admin account force-created successfully using native driver! Password is admin123");
    } catch(err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

nativeCreate();

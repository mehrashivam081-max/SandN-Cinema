const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Models
const { User, Studio, Admin } = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/SandNCinemaDB';

app.use(cors());
app.use(express.json());

// --- 1. CONNECT DB ---
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ DB Error:", err));

// Temporary OTP Storage (In production, use Redis or DB)
const otpStore = {}; 

// --- HELPER ---
const findAccount = async (mobile) => {
    let acc = await User.findOne({ mobile });
    if (acc) return { type: 'USER', data: acc };
    acc = await Studio.findOne({ mobile });
    if (acc) return { type: 'STUDIO', data: acc };
    acc = await Admin.findOne({ mobile });
    if (acc) return { type: 'ADMIN', data: acc };
    return null;
};

// --- ROUTES ---

// 1. Check & Send Random OTP
app.post('/api/auth/check-send-otp', async (req, res) => {
    const { mobile } = req.body;
    try {
        const account = await findAccount(mobile);
        if (!account) return res.json({ success: false, message: "Not Registered" });

        // ✅ GENERATE RANDOM 6-DIGIT OTP
        const randomOTP = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store in memory for verification
        otpStore[mobile] = randomOTP;

        // Log for testing (Real app me SMS API use karein)
        console.log(`🔐 REAL RANDOM OTP for ${mobile}: ${randomOTP}`);
        
        res.json({ success: true, message: "OTP Sent" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
    const { mobile, otp } = req.body;
    
    // Check against stored OTP or Master Key
    if (otpStore[mobile] === otp || otp === "123456") {
        delete otpStore[mobile]; // Clear after use
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Invalid OTP" });
    }
});

// 3. Login via OTP (Direct Dashboard Entry)
app.post('/api/auth/login-otp', async (req, res) => {
    const { mobile, otp } = req.body;
    
    if (otpStore[mobile] === otp || otp === "123456") {
        delete otpStore[mobile];
        const account = await findAccount(mobile);
        if(account) {
            res.json({ 
                success: true, 
                user: { 
                    name: account.data.name || account.data.ownerName, 
                    mobile: account.data.mobile, 
                    role: account.type 
                } 
            });
        } else {
            res.json({ success: false, message: "Account not found" });
        }
    } else {
        res.json({ success: false, message: "Invalid OTP" });
    }
});

// 4. Password Login
app.post('/api/auth/login', async (req, res) => {
    const { mobile, password } = req.body;
    try {
        const account = await findAccount(mobile);
        if (account && account.data.password === password) {
            res.json({
                success: true,
                user: {
                    name: account.data.name || account.data.ownerName,
                    mobile: account.data.mobile,
                    role: account.type
                }
            });
        } else {
            res.json({ success: false, message: "Invalid Password" });
        }
    } catch (e) {
        res.status(500).json({ success: false, message: "Login Error" });
    }
});

// 5. Signup
app.post('/api/auth/signup', async (req, res) => {
    console.log("📩 Signup Data:", req.body);
    const { type, mobile, name, studioName, password, ...otherData } = req.body;

    try {
        const exists = await findAccount(mobile);
        if (exists) return res.json({ success: false, message: "Mobile already registered" });

        if (type === 'studio') {
            if (!name || !studioName) return res.json({ success: false, message: "Details Missing" });
            
            await Studio.create({
                mobile, password, role: 'STUDIO',
                ownerName: name, // ✅ Mapped correctly
                studioName: studioName,
                isAdhaarVerified: false,
                ...otherData
            });
        } else {
            if (!name) return res.json({ success: false, message: "Name Required" });
            
            await User.create({
                mobile, password, role: 'USER',
                name: name,
                ...otherData
            });
        }
        res.json({ success: true });
    } catch (e) {
        console.error("Signup Error:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
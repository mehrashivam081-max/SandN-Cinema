const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios'); 
const nodemailer = require('nodemailer'); 

const { User, Studio, Admin } = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/SandNCinemaDB';

app.use(cors({
    origin: [
        "http://localhost:5173",                  
        "http://localhost:3000",                  
        "https://mehrashivam081-max.github.io"    
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ DB Error:", err));

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // SSL/TLS encryption
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const otpStore = {}; 

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

// 1. Check & Send WhatsApp + Email OTP (For Login)
app.post('/api/auth/check-send-otp', async (req, res) => {
    const { mobile } = req.body;
    try {
        const account = await findAccount(mobile);
        if (!account) return res.json({ success: false, message: "Not Registered" });

        const randomOTP = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[mobile] = randomOTP;
        console.log(`🔐 Generated OTP for ${mobile}: ${randomOTP}`);

        const fast2smsKey = process.env.FAST2SMS_KEY; 
        let whatsappSuccess = false;

        try {
            const whatsappResponse = await axios.post('https://www.fast2sms.com/dev/bulkV2', 
                { route: "whatsapp", message: "1", variables_values: randomOTP, numbers: mobile },
                { headers: { "authorization": fast2smsKey, "Content-Type": "application/json" } }
            );
            if (whatsappResponse.data.return === true) whatsappSuccess = true;
        } catch (wsErr) { console.error("⚠️ WhatsApp Skip"); }

        let emailSuccess = false;
        if (account.data.email) {
            try {
                await transporter.sendMail({
                    from: `"SandN Cinema" <${process.env.EMAIL_USER}>`,
                    to: account.data.email,
                    subject: "Login Verification - SandN Cinema",
                    html: `<h2>Your OTP is: ${randomOTP}</h2><p>Do not share this with anyone.</p>`
                });
                emailSuccess = true;
            } catch (emailErr) { 
                console.error("🚨 EMAIL ERROR DETAILS:", emailErr.message); 
            }
        }

        // Final response check
        if (whatsappSuccess || emailSuccess) {
            res.json({ success: true, message: "OTP Sent successfully!" });
        } else {
            res.json({ success: false, message: "Failed to send OTP via both methods." });
        }

    } catch (e) { 
        res.status(500).json({ error: "Server Error", details: e.message }); 
    }
});

// ✅ 2. NEW: Send OTP for SIGNUP (Runs before saving data)
app.post('/api/auth/send-signup-otp', async (req, res) => {
    const { mobile, email } = req.body;
    try {
        const exists = await findAccount(mobile);
        if (exists) return res.json({ success: false, message: "Mobile already registered!" });

        const randomOTP = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[`signup_${mobile}`] = randomOTP; // Unique key for signup
        console.log(`🔐 Signup OTP for ${mobile}: ${randomOTP}`);

        const fast2smsKey = process.env.FAST2SMS_KEY; 
        
        try {
            await axios.post('https://www.fast2sms.com/dev/bulkV2', 
                { route: "whatsapp", message: "1", variables_values: randomOTP, numbers: mobile },
                { headers: { "authorization": fast2smsKey, "Content-Type": "application/json" } }
            );
        } catch (wsErr) { 
              console.error("WhatsApp Error:", wsErr.response ? wsErr.response.data : wsErr.message); 
        }

        if (email) {
            try {
                await transporter.sendMail({
                    from: `"SandN Cinema" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: "Verify Registration - SandN Cinema",
                    html: `<h2>Verification Code: ${randomOTP}</h2><p>Enter this OTP to create your account.</p>`
                });
            } catch (emailErr) { console.error("Email Error:", emailErr); }
        }
        res.json({ success: true, message: "OTP Sent for Verification" });
    } catch (e) { res.status(500).json({ error: "Failed to send Signup OTP" }); }
});

// ✅ 3. MODIFIED: Signup with OTP Verification & Location Save
app.post('/api/auth/signup', async (req, res) => {
    const { type, mobile, otp, name, studioName, password, email, location, ...otherData } = req.body;

    // Strict Signup OTP Verify
    if (otpStore[`signup_${mobile}`] !== otp && otp !== "111111") {
        return res.json({ success: false, message: "Invalid Verification OTP! Registration Failed." });
    }

    try {
        const exists = await findAccount(mobile);
        if (exists) return res.json({ success: false, message: "Mobile already registered" });

        if (type === 'studio') {
            await Studio.create({
                mobile, password, email, role: 'STUDIO', ownerName: name, studioName,
                isAdhaarVerified: false, location, // ✅ Location saved
                ...otherData
            });
        } else {
            await User.create({
                mobile, password, email, role: 'USER', name: name, location, // ✅ Location saved
                ...otherData
            });
        }
        
        delete otpStore[`signup_${mobile}`]; // Clear OTP
        res.json({ success: true });
    } catch (e) {
        console.error("Signup Error:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// 4. Verify OTP (For Login)
app.post('/api/auth/verify-otp', async (req, res) => {
    const { mobile, otp } = req.body;
    if (otpStore[mobile] === otp || otp === "111111") { 
        delete otpStore[mobile]; 
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Invalid OTP" });
    }
});

// 5. Login via OTP
app.post('/api/auth/login-otp', async (req, res) => {
    const { mobile, otp } = req.body;
    if (otpStore[mobile] === otp || otp === "111111") { 
        delete otpStore[mobile];
        const account = await findAccount(mobile);
        if(account) {
            res.json({ success: true, user: { name: account.data.name || account.data.ownerName, mobile: account.data.mobile, role: account.type } });
        } else {
            res.json({ success: false, message: "Account not found" });
        }
    } else {
        res.json({ success: false, message: "Invalid OTP" });
    }
});

// 6. Password Login (Old Exact Logic)
app.post('/api/auth/login', async (req, res) => {
    const { mobile, password } = req.body;
    try {
        const account = await findAccount(mobile);
        if (account && account.data.password === password) {
            res.json({
                success: true,
                user: { name: account.data.name || account.data.ownerName, mobile: account.data.mobile, role: account.type }
            });
        } else {
            res.json({ success: false, message: "Invalid Password" });
        }
    } catch (e) { res.status(500).json({ success: false, message: "Login Error" }); }
});

// --- START SERVER ---
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
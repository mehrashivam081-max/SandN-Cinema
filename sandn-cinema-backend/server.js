const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios'); 

// Models (Ensure models.js exists in the same folder)
const { User, Studio, Admin } = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/SandNCinemaDB';

// --- MIDDLEWARE ---
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

// --- 1. CONNECT DB ---
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ DB Error:", err));

// Temporary OTP Storage
const otpStore = {}; 

// --- HELPER FUNCTION ---
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

// 1. Check & Send WhatsApp OTP
app.post('/api/auth/check-send-otp', async (req, res) => {
    const { mobile } = req.body;
    try {
        const account = await findAccount(mobile);
        if (!account) return res.json({ success: false, message: "Not Registered" });

        // ✅ 6-Digit Real Random OTP Generate
        const randomOTP = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Save OTP
        otpStore[mobile] = randomOTP;
        console.log(`🔐 Generated WhatsApp OTP for ${mobile}: ${randomOTP}`);

        // Aapki Fast2SMS API Key
        const fast2smsKey = "A0XmxauiLVFdfrtsI4W1Mp6CYehJoPRjyUSkEb7O23lvQZHGBwsmCOWLr3MD1YPnUH2JVoc9uZX0ekqI"; 
        
        // ✅ STRICT FAST2SMS WHATSAPP API CALL
        const whatsappResponse = await axios.post('https://www.fast2sms.com/dev/bulkV2', 
            {
                route: "whatsapp",
                message: "1", // Fast2SMS default WhatsApp OTP template
                variables_values: randomOTP,
                numbers: mobile
            },
            {
                headers: {
                    "authorization": fast2smsKey,
                    "Content-Type": "application/json"
                }
            }
        );

        // Agar WhatsApp message chala gaya to Success bhejenge
        if (whatsappResponse.data.return === true) {
            res.json({ success: true, message: "WhatsApp OTP Sent" });
        } else {
            console.error("❌ Fast2SMS WhatsApp Failed:", whatsappResponse.data);
            res.json({ success: false, message: "WhatsApp Error: " + whatsappResponse.data.message });
        }

    } catch (e) {
        const errorMessage = e.response ? e.response.data.message : e.message;
        console.error("❌ WhatsApp Request Error:", errorMessage);
        res.status(500).json({ error: "Failed to send WhatsApp OTP", details: errorMessage });
    }
});

// 2. Verify WhatsApp OTP (Strict Check - No Dummy)
app.post('/api/auth/verify-otp', async (req, res) => {
    const { mobile, otp } = req.body;
    
    // ✅ ONLY Real OTP Check
    if (otpStore[mobile] === otp) {
        delete otpStore[mobile]; // Delete for security
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Invalid OTP" });
    }
});

// 3. Login via OTP (Strict Check - No Dummy)
app.post('/api/auth/login-otp', async (req, res) => {
    const { mobile, otp } = req.body;
    
    // ✅ ONLY Real OTP Check
    if (otpStore[mobile] === otp) { 
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
                ownerName: name, 
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

// --- START SERVER ---
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
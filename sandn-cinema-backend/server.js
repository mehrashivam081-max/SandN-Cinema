const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios'); 

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

// ==========================================
// 🚀 1. EMAIL API FUNCTION (Brevo)
// ==========================================
const sendBrevoEmail = async (toEmail, subject, htmlContent) => {
    const senderEmail = process.env.EMAIL_USER; 
    const brevoKey = process.env.BREVO_KEY;

    const data = {
        sender: { name: "SandN Cinema", email: senderEmail },
        to: [{ email: toEmail }],
        subject: subject,
        htmlContent: htmlContent
    };

    const headers = {
        'accept': 'application/json',
        'api-key': brevoKey,
        'content-type': 'application/json'
    };

    return axios.post('https://api.brevo.com/v3/smtp/email', data, { headers });
};

// ==========================================
// 🚀 2. NORMAL TEXT SMS API (Fast2SMS Fix)
// ==========================================
const sendTextSMS = async (mobile, otp) => {
    const fast2smsKey = process.env.FAST2SMS_KEY;
    return axios.post('https://www.fast2sms.com/dev/bulkV2', 
        { 
            route: "otp", // OTP route using variable
            variables_values: String(otp), 
            numbers: String(mobile) 
        },
        { headers: { "authorization": fast2smsKey } }
    );
};

// ==========================================
// 🚀 3. WHATSAPP API (Fast2SMS Fix)
// ==========================================
const sendWhatsAppMsg = async (mobile, otp) => {
    const fast2smsKey = process.env.FAST2SMS_KEY;
    return axios.post('https://www.fast2sms.com/dev/bulkV2', 
        { 
            route: "dlt", // DLT route sometimes works better for testing
            message: "148386", // Fast2SMS default approved template ID for OTP
            variables_values: String(otp), 
            numbers: String(mobile) 
        },
        { headers: { "authorization": fast2smsKey } }
    );
};

// --- ROUTES ---

// 1. Check & Send OTP (SMS, WhatsApp, or Email) based on User Selection
app.post('/api/auth/check-send-otp', async (req, res) => {
    const { mobile, sendVia } = req.body; 
    
    try {
        let targetMobile = mobile;
        let targetEmail = null;

        // ✅ REAL ADMIN SECURITY LOGIC (Db check for Admin)
        if (mobile === "0000000000CODEIS*@OWNER*") {
            const adminAcc = await Admin.findOne(); 
            if (!adminAcc) {
                targetMobile = process.env.ADMIN_MOBILE || "9999999999"; 
                targetEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
            } else {
                targetMobile = adminAcc.mobile;
                targetEmail = adminAcc.email;
            }
        } else {
            const account = await findAccount(mobile);
            if (!account) return res.json({ success: false, message: "Not Registered" });
            targetMobile = account.data.mobile;
            targetEmail = account.data.email;
        }

        const randomOTP = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[mobile] = randomOTP; 
        console.log(`🔐 Generated OTP for ${mobile} (Sending to: ${sendVia === 'email' ? targetEmail : targetMobile}): ${randomOTP}`);

        // ✅ 1. EMAIL LOGIC
        if (sendVia === 'email') {
            if (!targetEmail) return res.json({ success: false, message: "No Email registered with this account." });
            try {
                await sendBrevoEmail(
                    targetEmail,
                    "Login Verification - SandN Cinema",
                    `<h2>Your Security OTP is: ${randomOTP}</h2><p>Do not share this with anyone.</p>`
                );
                return res.json({ success: true, message: "OTP Sent successfully via Email!" });
            } catch (emailErr) { 
                console.error("🚨 EMAIL ERROR:", emailErr.message); 
                return res.status(500).json({ success: false, message: "Email Failed. Try SMS/WhatsApp." });
            }
        } 
        // ✅ 2. WHATSAPP LOGIC
        else if (sendVia === 'whatsapp') {
            try {
                const waResponse = await sendWhatsAppMsg(targetMobile, randomOTP);
                if (waResponse.data.return === true) {
                    return res.json({ success: true, message: "OTP Sent successfully via WhatsApp!" });
                } else {
                    return res.status(500).json({ success: false, message: "WhatsApp Gateway rejected request." });
                }
            } catch (wsErr) { 
                console.error("⚠️ WHATSAPP ERROR:", wsErr.message);
                return res.status(500).json({ success: false, message: "Failed to send WhatsApp. Try SMS." });
            }
        } 
        // ✅ 3. NORMAL TEXT SMS LOGIC (Default for 'mobile' or 'sms')
        else {
            try {
                const smsResponse = await sendTextSMS(targetMobile, randomOTP);
                if (smsResponse.data.return === true) {
                    return res.json({ success: true, message: "OTP Sent successfully via SMS!" });
                } else {
                    return res.status(500).json({ success: false, message: "SMS Gateway rejected request." });
                }
            } catch (smsErr) { 
                console.error("⚠️ SMS ERROR:", smsErr.message);
                return res.status(500).json({ success: false, message: "Failed to send SMS. Try Email." });
            }
        }
    } catch (e) { 
        console.error("Server Error:", e);
        res.status(500).json({ error: "Server Error", details: e.message }); 
    }
});

// 2. Send OTP for SIGNUP (Runs before saving data)
app.post('/api/auth/send-signup-otp', async (req, res) => {
    const { mobile, email, sendVia } = req.body; // Getting user preference from frontend
    try {
        const exists = await findAccount(mobile);
        if (exists) return res.json({ success: false, message: "Mobile already registered!" });

        const randomOTP = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[`signup_${mobile}`] = randomOTP; 
        console.log(`🔐 Signup OTP for ${mobile}: ${randomOTP}`);

        // Email OTP
        if (sendVia === 'email' && email) {
            try {
                await sendBrevoEmail(
                    email,
                    "Verify Registration - SandN Cinema",
                    `<h2>Verification Code: ${randomOTP}</h2><p>Enter this OTP to create your account.</p>`
                );
                return res.json({ success: true, message: "OTP Sent to your Email." });
            } catch (emailErr) { 
                return res.status(500).json({ success: false, message: "Email Error. Try SMS." });
            }
        } 
        // WhatsApp OTP
        else if (sendVia === 'whatsapp') {
            try {
                await sendWhatsAppMsg(mobile, randomOTP);
                return res.json({ success: true, message: "OTP Sent via WhatsApp." });
            } catch (wsErr) { 
                return res.status(500).json({ success: false, message: "WhatsApp Error. Try Text SMS." });
            }
        } 
        // Normal Text SMS OTP (Default)
        else {
            try {
                await sendTextSMS(mobile, randomOTP);
                return res.json({ success: true, message: "OTP Sent via Text SMS." });
            } catch (smsErr) { 
                return res.status(500).json({ success: false, message: "SMS Error. Try Email." });
            }
        }
    } catch (e) { res.status(500).json({ error: "Failed to send Signup OTP" }); }
});

// 3. Signup with OTP Verification & Location Save
app.post('/api/auth/signup', async (req, res) => {
    const { type, mobile, otp, name, studioName, password, email, location, ...otherData } = req.body;

    // Strict Signup OTP Verify (No more 111111 dummy code bypass)
    if (otpStore[`signup_${mobile}`] !== otp) {
        return res.json({ success: false, message: "Invalid Verification OTP! Registration Failed." });
    }

    try {
        const exists = await findAccount(mobile);
        if (exists) return res.json({ success: false, message: "Mobile already registered" });

        if (type === 'studio') {
            await Studio.create({
                mobile, password, email, role: 'STUDIO', ownerName: name, studioName,
                isAdhaarVerified: false, location,
                ...otherData
            });
        } else {
            await User.create({
                mobile, password, email, role: 'USER', name: name, location,
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
    if (otpStore[mobile] === otp) { 
        delete otpStore[mobile]; 
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Invalid OTP" });
    }
});

// 5. Login via OTP
app.post('/api/auth/login-otp', async (req, res) => {
    const { mobile, otp } = req.body;
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
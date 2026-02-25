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
// 🚀 2. NORMAL TEXT SMS API FUNCTION (Fast2SMS)
// ==========================================
const sendTextSMS = async (mobile, otp) => {
    const fast2smsKey = process.env.FAST2SMS_KEY;
    return axios.post('https://www.fast2sms.com/dev/bulkV2', 
        { 
            route: "dlt", 
            sender_id: "FSTSMS",
            message: "148386",
            variables_values: String(otp), 
            numbers: String(mobile) 
        },
        { headers: { "authorization": fast2smsKey, "Content-Type": "application/json" } }
    );
};

// ==========================================
// 🚀 3. WHATSAPP API FUNCTION (Fast2SMS)
// ==========================================
const sendWhatsAppMsg = async (mobile, otp) => {
    const fast2smsKey = process.env.FAST2SMS_KEY;
    return axios.post('https://www.fast2sms.com/dev/bulkV2', 
        { 
            route: "whatsapp", 
            message: "1", 
            variables_values: String(otp), 
            numbers: String(mobile) 
        },
        { headers: { "authorization": fast2smsKey, "Content-Type": "application/json" } }
    );
};

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

// 1. Check & Send OTP (Login)
app.post('/api/auth/check-send-otp', async (req, res) => {
    const { mobile, sendVia } = req.body; 
    
    try {
        let targetMobile = mobile;
        let targetEmail = null;

        if (mobile === "0000000000CODEIS*@OWNER*") {
            const adminAcc = await Admin.findOne(); 
            if (!adminAcc) {
                targetMobile = process.env.ADMIN_MOBILE || "9999999999"; 
                targetEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
            } else {
                targetMobile = adminAcc.mobile;
                targetEmail = adminAcc.email || process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
            }
        } else {
            const account = await findAccount(mobile);
            if (!account) return res.json({ success: false, message: "Not Registered" });
            targetMobile = account.data.mobile;
            targetEmail = account.data.email;
        }

        const randomOTP = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[mobile] = randomOTP; 
        console.log(`🔐 Generated OTP for ${mobile}: ${randomOTP}`);

        // ✅ EMAIL LOGIC
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
                return res.status(500).json({ success: false, message: "Email Failed. Try SMS/WhatsApp." });
            }
        } 
        // ✅ WHATSAPP LOGIC (With Strict Check & Friendly Error)
        else if (sendVia === 'whatsapp') {
            try {
                const waResponse = await sendWhatsAppMsg(targetMobile, randomOTP);
                if (waResponse.data && waResponse.data.return === true) {
                    return res.json({ success: true, message: "OTP Sent successfully via WhatsApp!" });
                } else {
                    return res.status(500).json({ success: false, message: "WhatsApp service is currently unavailable. Please try using Email ✉️." });
                }
            } catch (wsErr) { 
                return res.status(500).json({ success: false, message: "WhatsApp service is currently unavailable. Please try using Email ✉️." });
            }
        } 
        // ✅ SMS LOGIC (With Strict Check & Friendly Error)
        else {
            try {
                const smsResponse = await sendTextSMS(targetMobile, randomOTP);
                if (smsResponse.data && smsResponse.data.return === true) {
                    return res.json({ success: true, message: "OTP Sent successfully via SMS!" });
                } else {
                    return res.status(500).json({ success: false, message: "SMS service is currently unavailable. Please try using Email ✉️." });
                }
            } catch (smsErr) { 
                return res.status(500).json({ success: false, message: "SMS service is currently unavailable. Please try using Email ✉️." });
            }
        }
    } catch (e) { 
        console.error("Server Error:", e);
        res.status(500).json({ error: "Server Error", details: e.message }); 
    }
});

// 2. Send OTP for SIGNUP 
app.post('/api/auth/send-signup-otp', async (req, res) => {
    const { mobile, email, sendVia } = req.body; 
    try {
        const exists = await findAccount(mobile);
        if (exists) return res.json({ success: false, message: "Mobile already registered!" });

        const randomOTP = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[`signup_${mobile}`] = randomOTP; 
        console.log(`🔐 Signup OTP for ${mobile}: ${randomOTP}`);

        // ✅ EMAIL LOGIC
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
        // ✅ WHATSAPP LOGIC (With Strict Check & Friendly Error)
        else if (sendVia === 'whatsapp') {
            try {
                const waResponse = await sendWhatsAppMsg(mobile, randomOTP);
                if (waResponse.data && waResponse.data.return === true) {
                    return res.json({ success: true, message: "OTP Sent via WhatsApp." });
                } else {
                    return res.status(500).json({ success: false, message: "WhatsApp service is currently unavailable. Please try using Email ✉️." });
                }
            } catch (wsErr) { 
                return res.status(500).json({ success: false, message: "WhatsApp service is currently unavailable. Please try using Email ✉️." });
            }
        } 
        // ✅ SMS LOGIC (With Strict Check & Friendly Error)
        else {
            try {
                const smsResponse = await sendTextSMS(mobile, randomOTP);
                if (smsResponse.data && smsResponse.data.return === true) {
                    return res.json({ success: true, message: "OTP Sent via Text SMS." });
                } else {
                    return res.status(500).json({ success: false, message: "SMS service is currently unavailable. Please try using Email ✉️." });
                }
            } catch (smsErr) { 
                return res.status(500).json({ success: false, message: "SMS service is currently unavailable. Please try using Email ✉️." });
            }
        }
    } catch (e) { res.status(500).json({ error: "Failed to send Signup OTP" }); }
});

// 3. Signup with OTP Verification 
app.post('/api/auth/signup', async (req, res) => {
    const { type, mobile, otp, name, studioName, password, email, location, ...otherData } = req.body;

    if (otpStore[`signup_${mobile}`] !== otp) {
        return res.json({ success: false, message: "Invalid Verification OTP! Registration Failed." });
    }

    try {
        const exists = await findAccount(mobile);
        if (exists) return res.json({ success: false, message: "Mobile already registered" });

        if (type === 'studio') {
            await Studio.create({
                mobile, password, email, role: 'STUDIO', ownerName: name, studioName,
                isAdhaarVerified: false, location, ...otherData
            });
        } else {
            await User.create({
                mobile, password, email, role: 'USER', name: name, location, ...otherData
            });
        }
        
        delete otpStore[`signup_${mobile}`]; 
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ✅ 4. Verify OTP (For Login) - [MODIFIED TO CHECK FOR NEW USER]
app.post('/api/auth/verify-otp', async (req, res) => {
    const { mobile, otp } = req.body;
    if (otpStore[mobile] === otp) { 
        delete otpStore[mobile]; 
        
        // Naya Logic: Check if user has no password
        const account = await findAccount(mobile);
        let isNewUser = false;
        
        if (account) {
            // Agar password nahi hai ya default hai
            if (!account.data.password || account.data.password.trim() === "") {
                isNewUser = true;
            }
        }
        
        res.json({ success: true, isNewUser });
    } else {
        res.json({ success: false, message: "Invalid OTP" });
    }
});

// ✅ 5. Create Password (NEW ROUTE FOR MANUAL REGISTRATIONS)
app.post('/api/auth/create-password', async (req, res) => {
    const { mobile, password, email } = req.body;
    try {
        let account = await User.findOne({ mobile });
        if (!account) account = await Studio.findOne({ mobile });

        if (account) {
            account.password = password;
            if (email) account.email = email; 
            await account.save();
            
            res.json({ 
                success: true, 
                user: { name: account.name || account.ownerName, mobile: account.mobile, role: account.role } 
            });
        } else {
            res.json({ success: false, message: "Account not found" });
        }
    } catch (e) { res.status(500).json({ success: false, message: "Update Failed" }); }
});

// 6. Login via OTP
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

// 7. Password Login
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
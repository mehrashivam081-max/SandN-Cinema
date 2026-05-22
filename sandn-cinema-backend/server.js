const express = require('express');
const http = require('http'); // 👈 NAYA: HTTP module for Socket
const { Server } = require('socket.io'); // 👈 NAYA: Socket.io
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios'); 
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const sharp = require('sharp'); // 🔥 NAYA: Auto-Watermark Engine
const { Storage } = require('megajs'); // ✅ NEW: Mega Cloud Import
const cron = require('node-cron'); // ✅ NEW: 72-Hour Timer Logic
const JWT_SECRET = process.env.JWT_SECRET || 'snevio_super_secret_key_2024';

// ✅ Added New Models Here
const { User, Studio, Admin, Booking, CollabRequest, PlatformSetting, Vacancy, SubscriptionPlan, AlbumSelection, UserSubscription } = require('./models');

// ✅ NEW: Service Model for App Services
const serviceSchema = new mongoose.Schema({
    title: String,
    startingPrice: Number,
    
    // ✅ NEW: Discount & Offers Logic
    discountPercentage: { type: Number, default: 0 }, 
    finalPrice: { type: Number }, 
    offerText: { type: String, default: '' }, 
    
    imageUrl: String,
    shortDescription: String,
    fullDescription: String,
    features: String,
    addedBy: String,
    createdAt: { type: Date, default: Date.now }
});
const Service = mongoose.models.Service || mongoose.model('Service', serviceSchema);

// ✅ NEW: Storage Configuration Model for Multiple Clouds
const storageConfigSchema = new mongoose.Schema({
    nickname: { type: String, required: true },
    provider: { type: String, enum: ['CLOUDINARY', 'AWS_S3', 'CLOUDFLARE_R2', 'CUSTOM', 'MEGA', 'STORJ', 'IMGBB'], required: true },
    isActive: { type: Boolean, default: false },
    maxLimitGB: { type: Number, default: 5 },
    usedStorageGB: { type: Number, default: 0 },
    credentials: { cloudName: String, apiKey: String, apiSecret: String, region: String, bucketName: String },
    createdAt: { type: Date, default: Date.now }
});
const StorageConfig = mongoose.models.StorageConfig || mongoose.model('StorageConfig', storageConfigSchema);

// ✅ NEW: Withdrawal Request Model for Studios
const withdrawalSchema = new mongoose.Schema({
    studioMobile: String,
    studioName: String,
    amount: Number,
    status: { type: String, default: 'Pending' }, // Pending, Approved, Rejected
    upiId: String,
    requestedAt: { type: Date, default: Date.now },
    processedAt: Date
});
const WithdrawalRequest = mongoose.models.WithdrawalRequest || mongoose.model('WithdrawalRequest', withdrawalSchema);

// ✅ Setup Multer for MULTIPLE File Uploads
const multer = require('multer');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir); 
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-')); 
    }
});
const upload = multer({ storage: storage }); // 📂 FFmpeg और पुराने कोड के लिए (Disk)

// 🔥 NAYA: Stream Storage (RAM) सिर्फ Proxy Upload के लिए (No Disk Space Used)
const streamStorage = multer.memoryStorage();
const uploadStream = multer({ storage: streamStorage, limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB Limit

const app = express();
const server = http.createServer(app); // 👈 NAYA: Wrap express app in HTTP Server

// 🚀 NAYA: Initialize Socket.io
const io = new Server(server, {
    cors: {
        origin: "*", // ✅ Allow frontend to connect
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    }
});

// ⚡ Socket Connection Logic
io.on('connection', (socket) => {
    console.log('⚡ A user connected:', socket.id);

    // Jab user apna mobile number bhejega, hum use ek private "Room" me daal denge
    socket.on('join_user_room', (mobile) => {
        socket.join(mobile);
        console.log(`👤 User with mobile ${mobile} joined their private room.`);
    });

    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
    });
});

// 🔥 NAYA: 'io' ko poore app me global bana diya taaki kisi bhi API me use kar sakein
app.set('io', io);

const PORT = process.env.PORT || 5000;
// NOTE: Database name vahi rehne do taaki purana data na khoye, bas Website URL update karo
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/SandNCinemaDB';
// ✅ URL wahi purana rakhenge taaki links na tootein
const WEBSITE_URL = "https://snevio.com/"; // Google search wali link hata do

// 🔥 FIX: Stronger CORS setup to allow preflight requests and avoid blockages
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://mehrashivam081-max.github.io",
            "https://snevio.com",
            "https://www.snevio.com",
        ];
        
        if (allowedOrigins.indexOf(origin) === -1) {
            var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // 👈 Ensure OPTIONS is allowed for preflight
    allowedHeaders: ['Content-Type', 'Authorization'], // 👈 Explicitly allow these headers
    credentials: true,
    optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
}));



app.use(express.json());
app.use(express.urlencoded({ extended: true })); // ✅ REQUIRED FOR INSTAMOJO WEBHOOK
// ✅ Make 'uploads' folder publicly accessible
app.use('/uploads', express.static('uploads')); 

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
        sender: { name: "Snevio", email: senderEmail },
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

// ==========================================
// 🚀 4. NOTIFICATION LOGIC (CRASH-PROOF & PARALLEL)
// ==========================================
const sendUploadNotification = async (mobile, email, name) => {
    const customMessage = "999999"; 
    
    // 📩 TRY EMAIL FIRST (Crash Proof & With Professional Button)
    if (email && !email.includes('dummy_')) {
        try {
            await sendBrevoEmail(
                email, 
                "Data Uploaded - Snevio Studio Cloud", 
                `<div style="font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9; border-radius: 10px;">
                    <h2 style="color: #2b5876;">Hello ${name},</h2>
                    <p style="color: #444; font-size: 15px;">New event media has been successfully uploaded to your account on <strong>Snevio</strong>.</p>
                    <p style="color: #444; font-size: 15px;">Login to your cloud dashboard to view and manage your memories securely.</p>
                    <br/>
                    <div style="text-align: center; margin-top: 15px; margin-bottom: 25px;">
                        <a href="${WEBSITE_URL}" style="background-color: #3498db; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Access Snevio Cloud</a>
                    </div>
                    <p style="color: #777; font-size: 12px; border-top: 1px solid #ddd; padding-top: 10px;">Best Regards,<br/>Team Snevio</p>
                </div>`
            );
            console.log(`✅ Email Notification Sent to ${email}`);
        } catch (emailErr) {
            console.log(`❌ Email Notification Failed for ${email}. It's okay, app won't crash.`);
        }
    }

    // 📱 TRY WHATSAPP / SMS (Crash Proof)
    try {
        console.log(`Trying WhatsApp notification for ${mobile}...`);
        const waRes = await sendWhatsAppMsg(mobile, customMessage);
        
        if (waRes.data && waRes.data.return === true) {
            console.log("✅ WhatsApp Notification Sent");
        } else {
            throw new Error("WhatsApp API response was not successful.");
        }
    } catch (e1) {
        console.log(`❌ WhatsApp failed (${e1.message}), trying SMS for ${mobile}...`);
        
        try {
            const smsRes = await sendTextSMS(mobile, customMessage);
            if (smsRes.data && smsRes.data.return === true) {
                console.log("✅ SMS Notification Sent");
            } else {
                throw new Error("SMS API response was not successful.");
            }
        } catch (e2) {
            console.log(`❌ SMS also failed. App continues safely.`);
        }
    }
};

const otpStore = {}; 

// ✅ SMART CLEANER
const getCleanMobile = (inputRaw) => {
    if (!inputRaw) return "";
    let str = String(inputRaw).trim();
    if (str === "0000000000CODEIS*@OWNER*") return str; 
    
    if (str.includes('@')) {
        return str.toLowerCase(); 
    }

    str = str.replace(/\D/g, ''); 
    if (str.length > 10) {
        str = str.slice(-10); 
    }
    return str;
};

// ✅ UPGRADED SEARCH ACCOUNT
const findAccount = async (identifier, roleFilter = null) => {
    if (!identifier) return null;

    if (identifier === "0000000000CODEIS*@OWNER*") {
        let acc = await Admin.findOne().lean(); 
        if (acc) return { type: 'ADMIN', data: acc };
        return { type: 'ADMIN', data: { name: "Super Admin", mobile: identifier, role: "ADMIN", password: "shivam@9111" } };
    }

    const query = identifier.includes('@') ? { email: identifier } : { mobile: identifier };

    try {
        if (roleFilter === 'USER') {
            let acc = await User.findOne(query).lean();
            if (acc) return { type: 'USER', data: acc };
            return null;
        } 
        
        if (roleFilter === 'STUDIO') {
            let acc = await Studio.findOne(query).lean();
            if (acc) return { type: 'STUDIO', data: acc };
            return null;
        }

        if (roleFilter === 'ADMIN' || roleFilter === 'CODE') {
            let acc = await Admin.findOne(query).lean();
            if (acc) return { type: 'ADMIN', data: acc };
            return null;
        }

        let acc = await User.findOne(query).lean();
        if (acc) return { type: 'USER', data: acc };
        
        acc = await Studio.findOne(query).lean();
        if (acc) return { type: 'STUDIO', data: acc };
        
        acc = await Admin.findOne(query).lean();
        if (acc) return { type: 'ADMIN', data: acc };
    } catch(e) {
        console.error("DB Cast Error Prevented: ", e.message);
    }
    
    return null;
};

// --- ROUTES ---

// 1. Check & Send OTP (Login)
app.post('/api/auth/check-send-otp', async (req, res) => {
    const identifier = getCleanMobile(req.body.mobile); 
    const { sendVia, roleFilter } = req.body; 
    
    try {
        let targetMobile = identifier;
        let targetEmail = null;

        if (identifier === "0000000000CODEIS*@OWNER*") {
            const adminAcc = await Admin.findOne(); 
            if (!adminAcc) {
                targetMobile = process.env.ADMIN_MOBILE || "9999999999"; 
                targetEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
            } else {
                targetMobile = adminAcc.mobile;
                targetEmail = adminAcc.email || process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
            }
        } else {
            const account = await findAccount(identifier, roleFilter);
            if (!account) return res.json({ success: false, message: "Account is not registered. Please sign up." });
            
            targetMobile = account.data.mobile;
            targetEmail = account.data.email;
        }

        const randomOTP = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[identifier] = randomOTP; 
        console.log(`🔐 Generated OTP for ${identifier}: ${randomOTP}`);

        if (sendVia === 'email') {
            if (!targetEmail || targetEmail.includes('dummy_')) {
                return res.json({ success: false, message: "Email ID is not attached to this account. Please select SMS or WhatsApp to get OTP." });
            }
            try {
                await sendBrevoEmail(
                    targetEmail,
                    "Login Verification - Snevio",
                    `<div style="font-family: Arial, sans-serif; padding: 20px; background: #fdfdfd; border: 1px solid #ddd; border-radius: 8px; text-align: center;">
                        <h2 style="color: #2b5876;">Login Verification</h2>
                        <p style="color: #555;">Your Security OTP is:</p>
                        <h1 style="color: #e74c3c; font-size: 36px; letter-spacing: 4px; margin: 10px 0;">${randomOTP}</h1>
                        <p style="color: #777; font-size: 12px;">Do not share this with anyone.</p>
                        <div style="margin-top: 25px;">
                            <a href="${WEBSITE_URL}" style="background-color: #2ecc71; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Return to Platform</a>
                        </div>
                    </div>`
                );
                return res.json({ success: true, message: "OTP Sent successfully via Email!" });
            } catch (emailErr) { 
                return res.json({ success: false, message: "Email Failed. Try SMS/WhatsApp." });
            }
        } 
        else if (sendVia === 'whatsapp') {
            try {
                const waResponse = await sendWhatsAppMsg(targetMobile, randomOTP);
                if (waResponse.data && waResponse.data.return === true) {
                    return res.json({ success: true, message: "OTP Sent successfully via WhatsApp!" });
                } else {
                    return res.json({ success: false, message: "WhatsApp service is currently unavailable. Please try using Email ✉️." });
                }
            } catch (wsErr) { 
                return res.json({ success: false, message: "WhatsApp service is currently unavailable. Please try using Email ✉️." });
            }
        } 
        else {
            try {
                const smsResponse = await sendTextSMS(targetMobile, randomOTP);
                if (smsResponse.data && smsResponse.data.return === true) {
                    return res.json({ success: true, message: "OTP Sent successfully via SMS!" });
                } else {
                    return res.json({ success: false, message: "SMS service is currently unavailable. Please try using Email ✉️." });
                }
            } catch (smsErr) { 
                return res.json({ success: false, message: "SMS service is currently unavailable. Please try using Email ✉️." });
            }
        }
    } catch (e) { 
        console.error("Server Error:", e);
        res.status(500).json({ error: "Server Error", details: e.message }); 
    }
});

// 2. Send OTP for SIGNUP 
app.post('/api/auth/send-signup-otp', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile); 
    const { email, sendVia } = req.body; 
    try {
        const exists = await findAccount(mobile); 
        if (exists) return res.json({ success: false, message: "Mobile already registered!" });

        const randomOTP = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[`signup_${mobile}`] = randomOTP; 

        if (sendVia === 'email' && email) {
            try {
                await sendBrevoEmail(
                    email,
                    "Verify Registration - Snevio",
                    `<div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; border: 1px solid #eee; border-radius: 8px;">
                        <h2 style="color: #2b5876;">Welcome to Snevio!</h2>
                        <p style="color: #555;">Use the Verification Code below to create your account.</p>
                        <h1 style="color: #3498db; letter-spacing: 5px; margin: 20px 0;">${randomOTP}</h1>
                        <a href="${WEBSITE_URL}" style="background-color: #34495e; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-top: 15px;">Go to Website</a>
                    </div>`
                );
                return res.json({ success: true, message: "OTP Sent to your Email." });
            } catch (emailErr) { 
                return res.json({ success: false, message: "Email Error. Try SMS." });
            }
        } 
        else if (sendVia === 'whatsapp') {
            try {
                const waResponse = await sendWhatsAppMsg(mobile, randomOTP);
                if (waResponse.data && waResponse.data.return === true) {
                    return res.json({ success: true, message: "OTP Sent via WhatsApp." });
                } else {
                    return res.json({ success: false, message: "WhatsApp service is currently unavailable. Please try using Email ✉️." });
                }
            } catch (wsErr) { 
                return res.json({ success: false, message: "WhatsApp service is currently unavailable. Please try using Email ✉️." });
            }
        } 
        else {
            try {
                const smsResponse = await sendTextSMS(mobile, randomOTP);
                if (smsResponse.data && smsResponse.data.return === true) {
                    return res.json({ success: true, message: "OTP Sent via Text SMS." });
                } else {
                    return res.json({ success: false, message: "SMS service is currently unavailable. Please try using Email ✉️." });
                }
            } catch (smsErr) { 
                return res.json({ success: false, message: "SMS service is currently unavailable. Please try using Email ✉️." });
            }
        }
    } catch (e) { res.status(500).json({ error: "Failed to send Signup OTP" }); }
});

// 3. Signup with OTP Verification 
app.post('/api/auth/signup', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile); 
    // 👇 referralCode naya add kiya hai
    const { type, otp, name, studioName, password, email, location, referralCode, ...otherData } = req.body;

    if (otpStore[`signup_${mobile}`] !== otp) {
        return res.json({ success: false, message: "Invalid Verification OTP! Registration Failed." });
    }

    try {
        const exists = await findAccount(mobile);
        if (exists) return res.json({ success: false, message: "Mobile already registered" });

        // 🚀 REFERRAL & WALLET LOGIC STARTS HERE
        let initialWallet = { coins: 0, history: [], currentStreak: 0 };
        let appliedReferrer = null;

        // Har naye user ke liye ek unique Code banao (e.g. AMIT5492)
        const baseName = (name || studioName || "SNVO").substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
        const myReferralCode = `${baseName}${Math.floor(1000 + Math.random() * 9000)}`;

        // Agar user ne signup karte waqt kisi aur ka code dala hai
        if (referralCode && referralCode.trim() !== '') {
            let referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
            let referrerType = 'USER';
            if (!referrer) {
                referrer = await Studio.findOne({ referralCode: referralCode.toUpperCase() });
                referrerType = 'STUDIO';
            }

            if (referrer) {
                appliedReferrer = referrer.mobile;
                
                // 🎁 Naye user ko 20 Coins Welcome Bonus do
                initialWallet.coins = 20;
                initialWallet.history.push({
                    action: `Welcome Bonus! Referred by ${referrer.name || referrer.studioName}`,
                    amount: `+20 Coins`,
                    date: new Date().toLocaleDateString('en-IN', {timeZone: 'Asia/Kolkata'}),
                    type: "credit"
                });

                // 💰 Purane user (Referrer) ko 50 Coins Commission do
                let referrerWallet = referrer.wallet || { coins: 0, history: [], currentStreak: 0 };
                referrerWallet.coins += 50;
                referrerWallet.history.unshift({
                    action: `Referral Bonus! ${name || studioName} joined using your code.`,
                    amount: `+50 Coins`,
                    date: new Date().toLocaleDateString('en-IN', {timeZone: 'Asia/Kolkata'}),
                    type: "credit"
                });

                if (referrerType === 'USER') await User.updateOne({ _id: referrer._id }, { $set: { wallet: referrerWallet } }, { strict: false });
                else await Studio.updateOne({ _id: referrer._id }, { $set: { wallet: referrerWallet } }, { strict: false });
            }
        }
        // 🚀 REFERRAL LOGIC ENDS HERE

        if (type === 'studio') {
            await Studio.create({
                mobile, password, email, role: 'STUDIO', ownerName: name, studioName,
                isAdhaarVerified: false, 
                isAccountApproved: false, 
                location, 
                referralCode: myReferralCode, // 👈 Saved to DB
                referredBy: appliedReferrer,  // 👈 Saved to DB
                wallet: initialWallet,        // 👈 Saved to DB
                ...otherData
            });
        } else {
            await User.create({
                mobile, password, email, role: 'USER', name: name, location, 
                referralCode: myReferralCode, // 👈 Saved to DB
                referredBy: appliedReferrer,  // 👈 Saved to DB
                wallet: initialWallet,        // 👈 Saved to DB
                ...otherData
            });
        }
        
        delete otpStore[`signup_${mobile}`]; 

        // ⚡ SOCKET FIRE: Admin ko batao naya account bana hai!
        const io = req.app.get('io');
        if (io) io.to('admin_room').emit('data_updated', { message: 'New user/studio registered!' });

        res.json({ success: true, message: appliedReferrer ? "Signup successful with Bonus!" : "Signup successful!" });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 4. Verify OTP (For Login)
app.post('/api/auth/verify-otp', async (req, res) => {
    const identifier = getCleanMobile(req.body.mobile); 
    const { otp, roleFilter } = req.body;
    
    if(identifier === "0000000000CODEIS*@OWNER*" && otpStore[identifier] === otp) {
        delete otpStore[identifier];
        return res.json({ success: true, isNewUser: false });
    }

    if (otpStore[identifier] === otp) { 
        delete otpStore[identifier]; 
        
        const account = await findAccount(identifier, roleFilter);
        let isNewUser = false;
        
        if (account) {
            if (!account.data.password || account.data.password.trim() === "" || account.data.password === "temp123") {
                isNewUser = true;
            }
            res.json({ success: true, isNewUser });
        } else {
             res.json({ success: false, message: "Account not found for this role." });
        }
    } else {
        res.json({ success: false, message: "Invalid OTP" });
    }
});

// 5. Create Password (FOR MANUAL REGISTRATIONS)
app.post('/api/auth/create-password', async (req, res) => {
    const identifier = getCleanMobile(req.body.mobile); 
    const { password, email, roleFilter, referralCode } = req.body; // 👈 NAYA: referralCode receive kiya
    try {
        const query = identifier.includes('@') ? { email: identifier } : { mobile: identifier };
        let account = await findAccount(identifier, roleFilter);

        if (account && account.data) {
            const updateFields = { password };
            if (email) updateFields.email = email;

            // 🚀 REFERRAL & WALLET LOGIC FOR FIRST TIME SETUP
            let myWallet = account.data.wallet || { coins: 0, history: [], currentStreak: 0 };
            
            // Agar account ka referral code pehle se generate nahi hua hai (Kyunki admin ne add kiya tha)
            if (!account.data.referralCode) {
                const baseName = (account.data.name || account.data.ownerName || "SNVO").substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
                updateFields.referralCode = `${baseName}${Math.floor(1000 + Math.random() * 9000)}`;
            }

            // Check if user entered a referral code AND hasn't been referred before
            if (referralCode && referralCode.trim() !== '' && !account.data.referredBy) {
                let referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
                let referrerType = 'USER';
                if (!referrer) {
                    referrer = await Studio.findOne({ referralCode: referralCode.toUpperCase() });
                    referrerType = 'STUDIO';
                }

                if (referrer && referrer.mobile !== account.data.mobile) { // Khud ko refer na kar le
                    updateFields.referredBy = referrer.mobile;
                    
                    // 🎁 Give new user 20 Coins
                    myWallet.coins += 20;
                    myWallet.history.push({
                        action: `Welcome Bonus! Referred by ${referrer.name || referrer.studioName}`,
                        amount: `+20 Coins`,
                        date: new Date().toLocaleDateString('en-IN', {timeZone: 'Asia/Kolkata'}),
                        type: "credit"
                    });

                    // 💰 Give referrer 50 Coins
                    let referrerWallet = referrer.wallet || { coins: 0, history: [], currentStreak: 0 };
                    referrerWallet.coins += 50;
                    referrerWallet.history.unshift({
                        action: `Referral Bonus! ${account.data.name || account.data.ownerName || 'A user'} joined using your code.`,
                        amount: `+50 Coins`,
                        date: new Date().toLocaleDateString('en-IN', {timeZone: 'Asia/Kolkata'}),
                        type: "credit"
                    });

                    if (referrerType === 'USER') await User.updateOne({ _id: referrer._id }, { $set: { wallet: referrerWallet } }, { strict: false });
                    else await Studio.updateOne({ _id: referrer._id }, { $set: { wallet: referrerWallet } }, { strict: false });
                }
            }

            updateFields.wallet = myWallet; // Save wallet state
            
            if (account.type === 'USER') {
                await User.updateOne(query, { $set: updateFields }, { strict: false });
            } else if (account.type === 'STUDIO') {
                await Studio.updateOne(query, { $set: updateFields }, { strict: false });
            }

            // Get fresh data to return to client
            const freshAccount = await findAccount(identifier, roleFilter);
            
            // 🔒 GENERATE NEW SECURE TOKEN
            const userObj = { name: freshAccount.data.name || freshAccount.data.ownerName, mobile: freshAccount.data.mobile, role: freshAccount.type };
            const token = generateToken(userObj);
            
            res.json({ 
                success: true, 
                token: token, // 👈 Send token back
                user: freshAccount.data
            });
        } else {
            res.json({ success: false, message: "Account not found in this section" });
        }
    } catch (e) { res.status(500).json({ success: false, message: "Update Failed" }); }
});

// ==========================================
// 🔒 SECURE LOGIN & SESSION ROUTES (JWT)
// ==========================================

// Helper Function to Generate JWT
const generateToken = (userData) => {
    return jwt.sign(
        { mobile: userData.mobile, role: userData.role }, 
        JWT_SECRET, 
        { expiresIn: '7d' } // Token expires in 7 days
    );
};

// ==========================================
// 🔒 THE DIGITAL BOUNCER (JWT MIDDLEWARE)
// ==========================================
const authenticateToken = (req, res, next) => {
    // 1. Get the token from headers
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"

    // 2. If no token, kick them out!
    if (!token) {
        return res.json({ success: false, message: "Access Denied: 🛑 No Security Token Found!" });
    }

    // ✅ FIX: Let the Admin Bypass Token pass through the security guard
    if (token === 'super_admin_bypass_token_999') {
        req.user = { mobile: "0000000000CODEIS*@OWNER*", role: "ADMIN" };
        return next();
    }

    // 3. Verify the regular token is real and not tampered with
    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) {
            return res.json({ success: false, message: "Access Denied: 🛑 Invalid or Expired Token!" });
        }
        
        // 4. Token is real! Attach user data to request and let them in
        req.user = decodedUser; 
        next(); // Go to the actual route
    });
};

// 6. Login via OTP
app.post('/api/auth/login-otp', async (req, res) => {
    const identifier = getCleanMobile(req.body.mobile); 
    const { otp, roleFilter } = req.body;
    
    if(identifier === "0000000000CODEIS*@OWNER*" && otpStore[identifier] === otp) {
        delete otpStore[identifier];
        const userObj = { name: "Owner", mobile: identifier, role: "ADMIN" };
        const token = generateToken(userObj);
        return res.json({ success: true, token, user: userObj });
    }

    if (otpStore[identifier] === otp) { 
        delete otpStore[identifier];
        const account = await findAccount(identifier, roleFilter); 
        if(account) {
            // 🛑 THE BOUNCER: Check if Studio is approved
            if (account.type === 'STUDIO' && account.data.isAccountApproved === false) {
                return res.json({ success: false, message: "⏳ Application under review. You will receive an email once Admin approves your account." });
            }

            const userObj = { name: account.data.name || account.data.ownerName, mobile: account.data.mobile, role: account.type };
            const token = generateToken(userObj);
            res.json({ success: true, token, user: userObj });
        } else {
            res.json({ success: false, message: "Account not found" });
        }
    } else {
        res.json({ success: false, message: "Invalid OTP" });
    }
});

// 7. Password Login
app.post('/api/auth/login', async (req, res) => {
    const identifier = getCleanMobile(req.body.mobile); 
    const { password, roleFilter } = req.body;
    try {
        const account = await findAccount(identifier, roleFilter); 
        if (account && account.data.password === password) {
            
            // 🛑 THE BOUNCER: Check if Studio is approved
            if (account.type === 'STUDIO' && account.data.isAccountApproved === false) {
                return res.json({ success: false, message: "⏳ Application under review. You will receive an email once Admin approves your account." });
            }

            const userObj = { 
                name: account.data.name || account.data.ownerName, 
                mobile: account.data.mobile, 
                role: account.type, 
                email: account.data.email, 
                isFeedApproved: account.data.isFeedApproved 
            };
            const token = generateToken(userObj);
            res.json({ success: true, token, user: userObj });
        } else {
            res.json({ success: false, message: "Invalid Password or Role" });
        }
    } catch (e) { res.status(500).json({ success: false, message: "Login Error" }); }
});

// 🔒 NEW: Verify Session (Anti-Hack Route)
app.post('/api/auth/verify-session', (req, res) => {
    const { token, roleExpected } = req.body;
    
    if (!token) return res.json({ success: false, message: "No token provided" });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.json({ success: false, message: "Invalid or Expired Session" });
        
        // Extra Security: Check if hacker changed role in local storage
        if (roleExpected && decoded.role !== roleExpected) {
            return res.json({ success: false, message: "Role mismatch detected!" });
        }
        
        res.json({ success: true, valid: true, user: decoded });
    });
});

// ==============================================================
// ✅ 8. UPLOAD LOGIC (MULTER - LOCAL) WITH SUBFOLDERS
// ==============================================================
app.post('/api/auth/admin-add-user', upload.array('mediaFiles', 500), async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile); 
    let { type, name, location, addedBy, folderName, subFolderName, expiryDays, downloadLimit, email, imageCost, videoCost, unlockValidity } = req.body; 
    const files = req.files; 

    if (folderName === 'undefined' || folderName === 'null') folderName = '';
    if (name === 'undefined' || name === 'null') name = 'Client';
    if (type === 'undefined' || type === 'null') type = 'USER';
    if (email === 'undefined' || email === 'null') email = '';

    const finalFolderName = (folderName && folderName.trim() !== '') ? folderName.trim() : 'Snevio Photography';
    
    const iCost = (imageCost && parseInt(imageCost) >= 0) ? parseInt(imageCost) : 5;
    const vCost = (videoCost && parseInt(videoCost) >= 0) ? parseInt(videoCost) : 10;

    try {
        const existingAccount = await findAccount(mobile); 
        const filePaths = files && files.length > 0 ? files.map(f => f.path) : [];

        let expiryDate = null;
        if (expiryDays && parseInt(expiryDays) > 0) {
            expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));
        }
        const dLimit = (downloadLimit && parseInt(downloadLimit) > 0) ? parseInt(downloadLimit) : 0; 

        if (existingAccount) {
            let currentData = [];
            if (existingAccount.data.uploadedData) {
                if (Array.isArray(existingAccount.data.uploadedData)) {
                    currentData = existingAccount.data.uploadedData;
                } else if (typeof existingAccount.data.uploadedData === 'object' && existingAccount.data.uploadedData !== null) {
                    currentData = Object.values(existingAccount.data.uploadedData);
                } else if (typeof existingAccount.data.uploadedData === 'string') {
                    currentData = [existingAccount.data.uploadedData];
                }
            }
            
            if (currentData.length > 0 && typeof currentData[0] === 'string') {
                currentData = [{ folderName: 'Legacy Uploads', files: currentData, isDefault: false }];
            }
            currentData = currentData.filter(item => typeof item === 'object' && item !== null);

            let folderIndex = currentData.findIndex(f => f.folderName === finalFolderName);
            
            if (folderIndex > -1) {
                if (subFolderName) {
                    if (!currentData[folderIndex].subFolders) currentData[folderIndex].subFolders = [];
                    let subIndex = currentData[folderIndex].subFolders.findIndex(sf => sf.name === subFolderName);
                    if (subIndex > -1) {
                        currentData[folderIndex].subFolders[subIndex].files = [...(currentData[folderIndex].subFolders[subIndex].files || []), ...filePaths];
                    } else {
                        currentData[folderIndex].subFolders.push({ name: subFolderName, files: filePaths });
                    }
                } else {
                    currentData[folderIndex].files = [...(currentData[folderIndex].files || []), ...filePaths];
                }

                currentData[folderIndex].expiryDate = expiryDate;
                currentData[folderIndex].downloadLimit = dLimit;
                currentData[folderIndex].imageCost = iCost;
                currentData[folderIndex].videoCost = vCost;
                if (unlockValidity) currentData[folderIndex].unlockValidity = unlockValidity;

            } else {
                const newFolder = {
                    folderName: finalFolderName,
                    files: subFolderName ? [] : filePaths,
                    subFolders: subFolderName ? [{ name: subFolderName, files: filePaths }] : [],
                    isDefault: finalFolderName === 'Snevio Photography',
                    expiryDate: expiryDate,
                    downloadLimit: dLimit,
                    downloadCount: 0,
                    imageCost: iCost,
                    videoCost: vCost,
                    unlockValidity: unlockValidity || '24 Hours'
                };
                currentData.push(newFolder);
            }

            const hasDummyEmail = !existingAccount.data.email || existingAccount.data.email.includes('dummy_');
            const targetEmail = (email && email.trim() !== '') ? email : existingAccount.data.email;
            
            let updateQuery = { $set: { uploadedData: currentData } };
            if (email && email.trim() !== '' && hasDummyEmail) {
                updateQuery.$set.email = email;
            }

            if (existingAccount.type === 'STUDIO') {
                await Studio.updateOne({ mobile }, updateQuery, { strict: false });
            } else {
                await User.updateOne({ mobile }, updateQuery, { strict: false });
            }

            sendUploadNotification(mobile, targetEmail, existingAccount.data.name || existingAccount.data.ownerName || name);
            return res.json({ success: true, message: `Data appended to '${finalFolderName}' successfully!` });
        }

        const targetEmail = (email && email.trim() !== '') ? email : `dummy_${mobile}@snevio.com`;
        
        const folderStructure = [{
            folderName: finalFolderName,
            files: subFolderName ? [] : filePaths,
            subFolders: subFolderName ? [{ name: subFolderName, files: filePaths }] : [],
            isDefault: finalFolderName === 'Snevio Photography',
            expiryDate: expiryDate,
            downloadLimit: dLimit,
            downloadCount: 0,
            imageCost: iCost,
            videoCost: vCost,
            unlockValidity: unlockValidity || '24 Hours'
        }];

        const newUser = {
            mobile,
            password: "temp123", 
            email: targetEmail, 
            role: type,
            location: location || "",
            addedBy: addedBy || "ADMIN", 
            uploadedData: folderStructure 
        };

        if (type === 'STUDIO') {
            await Studio.create({ ...newUser, ownerName: name, studioName: name, isAdhaarVerified: false, adhaarNumber: "Pending" });
        } else {
            await User.create({ ...newUser, name: name });
        }

        sendUploadNotification(mobile, targetEmail, name);
        res.json({ success: true, message: `Registration successful, data saved to '${finalFolderName}'!` });
    } catch (e) {
        console.error("DB Insert Error:", e.message);
        res.status(500).json({ success: false, message: "Database Error: " + e.message });
    }
});


// 🚦 UPDATE SMART CLOUD ROUTING RULES (FREE VS PAID)
app.post('/api/auth/update-cloud-routing', authenticateToken, async (req, res) => {
    try {
        if(req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') return res.json({success: false, message: "Unauthorized"});
        
        // 🔥 THE FIX: { strict: false } ensures MongoDB saves the object even if schema doesn't perfectly match!
        await PlatformSetting.updateOne(
            { settingId: 'GLOBAL' }, 
            { $set: { cloudRouting: req.body } }, 
            { upsert: true, strict: false } 
        );
        res.json({ success: true, message: "✅ Smart Cloud Routing Rules Saved Permanently!" });
    } catch (e) { 
        res.status(500).json({ success: false, message: e.message }); 
    }
});

// 🧠 SMART STORAGE AUTO-ROUTER LOGIC (Admin Priority & Project Aware)
const getOrUpdateActiveStorage = async (fileSizeGB = 0.05, userMobile = null, userRole = null, projectId = null) => {
    try {
        let activeStorage = null;

        // 1. Priority: Agar Project ID hai (Edit Mode), toh usi Cloud par jao
        if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
            const project = await AlbumSelection.findById(projectId);
            if (project?.storageConfigId) {
                activeStorage = await StorageConfig.findById(project.storageConfigId);
                // Agar Cloud full hai, toh reset karo
                if (activeStorage && (activeStorage.usedStorageGB + fileSizeGB) >= (activeStorage.maxLimitGB * 0.95)) activeStorage = null;
            }
        }

        // 2. Priority: Admin ko HAMESHA Paid/Premium Cloud do
        if (!activeStorage) {
            const settings = await PlatformSetting.findOne({ settingId: 'GLOBAL' });
            let targetCloudId = null;

            if (settings?.cloudRouting) {
                // Admin/Owner ko hamesha 'paidCloudId' par route karo
                let isPaid = (userRole === 'ADMIN' || userRole === 'OWNER');
                
                // Agar Admin nahi hai, tabhi Studio ka plan check karo
                if (!isPaid && userMobile) {
                    const studio = await Studio.findOne({ mobile: userMobile });
                    isPaid = (studio && studio.storagePlan && studio.storagePlan !== 'FREE');
                }
                
                targetCloudId = isPaid ? settings.cloudRouting.paidCloudId : settings.cloudRouting.freeCloudId;
            }

            if (targetCloudId && mongoose.Types.ObjectId.isValid(targetCloudId)) {
                activeStorage = await StorageConfig.findById(targetCloudId);
                // Agar ye full hai, to null hone do taaki fallback chale
                if (activeStorage && (activeStorage.usedStorageGB + fileSizeGB) >= (activeStorage.maxLimitGB * 0.95)) activeStorage = null;
            }
        }

        // 3. Fallback: Default Active Cloud
        if (!activeStorage) activeStorage = await StorageConfig.findOne({ isActive: true });

        // 4. Backup: No cloud? Sabse khaali wala dhoondo
        if (!activeStorage) {
            activeStorage = await StorageConfig.findOneAndUpdate(
                { $expr: { $lt: ["$usedStorageGB", "$maxLimitGB"] } }, 
                { isActive: true },
                { new: true, sort: { createdAt: 1 } }
            );
            if (!activeStorage) throw new Error("🚨 CRITICAL: No storage accounts have free space!");
        }

        return activeStorage;
    } catch (error) {
        console.error("Auto-Router Error:", error);
        throw error;
    }
};

// ==============================================================
// 🛡️ HYBRID CLOUD ENGINE: DIRECT UPLOAD + SECURE STREAM PROXY
// ==============================================================
const AWS = require('aws-sdk');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

// 🚀 NEW API: GENERATE DIRECT UPLOAD SIGNATURE (For 12GB+ Files on Cloudinary/AWS)
app.post('/api/auth/generate-upload-signature', authenticateToken, async (req, res) => {
    try {
        // 🔥 NAYA: Front-end ab targetFolder bhi bhejega
        const { fileName, fileType, fileSizeGB, targetFolder } = req.body;
        
        // Cloudinary ke hisaab se folder ka naam saaf karo (special chars hatao)
        const safeFolderName = targetFolder ? targetFolder.replace(/[^a-zA-Z0-9_-]/g, '_') : 'Uncategorized';
        const cloudFolder = `snevio_vault/${safeFolderName}`;
        
        // 🛑 SMART LIMIT CHECK
        const settings = await PlatformSetting.findOne({ settingId: 'GLOBAL' });
        let maxAllowedMB = 5000; // default 5GB for Direct
        let isPaid = false;

        // 🔥 FIX: Let ADMIN/OWNER bypass limits
        if (req.user && (req.user.role === 'ADMIN' || req.user.role === 'OWNER')) {
            maxAllowedMB = 50000; // Give admins 50GB limit
        } 
        else if (req.user && req.user.role === 'STUDIO') {
            const studio = await Studio.findOne({ mobile: req.user.mobile });
            isPaid = studio && studio.storagePlan && studio.storagePlan !== 'FREE';
            if (settings && settings.cloudRouting) {
                maxAllowedMB = isPaid ? Number(settings.cloudRouting.paidMaxFileMB) : Number(settings.cloudRouting.freeMaxFileMB);
            }
        }

        if ((fileSizeGB * 1024) > maxAllowedMB) {
            return res.status(413).json({ success: false, directUpload: false, message: `File too large! Your current plan allows max ${maxAllowedMB}MB per file.` });
        }

        // 1. Storage Router se Active Cloud Pata Karo
        const activeCloud = await getOrUpdateActiveStorage(fileSizeGB || 0.05, req.user?.mobile);

        // 2. 🟢 CLOUDINARY DIRECT UPLOAD
        if (activeCloud.provider === 'CLOUDINARY') {
            cloudinary.config({ cloud_name: activeCloud.credentials.cloudName, api_key: activeCloud.credentials.apiKey, api_secret: activeCloud.credentials.apiSecret });
            const timestamp = Math.round((new Date).getTime() / 1000);
            
            // 🔥 FIX: Use the dynamic cloudFolder instead of hardcoded 'snevio_vault'
            const signature = cloudinary.utils.api_sign_request({ timestamp: timestamp, folder: cloudFolder }, activeCloud.credentials.apiSecret);
            
            return res.json({ 
                success: true, directUpload: true, provider: 'CLOUDINARY', 
                cloudName: activeCloud.credentials.cloudName, apiKey: activeCloud.credentials.apiKey, timestamp, signature, folder: cloudFolder 
            });
        } 
        // 3. 🟢 AWS S3 / CLOUDFLARE R2 / STORJ DIRECT UPLOAD (Pre-Signed URL)
        else if (['AWS_S3', 'CLOUDFLARE_R2', 'STORJ'].includes(activeCloud.provider)) {
            const s3 = new AWS.S3({
                accessKeyId: activeCloud.credentials.apiKey, secretAccessKey: activeCloud.credentials.apiSecret, region: activeCloud.credentials.region || 'us-east-1', signatureVersion: 'v4',
                endpoint: activeCloud.provider === 'STORJ' ? 'https://gateway.storjshare.io' : (activeCloud.provider === 'CLOUDFLARE_R2' ? activeCloud.credentials.cloudName : undefined)
            });

            const cleanFileName = fileName ? fileName.replace(/\s+/g, '_') : 'snevio_media';
            // 🔥 FIX: Use dynamic cloudFolder for AWS/S3 too
            const fileKey = `${cloudFolder}/${Date.now()}_${cleanFileName}`;
            
            // Generate a 1-Hour Valid URL for Frontend to push file directly
            const signedUrl = await s3.getSignedUrlPromise('putObject', { 
                Bucket: activeCloud.credentials.bucketName, Key: fileKey, Expires: 3600, ContentType: fileType || 'application/octet-stream', ACL: 'public-read' 
            });
            
            return res.json({ 
                success: true, directUpload: true, provider: activeCloud.provider, 
                signedUrl, publicUrl: signedUrl.split('?')[0] // URL which client will save after upload
            });
        } 
        
        // 4. 🔴 IMGBB OR MEGA (Direct upload dangerous/not supported, fallback to Proxy Stream)
        return res.json({ success: true, directUpload: false, provider: activeCloud.provider, message: "Use Proxy Stream for this provider." });

    } catch (error) {
        console.error("Signature Gen Error:", error);
        res.status(500).json({ success: false, message: "Failed to generate upload signature." });
    }
});

// ==============================================================
// 🛡️ SECURE STREAM PROXY UPLOADER (For MEGA/IMGBB or Small Files)
// ==============================================================
app.post('/api/auth/proxy-upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No file provided" });
        
        const isImage = req.file.mimetype.startsWith('image/');
        const fileSizeGB = req.file.size / (1024 * 1024 * 1024);
        const filePath = req.file.path; 
        const fileSizeMB = req.file.size / (1024 * 1024);

        // 🔥 NAYA: Humne projectId pass kar di taaki backend wahi Cloud dhundhe
        const activeCloud = await getOrUpdateActiveStorage(fileSizeGB, req.user?.mobile, req.user?.role, projectId);

        // 🛑 SMART PROXY LIMIT CHECK
        const settings = await PlatformSetting.findOne({ settingId: 'GLOBAL' });
        let maxAllowedMB = 100; // Absolute max for Proxy to prevent crash
        let isPaid = false;
        let defaultFreeAlloc = 5;

        if (settings && settings.cloudRouting) {
            defaultFreeAlloc = Number(settings.cloudRouting.defaultFreeStorageGB) || 5;
        }

        if (req.user && req.user.role === 'STUDIO') {
            const studioData = await Studio.findOne({ mobile: req.user.mobile });
            if (studioData) {
                isPaid = studioData.storagePlan && studioData.storagePlan !== 'FREE';
                if (settings && settings.cloudRouting) {
                    const userPlanLimit = isPaid ? Number(settings.cloudRouting.paidMaxFileMB) : Number(settings.cloudRouting.freeMaxFileMB);
                    maxAllowedMB = Math.min(100, userPlanLimit); 
                }

                if (fileSizeMB > maxAllowedMB) { 
                    fs.unlinkSync(filePath);
                    return res.status(413).json({ success: false, message: `File too large! Your plan allows max ${maxAllowedMB}MB per file in proxy mode.` });
                }

                const allocated = studioData.allocatedStorageGB || (isPaid ? 5 : defaultFreeAlloc); 
                const used = studioData.usedStorageGB || 0;
                
                if (used + fileSizeGB > allocated) {
                    fs.unlinkSync(filePath); 
                    return res.status(403).json({ success: false, message: `Storage Limit Exceeded! You have used ${used.toFixed(2)}GB of your ${allocated}GB plan.` });
                }
            }
        }

        // 🔥 THE FIX: SMART CLOUD AWARENESS (Project-specific OR Tier-specific)
        const { projectId } = req.body; 
        let activeCloud = null;

        if (projectId && projectId !== 'undefined') {
            const project = await AlbumSelection.findById(projectId);
            if (project && project.storageConfigId) {
                activeCloud = await StorageConfig.findById(project.storageConfigId);
            }
        }
        
        // Agar project ID nahi mili, toh Tier-based routing karo
        if (!activeCloud) {
            const settings = await PlatformSetting.findOne({ settingId: 'GLOBAL' });
            let targetCloudId = null;

            if (req.user && req.user.mobile) {
                const studio = await Studio.findOne({ mobile: req.user.mobile });
                const isPaid = studio && studio.storagePlan && studio.storagePlan !== 'FREE';
                
                // Tier ke hisaab se Cloud ID uthao
                if (settings && settings.cloudRouting) {
                    targetCloudId = isPaid ? settings.cloudRouting.paidCloudId : settings.cloudRouting.freeCloudId;
                }
            }

            // Agar ID mil gayi, toh wo use karo, warna default active cloud
            if (targetCloudId && mongoose.Types.ObjectId.isValid(targetCloudId)) {
                activeCloud = await StorageConfig.findById(targetCloudId);
                console.log(`💎 Tier-based Routing: Saved to [${activeCloud?.nickname || 'Default'}]`);
            } else {
                activeCloud = await getOrUpdateActiveStorage(fileSizeGB, req.user?.mobile);
            }
        }

        let uploadedUrl = '';
        let previewUrl = '';

        console.log(`☁️ Secure Proxy Stream: Uploading to ${activeCloud.provider} (${activeCloud.nickname})`);

        const skipPreview = req.body.skipPreview === 'true';
        let watermarkedBuffer = null;

        // 🎨 WATERMARK PROCESSING
        if (isImage && !skipPreview) {
            const image = sharp(filePath);
            const metadata = await image.metadata();
            
            const finalWidth = Math.min(metadata.width, 800);
            const scaleFactor = finalWidth / metadata.width;
            const finalHeight = Math.round(metadata.height * scaleFactor);
            const fontSize = Math.floor(finalWidth * 0.08); 

            const svgWatermark = `<svg width="${finalWidth}" height="${finalHeight}"><text x="50%" y="50%" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="${fontSize}" font-family="Arial" font-weight="bold" transform="rotate(-30 ${finalWidth/2} ${finalHeight/2})">SNEVIO PREVIEW</text></svg>`;

            watermarkedBuffer = await image
                .resize({ width: finalWidth }) 
                .composite([{ input: Buffer.from(svgWatermark), gravity: 'center' }])
                .jpeg({ quality: 75 })
                .toBuffer();
        }

        // 🚀 CLOUD UPLOAD LOGIC
        if (activeCloud.provider === 'CLOUDINARY') {
            cloudinary.config({ cloud_name: activeCloud.credentials.cloudName, api_key: activeCloud.credentials.apiKey, api_secret: activeCloud.credentials.apiSecret });
            
            const uploadToCloudinary = (fileLoc) => {
                return new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { resource_type: 'auto', chunk_size: 8000000 }, 
                        (error, result) => { if (result) resolve(result); else reject(error); }
                    );
                    fs.createReadStream(fileLoc).pipe(stream);
                });
            };

            const result = await uploadToCloudinary(filePath);
            uploadedUrl = result.secure_url;
            
            if (isImage && !skipPreview) {
                const uploadIndex = uploadedUrl.indexOf('/upload/');
                previewUrl = `${uploadedUrl.slice(0, uploadIndex + 8)}c_scale,w_800,q_auto/l_text:Arial_60_bold:SNEVIO PREVIEW,co_white,o_50,a_-30/${uploadedUrl.slice(uploadIndex + 8)}`;
            } else {
                previewUrl = uploadedUrl;
            }
        } else {
            const originalBuffer = fs.readFileSync(filePath);
            
            if (activeCloud.provider === 'IMGBB') {
                const originalBase64 = originalBuffer.toString('base64');
                const imgbbResOriginal = await axios.post(`https://api.imgbb.com/1/upload?key=${activeCloud.credentials.apiKey}`, new URLSearchParams({ image: originalBase64 }));
                uploadedUrl = imgbbResOriginal.data.data.url;
                previewUrl = (isImage && watermarkedBuffer) ? (await axios.post(`https://api.imgbb.com/1/upload?key=${activeCloud.credentials.apiKey}`, new URLSearchParams({ image: watermarkedBuffer.toString('base64') }))).data.data.url : uploadedUrl;
            } else if (activeCloud.provider === 'MEGA') {
                const megaStorage = await new Storage({ email: activeCloud.credentials.apiKey, password: activeCloud.credentials.apiSecret }).ready;
                const megaFile = await megaStorage.upload(req.file.originalname, originalBuffer).complete;
                uploadedUrl = await megaFile.link();
                previewUrl = (isImage && watermarkedBuffer) ? await (await megaStorage.upload(`preview_${req.file.originalname}`, watermarkedBuffer).complete).link() : uploadedUrl;
            } else if (['AWS_S3', 'CLOUDFLARE_R2', 'STORJ'].includes(activeCloud.provider)) {
                const s3 = new AWS.S3({
                    accessKeyId: activeCloud.credentials.apiKey, secretAccessKey: activeCloud.credentials.apiSecret, region: activeCloud.credentials.region || 'us-east-1',
                    endpoint: activeCloud.provider === 'STORJ' ? 'https://gateway.storjshare.io' : (activeCloud.provider === 'CLOUDFLARE_R2' ? activeCloud.credentials.cloudName : undefined)
                });
                
                const originalParams = { Bucket: activeCloud.credentials.bucketName, Key: `snevio_vault/${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`, Body: fs.createReadStream(filePath), ACL: 'public-read' };
                uploadedUrl = (await s3.upload(originalParams).promise()).Location;
                previewUrl = (isImage && watermarkedBuffer) ? (await s3.upload({ Bucket: activeCloud.credentials.bucketName, Key: `snevio_preview/${Date.now()}_prev_${req.file.originalname.replace(/\s+/g, '_')}`, Body: watermarkedBuffer, ACL: 'public-read', ContentType: 'image/jpeg' }).promise()).Location : uploadedUrl;
            }
        }

        activeCloud.usedStorageGB = parseFloat((activeCloud.usedStorageGB + fileSizeGB).toFixed(4));
        await activeCloud.save();

        if (req.user && req.user.role === 'STUDIO') await Studio.updateOne({ mobile: req.user.mobile }, { $inc: { usedStorageGB: fileSizeGB } }, { strict: false });

        // 🧹 TEMP FILE CLEANUP
        if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); console.log(`🧹 Disk space cleared.`); }

        res.json({ success: true, url: uploadedUrl, previewUrl: previewUrl || uploadedUrl, provider: activeCloud.provider });

    } catch (error) {
        console.error("🚨 CLOUD UPLOAD CRASHED!");
        if (req.file && req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); 
        res.status(500).json({ success: false, message: "Secure upload failed. Check logs." });
    }
});

// ==============================================================
// 🚀 DYNAMIC MULTI-CLOUD UPLOAD ROUTE (USER DATA)
// ==============================================================
app.post('/api/auth/admin-add-user-cloud', authenticateToken, async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile); 
    let { type, name, location, addedBy, folderName, subFolderName, expiryDays, downloadLimit, email, fileUrls, imageCost, videoCost, unlockValidity, uploaderName, uploaderRole } = req.body; 

    if (folderName === 'undefined' || folderName === 'null') folderName = '';
    if (name === 'undefined' || name === 'null') name = 'Client';
    const finalFolderName = (folderName && folderName.trim() !== '') ? folderName.trim() : 'Snevio Photography';

    const iCost = (imageCost && parseInt(imageCost) >= 0) ? parseInt(imageCost) : 5;
    const vCost = (videoCost && parseInt(videoCost) >= 0) ? parseInt(videoCost) : 10;

    try {
        const filePaths = Array.isArray(fileUrls) ? fileUrls : [];
        
        // 🛑 ANTI-EMPTY FOLDER SHIELD: Agar fileUrls khali hai, toh DB me save mat karo!
        if (filePaths.length === 0) {
            return res.status(400).json({ success: false, message: "Upload failed on the cloud. Database aborted creating an empty folder." });
        }
        
        // 1. SMART ROUTER: Estimate size and update Active Storage
        // Default estimate: Assume each file is around 5MB (0.005 GB) if calculating directly from URLs
        const estimatedSizeGB = filePaths.length * 0.005; 
        const activeCloud = await getOrUpdateActiveStorage(estimatedSizeGB, req.user?.mobile, req.user?.role);
        
        // Update the usage counter dynamically
        activeCloud.usedStorageGB = parseFloat((activeCloud.usedStorageGB + estimatedSizeGB).toFixed(4));
        await activeCloud.save();
        
        // Log the routing path for debugging
        console.log(`☁️ Route Active: Saving data to [${activeCloud.nickname}] via ${activeCloud.provider}`);

        const existingAccount = await findAccount(mobile); 

        let expiryDate = null;
        if (expiryDays && parseInt(expiryDays) > 0) {
            expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));
        }
        const dLimit = (downloadLimit && parseInt(downloadLimit) > 0) ? parseInt(downloadLimit) : 0; 

        if (existingAccount) {
            let currentData = [];
            if (existingAccount.data.uploadedData) {
                if (Array.isArray(existingAccount.data.uploadedData)) {
                    currentData = existingAccount.data.uploadedData;
                } else if (typeof existingAccount.data.uploadedData === 'object' && existingAccount.data.uploadedData !== null) {
                    currentData = Object.values(existingAccount.data.uploadedData);
                } else if (typeof existingAccount.data.uploadedData === 'string') {
                    currentData = [existingAccount.data.uploadedData];
                }
            }
            
            if (currentData.length > 0 && typeof currentData[0] === 'string') {
                currentData = [{ folderName: 'Legacy Uploads', files: currentData, isDefault: false }];
            }
            currentData = currentData.filter(item => typeof item === 'object' && item !== null);

            let folderIndex = currentData.findIndex(f => f.folderName === finalFolderName);
            
            if (folderIndex > -1) {
                if (subFolderName) {
                    if (!currentData[folderIndex].subFolders) currentData[folderIndex].subFolders = [];
                    let subIndex = currentData[folderIndex].subFolders.findIndex(sf => sf.name === subFolderName);
                    if (subIndex > -1) {
                        currentData[folderIndex].subFolders[subIndex].files = [...(currentData[folderIndex].subFolders[subIndex].files || []), ...filePaths];
                    } else {
                        currentData[folderIndex].subFolders.push({ name: subFolderName, files: filePaths });
                    }
                } else {
                    currentData[folderIndex].files = [...(currentData[folderIndex].files || []), ...filePaths];
                }

                currentData[folderIndex].expiryDate = expiryDate;
                currentData[folderIndex].downloadLimit = dLimit;
                currentData[folderIndex].imageCost = iCost;
                currentData[folderIndex].videoCost = vCost;
                if (unlockValidity) currentData[folderIndex].unlockValidity = unlockValidity;

            } else {
                const newFolder = {
                    folderName: finalFolderName,
                    files: subFolderName ? [] : filePaths,
                    subFolders: subFolderName ? [{ name: subFolderName, files: filePaths }] : [],
                    isDefault: finalFolderName === 'Snevio Photography',
                    expiryDate: expiryDate,
                    downloadLimit: dLimit,
                    downloadCount: 0,
                    imageCost: iCost,
                    videoCost: vCost,
                    unlockValidity: unlockValidity || '24 Hours',
                    uploaderName: uploaderName || 'Snevio Partner', // 🔥 NAYA
                    uploaderRole: uploaderRole || 'Studio Partner' // 🔥 NAYA
                };
                currentData.push(newFolder);
            }

            const hasDummyEmail = !existingAccount.data.email || existingAccount.data.email.includes('dummy_');
            const targetEmail = (email && email.trim() !== '') ? email : existingAccount.data.email;
            
            let updateQuery = { $set: { uploadedData: currentData } };
            if (email && email.trim() !== '' && hasDummyEmail) updateQuery.$set.email = email;

            if (existingAccount.type === 'STUDIO') await Studio.updateOne({ mobile }, updateQuery, { strict: false });
            else await User.updateOne({ mobile }, updateQuery, { strict: false });

            sendUploadNotification(mobile, targetEmail, existingAccount.data.name || existingAccount.data.ownerName || name);
            var responseMessage = `Cloud Data appended to '${finalFolderName}' successfully!`;
        } else {
            // COMPLETELY NEW USER
            const targetEmail = (email && email.trim() !== '') ? email : `dummy_${mobile}@snevio.com`;
            
            const folderStructure = [{
                folderName: finalFolderName,
                files: subFolderName ? [] : filePaths,
                subFolders: subFolderName ? [{ name: subFolderName, files: filePaths }] : [],
                isDefault: finalFolderName === 'Snevio Photography',
                expiryDate: expiryDate,
                downloadLimit: dLimit,
                downloadCount: 0,
                imageCost: iCost,
                videoCost: vCost,
                unlockValidity: unlockValidity || '24 Hours',
                uploaderName: uploaderName || 'Snevio Partner',
                uploaderRole: uploaderRole || 'Studio Partner'
            }];

            const newUser = { mobile, password: "temp123", email: targetEmail, role: type || 'USER', location: location || "", addedBy: addedBy || "ADMIN", uploadedData: folderStructure };

            if (type === 'STUDIO') await Studio.create({ ...newUser, ownerName: name, studioName: name, isAdhaarVerified: false, adhaarNumber: "Pending" });
            else await User.create({ ...newUser, name: name });

            sendUploadNotification(mobile, targetEmail, name);
            var responseMessage = `Cloud Registration successful, data saved to '${finalFolderName}'!`;
        }

        // 🔥 FIX: RECORD UPLOAD HISTORY GUARANTEED FOR BOTH NEW AND OLD USERS
        const dateStr = new Date().toLocaleDateString('en-IN', {timeZone: 'Asia/Kolkata'}) + ' ' + new Date().toLocaleTimeString('en-IN', {timeZone: 'Asia/Kolkata', hour: '2-digit', minute:'2-digit'});
        
        // 1. Log for the Uploader (Studio or Owner)
        const uploadReport = req.body.uploadReport || null; // 🔥 NAYA: Catch Report
        if (req.user && req.user.mobile) {
            if (req.user.role === 'STUDIO') {
                await Studio.updateOne({ mobile: req.user.mobile }, { $push: { "wallet.history": { $each: [{ action: `Uploaded ${filePaths.length} files to ${mobile}`, amount: `📁 ${finalFolderName}`, date: dateStr, type: "upload", report: uploadReport }], $position: 0 } }}, { strict: false });
            } else if (req.user.role === 'ADMIN' || req.user.role === 'OWNER') {
                await Admin.updateOne({ mobile: req.user.mobile }, { $push: { "logs": { $each: [{ action: `Uploaded ${filePaths.length} files to ${mobile} (📁 ${finalFolderName})`, time: new Date() }], $position: 0 } }}, { strict: false });
            }
        }

        // 2. Log for the Receiver (Client or another Studio)
        const receiverRole = existingAccount ? existingAccount.type : (type || 'USER');
        if (receiverRole === 'STUDIO') {
            await Studio.updateOne({ mobile: mobile }, { $push: { "wallet.history": { $each: [{ action: `Received ${filePaths.length} new files`, amount: `📁 ${finalFolderName}`, date: dateStr, type: "received" }], $position: 0 } }}, { strict: false });
        } else {
            await User.updateOne({ mobile: mobile }, { $push: { "wallet.history": { $each: [{ action: `Received ${filePaths.length} new files`, amount: `📁 ${finalFolderName}`, date: dateStr, type: "received" }], $position: 0 } }}, { strict: false });
        }

        // 3. Email Notification to Uploader
        if (req.user && req.user.role === 'STUDIO') {
            const uploader = await Studio.findOne({ mobile: req.user.mobile });
            if (uploader && uploader.email && !uploader.email.includes('dummy_')) {
                sendBrevoEmail(uploader.email, `✅ Upload Successful: ${finalFolderName}`, `<div style="font-family: Arial; padding: 20px; border: 1px solid #2ecc71; border-radius: 8px;"><h2 style="color: #2ecc71;">Upload Successful!</h2><p>Data successfully sent and saved for client ${mobile}.</p></div>`).catch(()=>{});
            }
        }

        // ⚡ SOCKET FIRE: Client ko real-time update bhejo!
        const io = req.app.get('io');
        io.to(mobile).emit('data_updated', { message: 'Naya data aaya hai!' });

        return res.json({ success: true, message: responseMessage });
    } catch (e) {
        console.error("DB Insert Error:", e.message);
        
        // ✅ UPLOADER FAILED NOTIFICATION & HISTORY LOG
        if (req.user && req.user.role === 'STUDIO') {
            const dateStr = new Date().toLocaleDateString('en-IN', {timeZone: 'Asia/Kolkata'}) + ' ' + new Date().toLocaleTimeString('en-IN', {timeZone: 'Asia/Kolkata', hour: '2-digit', minute:'2-digit'});
            const uploader = await Studio.findOneAndUpdate({ mobile: req.user.mobile }, { $push: { "wallet.history": { $each: [{ action: `Failed Upload to ${req.body.mobile}`, amount: `❌ Error`, date: dateStr, type: "upload" }], $position: 0 } }});
            if (uploader && uploader.email && !uploader.email.includes('dummy_')) {
                sendBrevoEmail(uploader.email, `❌ Upload Failed: ${finalFolderName || 'Data'}`, `<div style="font-family: Arial; padding: 20px; border: 1px solid #e74c3c; border-radius: 8px;"><h2 style="color: #e74c3c;">Upload Failed!</h2><p>Failed to send data to ${req.body.mobile}. Error: ${e.message}</p></div>`).catch(()=>{});
            }
        }

        res.status(500).json({ success: false, message: e.message });
    }
});


// 9. Get List of Accounts
app.post('/api/auth/list-accounts', async (req, res) => {
    const { requesterRole, requesterMobile } = req.body;
    try {
        if (requesterRole === 'ADMIN' || requesterRole === 'OWNER') {
            const users = await User.find({}).lean();
            const studios = await Studio.find({}).lean();
            res.json({ success: true, data: [...users, ...studios] });
        } else if (requesterRole === 'STUDIO') {
            const cleanMobile = getCleanMobile(requesterMobile);
            const users = await User.find({ addedBy: cleanMobile }).lean();
            res.json({ success: true, data: users });
        } else {
            res.json({ success: false, message: "Unauthorized access" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch list" });
    }
});

// 10. Delete an Account
app.post('/api/auth/delete-account', authenticateToken, async (req, res) => {
    const targetMobile = getCleanMobile(req.body.targetMobile); 
    const { targetRole } = req.body; 
    try {
        if (targetRole === 'STUDIO') {
            await Studio.findOneAndDelete({ mobile: targetMobile });
        } else if (targetRole === 'ADMIN') {
            await Admin.findOneAndDelete({ mobile: targetMobile });
        } else {
            await User.findOneAndDelete({ mobile: targetMobile });
        }
        res.json({ success: true, message: "Account deleted successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete account" });
    }
});

// 11. Search Account
app.post('/api/auth/search-account', async (req, res) => {
    const identifier = getCleanMobile(req.body.mobile);
    const { roleFilter } = req.body; 
    const account = await findAccount(identifier, roleFilter);
    if (account) {
        res.json({ success: true, data: account.data });
    } else {
        res.json({ success: false, message: "Account not found" });
    }
});


// ==========================================
// ✅ ADMIN SPECIFIC LOGIC
// ==========================================

// 🔥 NEW: Admin Approves Studio Account & Sends Welcome Email
app.post('/api/auth/approve-studio-account', authenticateToken, async (req, res) => {
    try {
        // Sirf admin kar sakta hai
        if (req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') {
            return res.json({ success: false, message: "Unauthorized Action" });
        }

        const targetMobile = getCleanMobile(req.body.mobile);
        const { isApproved } = req.body; // true ya false

        const studio = await Studio.findOne({ mobile: targetMobile });
        if (!studio) return res.json({ success: false, message: "Studio account not found." });

        studio.isAccountApproved = isApproved;
        await studio.save();

        // 📩 Send Welcome Email if Approved
        if (isApproved && studio.email && !studio.email.includes('dummy_')) {
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; border-top: 5px solid #2ecc71;">
                    <h2 style="color: #2ecc71; text-align: center;">Account Approved! 🎉</h2>
                    <p>Hello <strong>${studio.studioName || studio.ownerName}</strong>,</p>
                    <p>Congratulations! Your studio partner account request on <strong>Snevio</strong> has been reviewed and approved by our team.</p>
                    <p>You can now log in to your dashboard to manage clients, upload media, and grow your business.</p>
                    <div style="text-align: center; margin-top: 25px;">
                        <a href="${WEBSITE_URL}login" style="background-color: #3498db; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold;">Login to Dashboard</a>
                    </div>
                    <p style="font-size: 11px; color: #999; text-align: center; margin-top: 30px;">Welcome to the Snevio Network!</p>
                </div>
            `;
            sendBrevoEmail(studio.email, "Your Studio Account is Approved! - Snevio", htmlContent).catch(()=>console.log("Welcome Email Failed"));
        }

        res.json({ success: true, message: isApproved ? "Studio Account Approved! Email Sent." : "Studio Account Access Revoked." });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Server error during approval." });
    }
});

app.post('/api/auth/update-studio-approval', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile);
    try {
        const result = await Studio.updateOne(
            { mobile }, 
            { $set: { isFeedApproved: req.body.isFeedApproved } }, 
            { strict: false }
        );
        
        if(result.modifiedCount > 0 || result.matchedCount > 0) {
            res.json({ success: true, message: req.body.isFeedApproved ? "Studio Approved for Feed!" : "Studio Feed Access Revoked!" });
        } else {
            res.json({ success: false, message: "Studio not found" });
        }
    } catch (e) { 
        res.status(500).json({ success: false, message: "Server error updating approval." }); 
    }
});

app.post('/api/auth/update-admin', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile);
    try {
        let admin;
        if (mobile === "0000000000CODEIS*@OWNER*") {
            admin = await Admin.findOne(); 
            if (!admin) admin = new Admin({ mobile: "9999999999", role: 'ADMIN' });
        } else {
            admin = await Admin.findOne({ mobile });
        }

        if (admin) {
            if(req.body.name) admin.name = req.body.name;
            if(req.body.email) admin.email = req.body.email;
            if(req.body.password) admin.password = req.body.password;
            await admin.save();
            res.json({ success: true, message: "Profile Updated Successfully" });
        } else {
            res.json({ success: false, message: "Admin not found" });
        }
    } catch (e) { 
        console.error(e);
        res.status(500).json({ success: false, message: "Server error updating profile." }); 
    }
});

app.post('/api/auth/add-subadmin', async (req, res) => {
    const { name, mobile, email, password } = req.body;
    try {
        const cleanMobile = getCleanMobile(mobile);
        const exists = await findAccount(cleanMobile);
        if (exists) return res.json({ success: false, message: "Mobile already registered!" });
        
        await Admin.create({ name, mobile: cleanMobile, email, password, role: 'ADMIN' });
        res.json({ success: true, message: "Sub-Admin created successfully." });
    } catch (e) { 
        res.status(500).json({ success: false, message: e.message }); 
    }
});

app.post('/api/auth/update-studio-profile', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile);
    try {
        const studio = await Studio.findOne({ mobile });
        if (studio) {
            if(req.body.studioName) studio.studioName = req.body.studioName;
            if(req.body.ownerName) studio.ownerName = req.body.ownerName;
            if(req.body.email) studio.email = req.body.email;
            if(req.body.password) studio.password = req.body.password;
            if(req.body.location) studio.location = req.body.location;
            await studio.save();
            res.json({ success: true, message: "Studio Profile Updated Successfully!" });
        } else {
            res.json({ success: false, message: "Studio not found" });
        }
    } catch (e) { 
        res.status(500).json({ success: false, message: "Server error updating profile." }); 
    }
});


// ==========================================
// ✅ 16. SOCIAL LINKS LOGIC 
// ==========================================

app.post('/api/auth/update-social-links', async (req, res) => {
    try {
        const { links } = req.body;
        await PlatformSetting.updateOne(
            { settingId: 'GLOBAL' }, 
            { $set: { socialLinks: links, lastUpdated: Date.now() } }, 
            { upsert: true }
        );
        res.json({ success: true, message: "Links updated successfully!" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Failed to save links." });
    }
});

app.get('/api/auth/get-platform-settings', async (req, res) => {
    try {
        const settings = await PlatformSetting.findOne({ settingId: 'GLOBAL' });
        if (settings) {
            res.json({ success: true, data: settings });
        } else {
            res.json({ success: true, data: null }); 
        }
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to fetch settings." });
    }
});


// ==========================================
// ✅ 17. POLICIES LOGIC 
// ==========================================

app.post('/api/auth/update-policies', async (req, res) => {
    try {
        const { policies } = req.body;
        // Policies mein ab hum terms, privacy, shipping aur contact charo bhejenge
        await PlatformSetting.updateOne(
            { settingId: 'GLOBAL' }, 
            { 
                $set: { 
                    "policies.terms": policies.terms,
                    "policies.privacy": policies.privacy,
                    "policies.shipping": policies.shipping,
                    "policies.contact": policies.contact,
                    "policies.bestForYou": policies.bestForYou,
                    lastUpdated: Date.now() 
                } 
            }, 
            { upsert: true }
        );
        res.json({ success: true, message: "All Legal Policies updated successfully!" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Failed to save policies." });
    }
});

app.post('/api/auth/update-default-pricing', async (req, res) => {
    try {
        const { imageCost, videoCost } = req.body;
        await PlatformSetting.updateOne(
            { settingId: 'GLOBAL' }, 
            { $set: { "defaultPricing.imageCost": imageCost, "defaultPricing.videoCost": videoCost, lastUpdated: Date.now() } }, 
            { upsert: true }
        );
        res.json({ success: true, message: "Global Default Pricing updated successfully!" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Failed to save pricing." });
    }
});

// ==========================================
// ✅ GET SERVICES ROUTE
// ==========================================
app.get('/api/auth/get-services', async (req, res) => {
    try {
        const defaultServices = [
            "Wedding Photography", 
            "Pre-Wedding Shoot", 
            "Corporate Event", 
            "Fashion / Portfolio", 
            "Maternity Shoot",
            "Birthday Party",
            "Other Media Service"
        ];
        res.json({ success: true, services: defaultServices });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to fetch services." });
    }
});


// ==========================================
// ✅ 18. DIRECT BOOKINGS LOGIC 
// ==========================================

app.post('/api/auth/create-booking', async (req, res) => {
    try {
        const { name, mobile, startDate, endDate, type, location, eventPlaceName } = req.body;
        
        const newBooking = await Booking.create([{ 
            name, 
            mobile, 
            startDate, 
            endDate, 
            type, 
            location, 
            eventPlaceName,
            status: 'Pending'
        }], { strict: false });

        // ⚡ SOCKET FIRE: Admin ko batao nayi booking aayi hai!
        const io = req.app.get('io');
        if (io) io.to('admin_room').emit('data_updated', { message: 'New booking received!' });

        res.json({ success: true, message: "Booking received successfully!", data: newBooking[0] });
    } catch (e) {
        console.error("Booking Error:", e);
        res.status(500).json({ success: false, message: "Failed to create booking." });
    }
});

app.get('/api/auth/get-bookings', async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ createdAt: -1 }); 
        res.json({ success: true, data: bookings });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to fetch bookings." });
    }
});

app.post('/api/auth/update-booking-status', async (req, res) => {
    try {
        const { bookingId, status, cancelReason } = req.body;
        
        let updateData = { status };
        if (status === 'Declined' && cancelReason) {
            updateData.cancelReason = cancelReason;
        } else if (status !== 'Declined') {
            updateData.cancelReason = ''; 
        }

        await Booking.findByIdAndUpdate(bookingId, updateData);
        res.json({ success: true, message: `Booking marked as ${status}!` });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to update booking." });
    }
});


// ==========================================
// ✅ 19. COLLAB REQUESTS LOGIC 
// ==========================================

app.post('/api/auth/create-collab', async (req, res) => {
    try {
        const { name, brand, email } = req.body;
        const newCollab = await CollabRequest.create({ name, brand, email });
        res.json({ success: true, message: "Request sent successfully!", data: newCollab });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to submit request." });
    }
});

app.get('/api/auth/get-collabs', async (req, res) => {
    try {
        const collabs = await CollabRequest.find().sort({ createdAt: -1 }); 
        res.json({ success: true, data: collabs });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to fetch collabs." });
    }
});

app.post('/api/auth/update-collab-status', async (req, res) => {
    try {
        const { collabId, status } = req.body;
        const collab = await CollabRequest.findByIdAndUpdate(collabId, { status }, { new: true });
        
        if (collab && collab.email && status !== 'Pending') {
            const subject = status === 'Accepted' ? "Collab Request Approved!" : "Collab Request Update";
            const msg = status === 'Accepted' ? "We are excited to work with you." : "Sorry, we can't proceed right now.";
            try {
                await sendBrevoEmail(
                    collab.email, 
                    subject, 
                    `<div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                        <h2 style="color: #2b5876;">Hi ${collab.name},</h2>
                        <p style="color: #444; font-size: 15px;">${msg}</p>
                        <div style="margin-top: 20px;">
                            <a href="${WEBSITE_URL}" style="background-color: #3498db; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Visit Platform</a>
                        </div>
                    </div>`
                );
            } catch(err) { console.log("Email failed for collab, but DB updated."); }
        }

        res.json({ success: true, message: `Collab marked as ${status}!` });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to update collab." });
    }
});

// ==========================================
// ✅ 20. UPDATE DOWNLOAD COUNT LOGIC
// ==========================================
app.post('/api/auth/update-download-count', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile);
    const { folderName } = req.body;

    try {
        const account = await findAccount(mobile);
        if (!account) return res.json({ success: false, message: "Account not found" });

        let currentData = [];
        if (account.data.uploadedData) {
            if (Array.isArray(account.data.uploadedData)) {
                currentData = account.data.uploadedData;
            } else if (typeof account.data.uploadedData === 'object' && account.data.uploadedData !== null) {
                currentData = Object.values(account.data.uploadedData);
            } else if (typeof account.data.uploadedData === 'string') {
                currentData = [account.data.uploadedData];
            }
        }

        if (currentData.length > 0 && typeof currentData[0] === 'string') {
            currentData = [{ folderName: 'Legacy Uploads', files: currentData, isDefault: false }];
        }
        currentData = currentData.filter(item => typeof item === 'object' && item !== null);

        let folderIndex = currentData.findIndex(f => f.folderName === folderName);

        if (folderIndex > -1) {
            currentData[folderIndex].downloadCount = (currentData[folderIndex].downloadCount || 0) + 1;
            
            if (account.type === 'STUDIO') {
                await Studio.updateOne({ mobile }, { $set: { uploadedData: currentData } }, { strict: false });
            } else {
                await User.updateOne({ mobile }, { $set: { uploadedData: currentData } }, { strict: false });
            }
            res.json({ success: true, message: "Download count updated!" });
        } else {
            res.json({ success: false, message: "Folder not found" });
        }
    } catch (e) {
        console.error("Download Count Update Error:", e);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});


// ==========================================
// 💰 MONETIZATION LOGIC (COINS, ADS & BATCH)
// ==========================================

// SINGLE File Deduct Route
app.post('/api/auth/deduct-coins', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile);
    const { amount, reason, fileUrl, expiryHours = 24 } = req.body; // 🔥 NAYA: fileUrl aur expiry time

    try {
        const account = await findAccount(mobile);
        if(!account) return res.json({ success: false, message: "Account not found" });

        let wallet = account.data.wallet || { coins: 0, history: [], unlockedFiles: [] };
        
        if (wallet.coins < parseInt(amount)) {
            return res.json({ success: false, message: "Not enough coins! Watch an Ad to earn more." });
        }

        // Deduct Coins
        wallet.coins -= parseInt(amount);

        // 🔥 FOMO 24-HOUR LOGIC: Save the unlocked file with expiry timestamp
        if (fileUrl) {
            const expiryTime = new Date();
            expiryTime.setHours(expiryTime.getHours() + parseInt(expiryHours));
            
            wallet.unlockedFiles = wallet.unlockedFiles || [];
            wallet.unlockedFiles.push({
                fileUrl: fileUrl,
                unlockTime: new Date().toISOString(),
                expiry: expiryTime.toISOString()
            });
        }

        // Add to history
        const historyEntry = {
            action: reason || "Unlocked Premium Media",
            amount: `-${amount} Coins`,
            date: new Date().toLocaleDateString(),
            type: "debit"
        };
        wallet.history = [historyEntry, ...(wallet.history || [])];

        // Safe DB Update
        if (account.type === 'STUDIO') {
            await Studio.updateOne({ mobile }, { $set: { wallet } }, { strict: false });
        } else {
            await User.updateOne({ mobile }, { $set: { wallet } }, { strict: false });
        }

        res.json({ success: true, wallet });
    } catch (e) {
        console.error("Coin Deduction Error:", e);
        res.status(500).json({ success: false, message: "Server error during purchase" });
    }
});

// ✅ BATCH MONETIZATION WITH STUDIO AUTO-TRANSFER
app.post('/api/auth/deduct-coins-batch', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile);
    const { amount, filesToUnlock, expiryDate, reason, targetStudio } = req.body; 

    try {
        const account = await findAccount(mobile);
        if(!account) return res.json({ success: false, message: "Account not found" });

        let wallet = account.data.wallet || { coins: 0, history: [], unlockedFiles: [] };
        
        if (wallet.coins < parseInt(amount)) {
            return res.json({ success: false, message: "Not enough coins!" });
        }

        // Deduct Total Coins
        wallet.coins -= parseInt(amount);

        // Add all selected files to unlocked array with Expiry Date
        const newUnlocked = filesToUnlock.map(fileUrl => ({
            fileUrl,
            unlockTime: new Date().toISOString(),
            expiry: expiryDate
        }));

        wallet.unlockedFiles = [...(wallet.unlockedFiles || []), ...newUnlocked];

        const historyEntry = {
            action: reason || `Unlocked ${filesToUnlock.length} Media Files`,
            amount: `-${amount} Coins`,
            date: new Date().toLocaleDateString(),
            type: "debit"
        };
        wallet.history = [historyEntry, ...(wallet.history || [])];

        if (account.type === 'STUDIO') await Studio.updateOne({ mobile }, { $set: { wallet } }, { strict: false });
        else await User.updateOne({ mobile }, { $set: { wallet } }, { strict: false });

        // ✅ AUTO-CREDIT COINS TO STUDIO'S WALLET
        if (targetStudio && targetStudio !== 'ADMIN' && targetStudio !== 'Snevio') {
            try {
                const studio = await Studio.findOne({ studioName: targetStudio });
                if (studio) {
                    let studioWallet = studio.wallet || { coins: 0, history: [], revenue: 0 };
                    studioWallet.coins += parseInt(amount);
                    
                    const studioHistory = {
                        action: `Media Unlocked by ${account.data.name || 'User'}`,
                        amount: `+${amount} Coins`,
                        date: new Date().toLocaleDateString(),
                        type: "credit"
                    };
                    studioWallet.history = [studioHistory, ...(studioWallet.history || [])];

                    await Studio.updateOne(
                        { _id: studio._id }, 
                        { $set: { wallet: studioWallet } }, 
                        { strict: false }
                    );
                }
            } catch (err) { 
                console.log("Failed to credit studio coins"); 
            }
        }

        // ✅ EMAIL NOTIFICATION LOGIC
        const targetEmail = account.data.email;
        if (targetEmail && !targetEmail.includes('dummy_')) {
            const subject = "Media Unlocked Successfully - Snevio";
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 500px; margin: 0 auto; background: #fafafa;">
                    <h2 style="color: #2ecc71; text-align: center;">Unlock Successful! 🎉</h2>
                    <p style="color: #444;">Hello <strong>${account.data.name || account.data.studioName || 'User'}</strong>,</p>
                    <p style="color: #444;">You have successfully unlocked <strong>${filesToUnlock.length}</strong> premium media file(s) on Snevio.</p>
                    <div style="background: #fff; padding: 15px; border-radius: 5px; margin: 15px 0; border: 1px dashed #ccc;">
                        <p style="margin: 5px 0;">Total Coins Deducted: <strong style="color: #e74c3c;">${amount}</strong></p>
                        <p style="margin: 5px 0;">Remaining Coin Balance: <strong style="color: #f39c12;">${wallet.coins}</strong></p>
                        <p style="margin: 5px 0;">Access Validity: <strong style="color: #3498db;">${expiryDate === 'Permanent' ? 'Permanent' : 'Limited Time'}</strong></p>
                    </div>
                    <p style="color: #444; text-align: center;">You can now view, download, and share your media.</p>
                    <div style="text-align: center; margin-top: 25px;">
                        <a href="${WEBSITE_URL}" style="background-color: #2ecc71; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">View Unlocked Media</a>
                    </div>
                    <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;" />
                    <p style="font-size: 11px; color: #999; text-align: center;">Thank you for choosing Snevio.</p>
                </div>
            `;
            sendBrevoEmail(targetEmail, subject, htmlContent).catch(e => console.log("Email failed, but unlock success"));
        }

        res.json({ success: true, wallet });
    } catch (e) {
        res.status(500).json({ success: false, message: "Server error during purchase" });
    }
});

// Add Coins when user watches an Ad
app.post('/api/auth/add-coins', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile);
    const { amount, reason } = req.body;

    try {
        const account = await findAccount(mobile);
        if(!account) return res.json({ success: false, message: "Account not found" });

        let wallet = account.data.wallet || { coins: 0, history: [] };
        
        // Add Coins
        wallet.coins += parseInt(amount);

        // Add to history
        const historyEntry = {
            action: reason || "Watched Ad Video",
            amount: `+${amount} Coin`,
            date: new Date().toLocaleDateString(),
            type: "credit"
        };
        wallet.history = [historyEntry, ...(wallet.history || [])];

        // Safe DB Update
        if (account.type === 'STUDIO') {
            await Studio.updateOne({ mobile }, { $set: { wallet } }, { strict: false });
        } else {
            await User.updateOne({ mobile }, { $set: { wallet } }, { strict: false });
        }

        res.json({ success: true, wallet });
    } catch (e) {
        console.error("Coin Addition Error:", e);
        res.status(500).json({ success: false, message: "Server error adding coins" });
    }
});

// ==========================================
// 💰 ADVANCED MONETIZATION (REAL MONEY & EVENTS)
// ==========================================

app.post('/api/auth/update-global-charges', async (req, res) => {
    try {
        const { imageCost, videoCost, coinPackages, miniEvents } = req.body;
        await PlatformSetting.updateOne(
            { settingId: 'GLOBAL' }, 
            { 
                $set: { 
                    "defaultPricing.imageCost": imageCost, 
                    "defaultPricing.videoCost": videoCost,
                    coinPackages: coinPackages,
                    miniEvents: miniEvents,
                    lastUpdated: Date.now() 
                } 
            }, 
            { upsert: true }
        );
        res.json({ success: true, message: "Global Charges & Events Updated!" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Failed to save global charges." });
    }
});

app.post('/api/auth/purchase-coins', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile);
    const { coinsToAdd, pricePaid } = req.body;

    try {
        const account = await findAccount(mobile);
        if(!account) return res.json({ success: false, message: "Account not found" });

        let wallet = account.data.wallet || { coins: 0, history: [], claimedEvents: [] };
        
        wallet.coins += parseInt(coinsToAdd);
        const historyEntry = {
            action: `Purchased with ₹${pricePaid}`,
            amount: `+${coinsToAdd} Coins`,
            date: new Date().toLocaleDateString(),
            type: "credit"
        };
        wallet.history = [historyEntry, ...(wallet.history || [])];

        if (account.type === 'STUDIO') await Studio.updateOne({ mobile }, { $set: { wallet } }, { strict: false });
        else await User.updateOne({ mobile }, { $set: { wallet } }, { strict: false });
        
        res.json({ success: true, wallet, message: "Payment Successful! Coins Added." });
    } catch (e) {
        console.error("Purchase Error:", e);
        res.status(500).json({ success: false, message: "Server error during purchase" });
    }
});

app.post('/api/auth/claim-event', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile);
    const { eventId, rewardCoins, eventTitle } = req.body;

    try {
        const account = await findAccount(mobile);
        if(!account) return res.json({ success: false, message: "Account not found" });

        let wallet = account.data.wallet || { coins: 0, history: [], claimedEvents: [] };
        
        if (!wallet.claimedEvents) wallet.claimedEvents = [];
        
        if (wallet.claimedEvents.includes(eventId)) {
            return res.json({ success: false, message: "You have already claimed this reward!" });
        }

        wallet.coins += parseInt(rewardCoins);
        wallet.claimedEvents.push(eventId); 

        const historyEntry = {
            action: `Completed: ${eventTitle}`,
            amount: `+${rewardCoins} Coins`,
            date: new Date().toLocaleDateString(),
            type: "credit"
        };
        wallet.history = [historyEntry, ...(wallet.history || [])];

        if (account.type === 'STUDIO') await Studio.updateOne({ mobile }, { $set: { wallet } }, { strict: false });
        else await User.updateOne({ mobile }, { $set: { wallet } }, { strict: false });
        
        res.json({ success: true, wallet, message: `Reward Claimed! +${rewardCoins} Coins` });
    } catch (e) {
        console.error("Event Claim Error:", e);
        res.status(500).json({ success: false, message: "Server error claiming event" });
    }
});

// ==========================================
// 💸 30.5 INSTAMOJO PAYMENT GATEWAY LOGIC
// ==========================================

// 🔗 1. Generate Payment Link (Smart Router)
app.post('/api/auth/create-payment', authenticateToken, async (req, res) => {
    try {
        const { amount, purpose, buyer_name, email, phone, itemType, itemValue } = req.body;

        // Webhook URL में हम खुफिया तरीके से itemType और itemValue भेजेंगे
        let webhookUrl = 'https://sandn-cinema.onrender.com/api/auth/payment-webhook';
        if (itemType && itemValue) {
            webhookUrl = `${webhookUrl}?itemType=${itemType}&itemValue=${itemValue}`;
        }

        const payload = {
            purpose: purpose || "Buy Coins", 
            amount: amount,
            buyer_name: buyer_name || req.user.name || 'Snevio User',
            email: email || 'dummy@snevio.com', 
            phone: phone || req.user.mobile,
            redirect_url: 'https://sandn-cinema.onrender.com/payment-success', 
            webhook: webhookUrl, 
            allow_repeated_payments: false
        };

        const response = await axios.post(`https://www.instamojo.com/api/1.1/payment-requests/`, payload, {
            headers: {
                'X-Api-Key': process.env.INSTAMOJO_API_KEY,
                'X-Auth-Token': process.env.INSTAMOJO_AUTH_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            console.log(`💰 Payment Link Created for ${itemType || 'COINS'}:`, response.data.payment_request.longurl);
            res.json({ success: true, paymentUrl: response.data.payment_request.longurl });
        } else {
            res.json({ success: false, message: "Instamojo Error: Link not generated" });
        }
    } catch (error) {
        console.error("Payment Creation Error:", error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, message: "Payment Gateway Error. Check API Keys." });
    }
});

// 🔔 2. Webhook (Background Listener - Handles Both Coins & Bookings)
app.post('/api/auth/payment-webhook', async (req, res) => {
    try {
        const data = req.body;
        const itemType = req.query.itemType || 'COINS'; 
        const itemValue = req.query.itemValue; // Booking ID aayegi yaha

        console.log(`🔔 Webhook Hit -> Type: ${itemType}, Status: ${data.status}`);

        if (data.status === 'Credit') {
            const amount = parseInt(data.amount);
            const buyerPhone = getCleanMobile(data.buyer_phone);

            // 🎯 SCENARIO A: Booking Advance Payment
            if (itemType === 'BOOKING' && itemValue) {
                let booking = await Booking.findById(itemValue);
                if (booking && booking.status !== 'Confirmed') {
                    booking.advancePaid = true;
                    if(booking.proposal) booking.proposal.isAccepted = true;
                    booking.status = 'Confirmed';
                    await booking.save();

                    // Studio ki Income (Revenue) update karo
                    if (booking.providerTarget && booking.providerTarget !== 'ADMIN') {
                        const studio = await Studio.findOne({ studioName: booking.providerTarget });
                        if (studio) {
                            let studioWallet = studio.wallet || { coins: 0, history: [], revenue: 0 };
                            studioWallet.revenue = (studioWallet.revenue || 0) + amount;
                            studioWallet.history.unshift({
                                action: `Advance Received: ${booking.name}`,
                                amount: `+₹${amount}`,
                                date: new Date().toLocaleDateString('en-IN', {timeZone: 'Asia/Kolkata'}),
                                type: "credit"
                            });
                            await Studio.updateOne({ _id: studio._id }, { $set: { wallet: studioWallet } }, { strict: false });
                        }
                    }
                    console.log(`✅ Booking Confirmed for ${buyerPhone}! Advance: ₹${amount}`);
                }
            }
            // 🚀 SCENARIO C: Studio Plan Auto-Upgrade
            else if (itemType === 'PLAN_UPGRADE' && itemValue) {
                const [planName, planGB] = itemValue.split('|'); // e.g., "Elite Plan|500"
                const studio = await Studio.findOne({ mobile: buyerPhone });
                if (studio) {
                    let wallet = studio.wallet || { coins: 0, history: [], revenue: 0 };
                    wallet.history.unshift({
                        action: `Upgraded to ${planName} (${planGB}GB)`,
                        amount: `-₹${amount}`,
                        date: new Date().toLocaleDateString('en-IN', {timeZone: 'Asia/Kolkata'}),
                        type: "debit"
                    });
                    
                    await Studio.updateOne(
                        { _id: studio._id }, 
                        { $set: { storagePlan: planName, allocatedStorageGB: parseInt(planGB), wallet: wallet } }, 
                        { strict: false }
                    );
                    console.log(`✅ Studio ${buyerPhone} Auto-Upgraded to ${planName}!`);
                }
            }
            // 🪙 SCENARIO B: Normal Coin Purchase
            else {
                const account = await findAccount(buyerPhone);
                if (account) {
                    let wallet = account.data.wallet || { coins: 0, history: [] };
                    wallet.coins += amount;
                    wallet.history.unshift({
                        action: `Purchased via Instamojo`,
                        amount: `+${amount} Coins`,
                        date: new Date().toLocaleDateString('en-IN', {timeZone: 'Asia/Kolkata'}),
                        type: "credit"
                    });

                    if (account.type === 'STUDIO') await Studio.updateOne({ mobile: buyerPhone }, { $set: { wallet } }, { strict: false });
                    else await User.updateOne({ mobile: buyerPhone }, { $set: { wallet } }, { strict: false });
                    
                    console.log(`🎉 Added ${amount} Coins to ${buyerPhone}`);
                }
            }
        }

        res.status(200).send('Webhook Received'); 
    } catch (error) {
        console.error("Webhook Logic Error:", error);
        res.status(500).send('Error');
    }
});

// ==========================================
// 🗑️ ADVANCED DELETE LOGIC (Folder, Sub-Folder, or Specific File)
// ==========================================
app.post('/api/auth/delete-specific-data', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile);
    const { folderName, subFolderName, fileUrl } = req.body;

    try {
        const account = await findAccount(mobile);
        if (!account) return res.json({ success: false, message: "Account not found" });

        let currentData = [];
        if (account.data.uploadedData) {
            currentData = Array.isArray(account.data.uploadedData) ? account.data.uploadedData : Object.values(account.data.uploadedData);
        }

        let folderIndex = currentData.findIndex(f => f.folderName === folderName);
        
        if (folderIndex > -1) {
            if (fileUrl) {
                if (subFolderName) {
                    let subIndex = currentData[folderIndex].subFolders.findIndex(sf => sf.name === subFolderName);
                    if (subIndex > -1) {
                        currentData[folderIndex].subFolders[subIndex].files = currentData[folderIndex].subFolders[subIndex].files.filter(url => url !== fileUrl);
                    }
                } else {
                    currentData[folderIndex].files = currentData[folderIndex].files.filter(url => url !== fileUrl);
                }
            } else if (subFolderName) {
                if (currentData[folderIndex].subFolders) {
                    currentData[folderIndex].subFolders = currentData[folderIndex].subFolders.filter(sf => sf.name !== subFolderName);
                }
            } else {
                currentData = currentData.filter(f => f.folderName !== folderName);
            }
        }

        if (account.type === 'STUDIO') {
            await Studio.updateOne({ mobile }, { $set: { uploadedData: currentData } }, { strict: false });
        } else {
            await User.updateOne({ mobile }, { $set: { uploadedData: currentData } }, { strict: false });
        }

        res.json({ success: true, message: "Data deleted successfully!", updatedData: currentData });
    } catch (e) {
        console.error("Delete Data Error:", e);
        res.status(500).json({ success: false, message: "Server Error deleting data." });
    }
});

// ==========================================
// ✅ 21. MANAGE SERVICES LOGIC (NEW APP FEATURES)
// ==========================================
app.post('/api/auth/add-service', async (req, res) => {
    try {
        let serviceData = { ...req.body };
        if (serviceData.startingPrice) {
            let discount = serviceData.discountPercentage || 0;
            serviceData.finalPrice = serviceData.startingPrice - ((serviceData.startingPrice * discount) / 100);
        }

        const newService = await Service.create(serviceData);
        res.json({ success: true, message: "Service added successfully to App!", data: newService });
    } catch (e) {
        console.error("Add Service Error:", e);
        res.status(500).json({ success: false, message: "Failed to add service." });
    }
});

app.get('/api/auth/get-available-services', async (req, res) => {
    try {
        const services = await Service.find().sort({ createdAt: -1 });
        res.json({ success: true, data: services });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to fetch services." });
    }
});

app.post('/api/auth/delete-service', async (req, res) => {
    try {
        await Service.findByIdAndDelete(req.body.id);
        res.json({ success: true, message: "Service removed from App successfully!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to delete service." });
    }
});

app.post('/api/auth/update-service', async (req, res) => {
    try {
        const { id, ...updateData } = req.body;
        
        if (updateData.startingPrice !== undefined || updateData.discountPercentage !== undefined) {
             const existingService = await Service.findById(id);
             const price = updateData.startingPrice !== undefined ? updateData.startingPrice : existingService.startingPrice;
             const discount = updateData.discountPercentage !== undefined ? updateData.discountPercentage : (existingService.discountPercentage || 0);
             
             updateData.finalPrice = price - ((price * discount) / 100);
        }

        const updatedService = await Service.findByIdAndUpdate(id, updateData, { new: true });
        if (updatedService) {
            res.json({ success: true, message: "Service updated successfully!", data: updatedService });
        } else {
            res.json({ success: false, message: "Service not found." });
        }
    } catch (e) {
        console.error("Update Service Error:", e);
        res.status(500).json({ success: false, message: "Failed to update service." });
    }
});

app.post('/api/auth/apply-service-discount', async (req, res) => {
    try {
        const { serviceId, discountPercentage, offerText } = req.body;
        const service = await Service.findById(serviceId);
        if (!service) return res.json({ success: false, message: "Service not found" });

        const discount = Number(discountPercentage) || 0;
        service.discountPercentage = discount;
        service.offerText = offerText || '';
        service.finalPrice = service.startingPrice - ((service.startingPrice * discount) / 100);
        
        await service.save();
        res.json({ success: true, message: "Discount/Offer applied successfully!", data: service });
    } catch (e) {
        console.error("Apply Discount Error:", e);
        res.status(500).json({ success: false, message: "Failed to apply discount." });
    }
});

app.post('/api/auth/get-user-services', async (req, res) => {
    try {
        const mobile = getCleanMobile(req.body.mobile);
        const userBookings = await Booking.find({ mobile: mobile }).sort({ createdAt: -1 });
        res.json({ success: true, data: userBookings });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to fetch user bookings." });
    }
});

// ==========================================
// ✅ 22. CART CHECKOUT & EMERGENCY BOOKING
// ==========================================

// Process Cart Checkout
app.post('/api/auth/checkout-cart', async (req, res) => {
    try {
        const { mobile, items } = req.body;
        const account = await findAccount(mobile);
        if (!account) return res.json({ success: false, message: "Account not found" });

        let totalAmount = items.reduce((acc, item) => acc + (item.startingPrice || 0), 0);
        const itemTitles = items.map(i => i.title).join(", ");

        const newBooking = await Booking.create({
            name: account.data.name || account.data.ownerName,
            mobile: mobile,
            email: account.data.email, 
            type: `Cart Order: ${itemTitles}`,
            amount: totalAmount,
            cartItems: items,
            status: 'Pending',
            providerTarget: items[0].addedBy || 'ADMIN' 
        });

        res.json({ success: true, message: "Cart checkout successful!", data: newBooking });
    } catch (e) {
        console.error("Cart Checkout Error:", e);
        res.status(500).json({ success: false, message: "Failed to process checkout." });
    }
});

// Process Emergency Booking
app.post('/api/auth/emergency-booking', async (req, res) => {
    try {
        const { mobile, reason, location, lat, long } = req.body; 
        const account = await findAccount(mobile);
        if (!account) return res.json({ success: false, message: "Account not found" });

        let wallet = account.data.wallet || { coins: 0, history: [] };
        
        if (wallet.coins < 50) {
            return res.json({ success: false, message: "Not enough coins for emergency booking." });
        }

        wallet.coins -= 50;

        const historyEntry = {
            action: "Emergency Booking Call",
            amount: "-50 Coins",
            date: new Date().toLocaleDateString(),
            type: "debit"
        };
        wallet.history = [historyEntry, ...(wallet.history || [])];

        if (account.type === 'STUDIO') {
            await Studio.updateOne({ mobile }, { $set: { wallet } }, { strict: false });
        } else {
            await User.updateOne({ mobile }, { $set: { wallet } }, { strict: false });
        }

        const emergencyBooking = await Booking.create({
            name: account.data.name || account.data.ownerName,
            mobile: mobile,
            email: account.data.email,
            type: "🚨 EMERGENCY BOOKING",
            location: location,
            liveLocation: { lat, long }, 
            reason: reason,
            isEmergency: true,
            status: 'Pending',
            amount: 0, 
            providerTarget: 'ADMIN' 
        });
        
        sendBrevoEmail(
            process.env.ADMIN_EMAIL || process.env.EMAIL_USER, 
            "🚨 EMERGENCY BOOKING RECEIVED", 
            `<h2 style="color:red;">Emergency Request!</h2><p>Client: ${emergencyBooking.name} (${mobile})</p><p>Location: ${location}</p><p>Reason: ${reason}</p>`
        ).catch(() => console.log("Admin Emergency Email failed"));

        // ⚡ SOCKET FIRE: Admin ko EMERGENCY alert bhejo!
        const io = req.app.get('io');
        if (io) io.to('admin_room').emit('data_updated', { message: '🚨 EMERGENCY BOOKING!' });

        res.json({ success: true, message: "Emergency call initiated!", wallet, data: emergencyBooking });
    } catch (e) {
        console.error("Emergency Booking Error:", e);
        res.status(500).json({ success: false, message: "Failed to process emergency booking." });
    }
});

// ==========================================
// ✅ 23. ADVANCED PROPOSAL SYSTEM (WITH PAYMENT ROUTING)
// ==========================================

// 📩 Admin Sends Proposal to User
app.post('/api/auth/send-proposal', async (req, res) => {
    try {
        const { bookingId, totalPrice, advanceAmount, deliverables, terms, expiryHours } = req.body;
        
        let booking = await Booking.findById(bookingId);
        if(!booking) return res.json({ success: false, message: "Booking not found." });

        const expiryTime = new Date();
        expiryTime.setHours(expiryTime.getHours() + parseInt(expiryHours));

        booking.proposal = {
            deliverables,
            totalPrice: parseInt(totalPrice),
            advanceAmount: parseInt(advanceAmount),
            terms,
            expiryTime,
            isAccepted: false
        };
        booking.status = 'Pending Payment'; 
        await booking.save();

        if (booking.email && !booking.email.includes('dummy_')) {
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="color: #2b5876;">You've received a Custom Proposal! 🎉</h2>
                    <p style="color: #444;">Hello <strong>${booking.name}</strong>,</p>
                    <p>We have reviewed your request for <strong>${booking.type}</strong> and generated a customized proposal for you.</p>
                    
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px dashed #ccc;">
                        <p style="margin: 5px 0;">Total Estimated Cost: <strong style="color: #2ecc71;">₹${totalPrice}</strong></p>
                        <p style="margin: 5px 0;">Advance Required (To Book): <strong style="color: #e74c3c;">₹${advanceAmount}</strong></p>
                        <p style="margin: 5px 0; color: #7f8c8d; font-size: 12px;"><em>This proposal expires on ${expiryTime.toLocaleString()}</em></p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 25px;">
                        <a href="${WEBSITE_URL}" style="background-color: #f39c12; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Details & Pay Advance</a>
                    </div>
                    <p style="font-size: 11px; color: #999; text-align: center; margin-top: 30px;">Thank you for choosing Snevio.</p>
                </div>
            `;
            sendBrevoEmail(booking.email, "Action Required: Your Custom Booking Proposal", htmlContent).catch(()=>console.log("Proposal Email Failed"));
        }

        res.json({ success: true, message: "Proposal sent successfully to user!", data: booking });
    } catch (e) {
        console.error("Proposal Error:", e);
        res.status(500).json({ success: false, message: "Failed to send proposal." });
    }
});

// 💳 User Accepts Proposal & Pays Advance 
app.post('/api/auth/accept-proposal', async (req, res) => {
    try {
        const { bookingId } = req.body;
        let booking = await Booking.findById(bookingId);
        if(!booking) return res.json({ success: false, message: "Booking not found." });

        if (new Date() > new Date(booking.proposal.expiryTime)) {
            booking.status = 'Declined';
            await booking.save();
            return res.json({ success: false, message: "Proposal has expired. Please contact support." });
        }

        // Simulating that user successfully paid the advance
        booking.advancePaid = true;
        booking.proposal.isAccepted = true;
        booking.status = 'Confirmed';
        await booking.save();

        // ✅ AUTO-CREDIT PAYMENT TO STUDIO'S WALLET (INCOME)
        if (booking.providerTarget && booking.providerTarget !== 'ADMIN') {
            try {
                // Find the Studio using the providerTarget (which stores addedBy / studioName)
                const studio = await Studio.findOne({ studioName: booking.providerTarget });
                if (studio) {
                    let studioWallet = studio.wallet || { coins: 0, history: [], revenue: 0 };
                    
                    // Add Rupees to Studio Revenue
                    studioWallet.revenue = (studioWallet.revenue || 0) + booking.proposal.advanceAmount;

                    // Add to Studio's Transaction History
                    const historyEntry = {
                        action: `Advance Received: ${booking.name}`,
                        amount: `+₹${booking.proposal.advanceAmount}`,
                        date: new Date().toLocaleDateString(),
                        type: "credit"
                    };
                    studioWallet.history = [historyEntry, ...(studioWallet.history || [])];

                    // Save Studio Wallet
                    await Studio.updateOne(
                        { _id: studio._id }, 
                        { $set: { wallet: studioWallet } }, 
                        { strict: false }
                    );
                    console.log(`💰 Added ₹${booking.proposal.advanceAmount} to ${studio.studioName}'s account.`);
                }
            } catch (err) {
                console.error("Failed to update studio income:", err);
            }
        }

        // 📩 Send Confirmation Email
        if (booking.email && !booking.email.includes('dummy_')) {
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; border-top: 5px solid #2ecc71;">
                    <h2 style="color: #2ecc71;">Booking Confirmed! ✅</h2>
                    <p>Hello <strong>${booking.name}</strong>,</p>
                    <p>We have successfully received your advance payment of <strong>₹${booking.proposal.advanceAmount}</strong>.</p>
                    <p>Your booking for <strong>${booking.type}</strong> is officially confirmed.</p>
                    <p>Our team will get in touch with you shortly to coordinate the final details.</p>
                    <div style="text-align: center; margin-top: 25px;">
                        <a href="${WEBSITE_URL}" style="background-color: #34495e; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Booking History</a>
                    </div>
                </div>
            `;
            sendBrevoEmail(booking.email, "Booking Confirmed - Snevio", htmlContent).catch(()=>console.log("Confirmation Email Failed"));
        }

        res.json({ success: true, message: "Advance Paid! Booking Officially Confirmed.", data: booking });
    } catch (e) {
        console.error("Accept Proposal Error:", e);
        res.status(500).json({ success: false, message: "Failed to confirm booking." });
    }
});

// ==========================================
// ✅ 24. PUBLIC FEED MANAGEMENT (TRENDING / VIRAL)
// ==========================================

// Create a dedicated Database Model for Public Feed
const feedPostSchema = new mongoose.Schema({
    studioMobile: String,
    studioName: String,
    file: String, // Cloudinary URL
    fileType: String, // image or video
    description: String,
    feedCategory: String, // 'trending' or 'viral'
    price: Number,
    expiryDate: Date, // ✅ FOMO Feature Added
    views: { type: Number, default: 0 }, // ✅ Analytics Added
    createdAt: { type: Date, default: Date.now }
});
const FeedPost = mongoose.models.FeedPost || mongoose.model('FeedPost', feedPostSchema);

// Upload a new post to the Feed (From Studio Dashboard)
app.post('/api/auth/upload-feed-post', authenticateToken, async (req, res) => {
    try {
        const { mobile, studioName, fileUrls, description, feedCategory, price, expiryHours } = req.body;
        
        // 1. SMART ROUTER UPDATE: Assume feed media is approx 10MB (0.01GB)
        const estimatedFeedSize = 0.01 * (fileUrls ? fileUrls.length : 1);
        const activeCloud = await getOrUpdateActiveStorage(estimatedFeedSize);
        activeCloud.usedStorageGB = parseFloat((activeCloud.usedStorageGB + estimatedFeedSize).toFixed(4));
        await activeCloud.save();
        
        let expiryDate = null;
        if (expiryHours && parseInt(expiryHours) > 0) {
            expiryDate = new Date();
            expiryDate.setHours(expiryDate.getHours() + parseInt(expiryHours));
        }

        const posts = fileUrls.map(url => ({
            studioMobile: mobile,
            studioName: studioName || 'Featured Studio',
            file: url,
            fileType: url.match(/\.(mp4|mov|avi|wmv|webm)$/i) ? 'video' : 'image',
            description: description || 'Check out this amazing shot!',
            feedCategory: feedCategory || 'trending',
            price: Number(price) || 5000,
            expiryDate: expiryDate
        }));

        await FeedPost.insertMany(posts);

        // ✅ BLAST NOTIFICATION TO ALL USERS (Background process)
        User.find({ role: 'USER' }).select('email').then(users => {
            const emails = users.filter(u => u.email && !u.email.includes('dummy_')).map(u => u.email);
            if(emails.length > 0) {
                const subject = `🔥 New Trending Post from ${studioName || 'a Top Studio'}!`;
                const htmlContent = `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                        <h2 style="color: #e74c3c;">New Trending Media Alert! 📸</h2>
                        <p style="color: #444;">A top studio just dropped a new amazing shot.</p>
                        <p style="color: #555;"><i>"${description}"</i></p>
                        <div style="margin-top: 20px;">
                            <a href="${WEBSITE_URL}" style="background-color: #2ecc71; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Check it out Now!</a>
                        </div>
                    </div>
                `;
                emails.forEach(email => sendBrevoEmail(email, subject, htmlContent).catch(()=>{}));
            }
        });

        res.json({ success: true, message: "Successfully published to Public Feed! 🌟" });
    } catch (err) {
        console.error("Feed Upload Error:", err);
        res.status(500).json({ success: false, message: "Server error publishing feed." });
    }
});

// Fetch Public Feed (For Landing Page)
app.get('/api/auth/get-public-feed', async (req, res) => {
    try {
        const { category } = req.query; // 'trending' or 'viral'
        let query = {};
        if (category) query.feedCategory = category;

        // Auto-delete expired posts before fetching
        await FeedPost.deleteMany({ expiryDate: { $lt: new Date() } });

        const posts = await FeedPost.find(query).sort({ createdAt: -1 });
        res.json({ success: true, data: posts });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch feed." });
    }
});

// ✅ UPDATE POST VIEWS ROUTE (For Analytics)
app.post('/api/auth/view-feed-post', async (req, res) => {
    try {
        const { postId } = req.body;
        await FeedPost.findByIdAndUpdate(postId, { $inc: { views: 1 } });
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false });
    }
});

// ==========================================
// 🌐 24.5 STUDIO MINI-WEBSITE API (THE TRAP)
// ==========================================
app.get('/api/auth/studio-page/:studioName', async (req, res) => {
    try {
        // 1. URL se Studio ka naam nikalo (Spaces aur special characters theek karke)
        const searchName = decodeURIComponent(req.params.studioName).replace(/-/g, ' ');

        // 2. Database me Studio ko dhundo (Case insensitive)
        const studio = await Studio.findOne({ 
            $or: [ 
                { studioName: new RegExp(`^${searchName}$`, 'i') }, 
                { ownerName: new RegExp(`^${searchName}$`, 'i') } 
            ] 
        }).select('studioName ownerName location email portfolioUrl profileImage isFeedApproved mobile');

        if (!studio) {
            return res.json({ success: false, message: "Studio not found! Make sure the link is correct." });
        }

        // 3. Agar studio mil gaya, toh uski saari Public Feed posts nikal lo
        const posts = await FeedPost.find({ studioMobile: studio.mobile }).sort({ createdAt: -1 });

        res.json({ 
            success: true, 
            studio: {
                studioName: studio.studioName || studio.ownerName,
                location: studio.location || 'India',
                email: studio.email,
                profileImage: studio.profileImage,
                isVerified: studio.isFeedApproved
            },
            posts: posts 
        });
    } catch (err) {
        console.error("Studio Page Error:", err);
        res.status(500).json({ success: false, message: "Server Error loading studio profile." });
    }
});

// ==========================================
// 🚀 25. SMART ADVERTISEMENT ENGINE (TARGETED ADS)
// ==========================================

const adSchema = new mongoose.Schema({
    title: String,
    file: String, // Cloudinary URL
    fileType: String, // image or video
    targetLocation: { type: String, default: 'ALL' }, // Specific city or ALL
    targetInterest: { type: String, default: 'ALL' }, // Specific category
    actionLink: String, // Website or App link
    maxViews: { type: Number, default: 0 }, // 0 means Unlimited
    currentViews: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});
const Advertisement = mongoose.models.Advertisement || mongoose.model('Advertisement', adSchema);

// 📤 Upload New Ad (From Admin Dashboard)
app.post('/api/auth/upload-ad', async (req, res) => {
    try {
        const newAd = await Advertisement.create(req.body);
        res.json({ success: true, message: "Smart Ad Created & Live! 🚀", data: newAd });
    } catch (err) {
        console.error("Ad Upload Error:", err);
        res.status(500).json({ success: false, message: "Server error uploading Ad." });
    }
});

// 📥 Fetch Targeted Ads for User Feed
app.post('/api/auth/get-targeted-ads', async (req, res) => {
    try {
        const { userLocation, userInterest } = req.body;
        
        // Find Ads where: Is Active AND (Current Views < Max Views OR Max Views is 0)
        let query = {
            isActive: true,
            $or: [ { maxViews: 0 }, { $expr: { $lt: ["$currentViews", "$maxViews"] } } ]
        };

        const activeAds = await Advertisement.find(query);

        // Smart Filtering (Show location/interest specific first, then global ads)
        const targetedAds = activeAds.filter(ad => {
            const locMatch = ad.targetLocation === 'ALL' || (userLocation && ad.targetLocation.toLowerCase().includes(userLocation.toLowerCase()));
            const intMatch = ad.targetInterest === 'ALL' || (userInterest && ad.targetInterest.toLowerCase() === userInterest.toLowerCase());
            return locMatch && intMatch;
        });

        res.json({ success: true, data: targetedAds.length > 0 ? targetedAds : activeAds });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch ads." });
    }
});

// 👁️ Track Ad Views to Auto-Stop Campaigns
app.post('/api/auth/track-ad-view', async (req, res) => {
    try {
        const { adId } = req.body;
        const ad = await Advertisement.findByIdAndUpdate(adId, { $inc: { currentViews: 1 } }, { new: true });
        
        // Auto-pause if max views reached
        if (ad && ad.maxViews > 0 && ad.currentViews >= ad.maxViews) {
            ad.isActive = false;
            await ad.save();
        }
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false });
    }
});

// 🗑️ Delete Ad
app.post('/api/auth/delete-ad', async (req, res) => {
    try {
        await Advertisement.findByIdAndDelete(req.body.adId);
        res.json({ success: true, message: "Ad Permanently Deleted from Cloud DB." });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to delete ad." });
    }
});

// ==========================================
// 🚀 26. SMART AUDIO EXTRACTOR & DIRECT MP3 UPLOADER
// ==========================================
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

// 🔒 SECURE CLOUDINARY CONFIG
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dq1wfpqhs', 
    api_key: process.env.CLOUDINARY_API_KEY || '938949614288297',       
    api_secret: process.env.CLOUDINARY_API_SECRET || 'Y0fHlu5CJbLwNPBjW-3PpPGSem0'  
});

// 🔥 SMART ROUTE: Handles both Video (Extract) and Audio (Direct Upload)
app.post('/api/auth/upload-split-video', authenticateToken, upload.single('videoFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No media file uploaded." });

        const inputFilePath = req.file.path;
        const mimeType = req.file.mimetype.toLowerCase();

        // 🟢 SCENARIO 1: USER UPLOADED DIRECT AUDIO (.mp3, .wav)
        if (mimeType.startsWith('audio/')) {
            console.log("🎵 Direct Audio Upload Detected. Skipping FFmpeg...");
            
            const cloudAudioRes = await cloudinary.uploader.upload(inputFilePath, {
                resource_type: 'video', // Note: Cloudinary requires 'video' type for audio files too
                folder: 'snevio_audio_splits'
            });

            // Clean up disk immediately
            fs.unlinkSync(inputFilePath);

            console.log("🎉 Direct Audio Uploaded Successfully!");
            return res.status(200).json({
                success: true,
                data: { audioCloudUrl: cloudAudioRes.secure_url }
            });
        }

        // 🔵 SCENARIO 2: USER UPLOADED VIDEO (.mp4) -> EXTRACT AUDIO
        if (mimeType.startsWith('video/')) {
            console.log("⚙️ Video Detected! FFmpeg Extracting Audio...");
            
            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

            const timestamp = Date.now();
            const audioOutputPath = path.join(tempDir, `audio_${timestamp}.mp3`);

            // Extract Audio Process
            await new Promise((resolve, reject) => {
                ffmpeg(inputFilePath)
                    .output(audioOutputPath)
                    .noVideo() // Remove Video Stream to save space
                    .audioCodec('libmp3lame')
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });

            console.log("☁️ Uploading Extracted Audio to Cloudinary...");
            const cloudAudioRes = await cloudinary.uploader.upload(audioOutputPath, {
                resource_type: 'video', 
                folder: 'snevio_audio_splits'
            });

            // Clean up both original video and temp mp3 from server
            fs.unlinkSync(inputFilePath);
            fs.unlinkSync(audioOutputPath);

            console.log("🎉 Audio Extracted & Uploaded Successfully!");
            return res.status(200).json({
                success: true,
                data: { audioCloudUrl: cloudAudioRes.secure_url }
            });
        }

        // 🔴 SCENARIO 3: INVALID FILE TYPE (Someone tried to upload a PDF or EXE)
        fs.unlinkSync(inputFilePath);
        return res.status(400).json({ success: false, message: "Invalid file format. Only Video or Audio allowed." });

    } catch (error) {
        console.error("Audio Processing Error:", error);
        // Fallback cleanup if something crashes
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(500).json({ success: false, message: "Server Error processing media." });
    }
});

// ==========================================
// 🔐 27. TEMPORARY MEDIA ACCESS (VIEW-ONLY)
// ==========================================
const sharedMediaSchema = new mongoose.Schema({
    senderMobile: String,
    senderName: String,
    receiverMobile: String,
    mediaUrl: String,
    mediaType: String,
    expiryDate: Date,
    createdAt: { type: Date, default: Date.now }
});
const SharedMedia = mongoose.models.SharedMedia || mongoose.model('SharedMedia', sharedMediaSchema);

// 📤 API 1: Grant Temporary Access
app.post('/api/auth/grant-media-access', authenticateToken, async (req, res) => {
    try {
        const { senderMobile, receiverMobile, mediaUrl, mediaType, hours } = req.body;
        
        if(senderMobile === receiverMobile) return res.json({ success: false, message: "You cannot share media with yourself!" });

        // ✅ NEW: Check if this exact media is already shared with this person
        const existingShare = await SharedMedia.findOne({ senderMobile, receiverMobile, mediaUrl });
        if(existingShare) {
            return res.json({ success: false, message: `⚠️ Already Shared! This ${mediaType} is already accessible to this user.` });
        }

        // Check if receiver exists
        const receiverAcc = await findAccount(receiverMobile);
        if (!receiverAcc) return res.json({ success: false, message: "User not found! Receiver must be registered on Snevio." });

        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + parseInt(hours));

        const senderAcc = await findAccount(senderMobile);
        const senderName = senderAcc ? (senderAcc.data.name || senderAcc.data.studioName) : "A User";

        await SharedMedia.create({
            senderMobile, senderName, receiverMobile, mediaUrl, mediaType, expiryDate
        });

        // Send Email Notification if receiver has an email
        if (receiverAcc.data.email && !receiverAcc.data.email.includes('dummy_')) {
            const subject = `You have been granted access to a Premium Media! 🔐`;
            const html = `
                <div style="font-family: Arial; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="color: #2ecc71;">Temporary Access Granted! 🎬</h2>
                    <p>Hello <strong>${receiverAcc.data.name || 'User'}</strong>,</p>
                    <p><strong>${senderName}</strong> has shared a premium ${mediaType} with you.</p>
                    <p style="color: #e74c3c;"><strong>⏳ Access expires in ${hours} hours.</strong></p>
                    <a href="${WEBSITE_URL}" style="background: #3498db; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Login to View</a>
                </div>
            `;
            sendBrevoEmail(receiverAcc.data.email, subject, html).catch(()=>console.log("Email failed"));
        }

        res.json({ success: true, message: `Access granted securely for ${hours} hours! Notification sent.` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// 📥 API 2: Fetch Shared Media (Sent & Received)
app.post('/api/auth/get-shared-media', authenticateToken, async (req, res) => {
    try {
        const { mobile } = req.body;
        // Delete expired media first
        await SharedMedia.deleteMany({ expiryDate: { $lt: new Date() } });
        
        // Fetch both Received and Sent media
        const sharedWithMe = await SharedMedia.find({ receiverMobile: mobile }).sort({ createdAt: -1 });
        const sharedByMe = await SharedMedia.find({ senderMobile: mobile }).sort({ createdAt: -1 });
        
        res.json({ success: true, data: { sharedWithMe, sharedByMe } });
    } catch (e) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// 🗑️ API 3: Revoke Access (Cancel Sharing)
app.post('/api/auth/revoke-media-access', authenticateToken, async (req, res) => {
    try {
        const { id, mobile } = req.body;
        // Delete only if the sender is the one requesting
        await SharedMedia.findOneAndDelete({ _id: id, senderMobile: mobile });
        res.json({ success: true, message: "Access revoked successfully!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// ==========================================
// 💼 28. CAREER & VACANCY MANAGEMENT (ADMIN)
// ==========================================

// 1. Post Nayi Job (Admin)
app.post('/api/auth/add-vacancy', async (req, res) => {
    try {
        const newJob = await Vacancy.create(req.body);
        res.json({ success: true, message: "Job Vacancy posted successfully!", data: newJob });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to post job." });
    }
});

// 2. Sari Jobs Fetch karna (Public / Profile Page)
app.get('/api/auth/get-vacancies', async (req, res) => {
    try {
        // Sirf wahi jobs dikhayega jo Active hain
        const jobs = await Vacancy.find({ isActive: true }).sort({ createdAt: -1 });
        res.json({ success: true, data: jobs });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to fetch vacancies." });
    }
});

// 3. Job Delete karna (Admin)
app.post('/api/auth/delete-vacancy', async (req, res) => {
    try {
        await Vacancy.findByIdAndDelete(req.body.id);
        res.json({ success: true, message: "Job Vacancy removed!" });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to delete vacancy." });
    }
});

// ==========================================
// ☁️ 29. STORAGE MANAGEMENT LOGIC (MULTIPLE CLOUDS)
// ==========================================

app.post('/api/auth/add-storage', authenticateToken, async (req, res) => {
    try {
        if(req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') return res.json({success: false, message: "Unauthorized"});

        const { nickname, provider, maxLimitGB, credentials, setAsActive } = req.body;
        
        if (setAsActive) {
            await StorageConfig.updateMany({}, { isActive: false });
        }

        const newStorage = await StorageConfig.create({
            nickname, provider, maxLimitGB: maxLimitGB || 5, credentials, isActive: setAsActive || false
        });

        res.json({ success: true, message: 'Storage Account Added Successfully!', data: newStorage });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to add storage account." });
    }
});

app.post('/api/auth/update-storage', authenticateToken, async (req, res) => {
    try {
        if(req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') return res.json({success: false, message: "Unauthorized"});

        const { id, nickname, provider, maxLimitGB, credentials, setAsActive } = req.body;
        
        if (setAsActive) {
            await StorageConfig.updateMany({ _id: { $ne: id } }, { isActive: false });
        }

        await StorageConfig.findByIdAndUpdate(id, {
            nickname, provider, maxLimitGB, credentials, isActive: setAsActive
        });

        res.json({ success: true, message: 'Storage Updated Successfully!' });
    } catch (error) {
        res.status(500).json({ success: false, message: "Update failed." });
    }
});

app.get('/api/auth/list-storage', authenticateToken, async (req, res) => {
    try {
        if(req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') return res.json({success: false, message: "Unauthorized"});
        const accounts = await StorageConfig.find().sort({ isActive: -1, createdAt: -1 });
        res.json({ success: true, data: accounts });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch storage configs." });
    }
});

app.post('/api/auth/set-active-storage', authenticateToken, async (req, res) => {
    try {
        if(req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') return res.json({success: false, message: "Unauthorized"});
        const { accountId } = req.body;
        
        await StorageConfig.updateMany({}, { isActive: false });
        await StorageConfig.findByIdAndUpdate(accountId, { isActive: true });
        
        res.json({ success: true, message: 'Active Storage Updated!' });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to update active storage." });
    }
});

app.post('/api/auth/delete-storage', authenticateToken, async (req, res) => {
    try {
        if(req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') return res.json({success: false, message: "Unauthorized"});
        const { accountId } = req.body;
        
        const account = await StorageConfig.findById(accountId);
        if(account && account.isActive) {
            return res.json({ success: false, message: 'Cannot delete the currently Active storage. Switch active first.' });
        }

        await StorageConfig.findByIdAndDelete(accountId);
        res.json({ success: true, message: 'Storage Configuration Removed!' });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete storage." });
    }
});

// ==========================================
// 🏢 30. STUDIO PLAN & LIMIT MANAGEMENT
// ==========================================

// A. Admin creates/updates a Subscription Plan
app.post('/api/auth/manage-subscription-plan', authenticateToken, async (req, res) => {
    try {
        if(req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') return res.json({ success: false, message: "Unauthorized Action" });
        
        const { id, planName, storageLimitGB, monthlyPrice, yearlyPrice, discountPercentage, offerText, features, isActive } = req.body;

        const payload = {
            planName,
            storageLimitGB: Number(storageLimitGB),
            monthlyPrice: Number(monthlyPrice),
            yearlyPrice: Number(yearlyPrice) || 0,
            discountPercentage: Number(discountPercentage) || 0,
            offerText: offerText || '',
            features: features || [],
            isActive: isActive !== undefined ? isActive : true
        };

        if (id) {
            await SubscriptionPlan.findByIdAndUpdate(id, payload);
            return res.json({ success: true, message: "Subscription Plan updated successfully!" });
        } else {
            await SubscriptionPlan.create(payload);
            return res.json({ success: true, message: "New Subscription Plan created!" });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Server error managing plans." });
    }
});

// B. Get all Subscription Plans (Public/Studio accessible)
app.get('/api/auth/get-subscription-plans', async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find({ isActive: true }).sort({ storageLimitGB: 1 });
        res.json({ success: true, data: plans });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to fetch plans." });
    }
});

// C. Admin fetches ALL plans (even inactive ones)
app.get('/api/auth/admin-get-subscription-plans', authenticateToken, async (req, res) => {
    try {
        if(req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') return res.json({ success: false, message: "Unauthorized Action" });
        const plans = await SubscriptionPlan.find().sort({ storageLimitGB: 1 });
        res.json({ success: true, data: plans });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to fetch plans." });
    }
});

// D. Delete a plan
app.post('/api/auth/delete-subscription-plan', authenticateToken, async (req, res) => {
    try {
        if(req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') return res.json({ success: false, message: "Unauthorized" });
        await SubscriptionPlan.findByIdAndDelete(req.body.id);
        res.json({ success: true, message: "Plan deleted permanently." });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to delete plan." });
    }
});

// E. Admin Manual Override Studio Plan (Modified to read dynamic plans)
app.post('/api/auth/update-studio-storage-plan', authenticateToken, async (req, res) => {
    try {
        if(req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') return res.json({ success: false, message: "Unauthorized Action" });

        const { targetMobile, newPlanName, customLimitGB, expiryDays } = req.body;
        
        const studio = await Studio.findOne({ mobile: getCleanMobile(targetMobile) });
        if(!studio) return res.json({ success: false, message: "Studio not found" });

        let allocated = 5; // Fallback
        
        if (newPlanName === 'CUSTOM') {
            allocated = parseFloat(customLimitGB) || 5;
        } else if (newPlanName === 'FREE') {
            allocated = 5;
        } else {
            // Find the dynamic plan created by Admin
            const selectedPlan = await SubscriptionPlan.findOne({ planName: newPlanName });
            if (selectedPlan) allocated = selectedPlan.storageLimitGB;
        }

        // Calculate Expiry Date
        let expiryDate = null;
        if (expiryDays && parseInt(expiryDays) > 0) {
            expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));
        }

        await Studio.updateOne(
            { _id: studio._id },
            { 
                $set: { 
                    storagePlan: newPlanName, 
                    allocatedStorageGB: allocated,
                    planExpiryDate: expiryDate
                } 
            },
            { strict: false } 
        );

        res.json({ success: true, message: `Studio updated to ${newPlanName} (${allocated}GB) successfully!` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Failed to update Studio Plan." });
    }
});

// ==========================================
// 📸 31. SMART ALBUM SELECTION ENGINE
// ==========================================

// 1. Studio Creates a New Selection Event (Triggers Email)
app.post('/api/auth/create-album-selection', authenticateToken, async (req, res) => {
    try {
        if(req.user.role !== 'STUDIO' && req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') return res.json({ success: false, message: "Unauthorized Action" });

        const { clientMobile, clientEmail, folderName, sheetLimit, imagesPerSheet, costPerExtraSheet, totalPhases, fileUrls, cloudProvider, uploaderName, uploaderRole, assignToStudio } = req.body; 

        // 🛑 ANTI-EMPTY FOLDER SHIELD FOR SMART ALBUM
        if (!fileUrls || fileUrls.length === 0) {
            return res.status(400).json({ success: false, message: "Upload failed on the cloud. Smart Album creation aborted to prevent empty project." });
        }

        // 🔥 THE REAL BUG FIX: Studio upload karega toh uska apna mobile use hoga, Admin karega toh assignToStudio check hoga!
        let targetStudioMobile = req.user.mobile;
        if (req.user.role === 'ADMIN' || req.user.role === 'OWNER') {
            targetStudioMobile = (assignToStudio && assignToStudio.trim() !== '') ? assignToStudio : ("ADMIN_ONLY_" + req.user.mobile);
        }

        const studioAcc = await Studio.findOne({ mobile: targetStudioMobile });
        const sName = studioAcc ? (studioAcc.studioName || studioAcc.ownerName) : (req.user.role === 'STUDIO' ? req.user.name : 'Snevio Admin');

        // ✅ FORMAT IMAGES (Smart Logic for Normal Arrays vs New Objects)
        const imageObjects = fileUrls.map(item => {
            if (typeof item === 'string') {
                return { url: item, previewUrl: item, status: 'active', selectedBy: [], subFolder: 'Main Event', deletedAt: null };
            } else {
                // 🔥 NAYA: previewUrl ko database me save kar rahe hain
                return { url: item.url, previewUrl: item.previewUrl || item.url, status: 'active', selectedBy: [], subFolder: item.subFolder || 'Main Event', deletedAt: null };
            }
        });

        // ✅ Extract raw URLs for fallback
        const rawUrls = imageObjects.map(img => img.url);

        const newSelection = await AlbumSelection.create({
            studioMobile: targetStudioMobile, // 🔥 THE LOCK: Ab studio ko nahi dikhega!
            studioName: sName,
            uploaderName: uploaderName || sName || 'Snevio Admin',
            uploaderRole: uploaderRole || 'Studio Partner', // 🔥 NAYA
            clientMobile: getCleanMobile(clientMobile),
            clientEmail: clientEmail,
            folderName: folderName,
            sheetLimit: Number(sheetLimit) || 0,
            imagesPerSheet: Number(imagesPerSheet) || 0,
            costPerExtraSheet: Number(costPerExtraSheet) || 0,
            totalPhases: Number(totalPhases) || 3,
            cloudProvider: cloudProvider || 'CLOUDINARY',
            images: imageObjects,
            allImages: rawUrls
        });

        // 📩 Fire Email to Client (The Magic Link)
        if (clientEmail && !clientEmail.includes('dummy_')) {
            const magicLink = `${WEBSITE_URL}client-dashboard`; // Yahan user login karke seedha select karega
            
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; padding: 25px; border: 1px solid #eee; border-radius: 10px; max-width: 600px; margin: auto;">
                    <h2 style="color: #2ecc71; text-align: center;">📸 Your Photos are Ready for Selection!</h2>
                    <p style="color: #444; font-size: 16px;">Hello,</p>
                    <p style="color: #444; font-size: 15px;"><strong>${sName}</strong> has just uploaded your event photos for the album selection process.</p>
                    
                    <div style="background: #f9f9f9; border-left: 4px solid #f1c40f; padding: 15px; margin: 20px 0;">
                        <h4 style={{margin: '0 0 5px 0'}}>Event: ${folderName}</h4>
                        <p style={{margin: 0, fontSize: '13px', color: '#666'}}>You can select images in ${totalPhases} phases and collaborate with your family members.</p>
                    </div>

                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${magicLink}" style="background-color: #3498db; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Log In & Start Selecting</a>
                    </div>
                    <p style="font-size: 11px; color: #999; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">Powered by Snevio Cloud</p>
                </div>
            `;
            sendBrevoEmail(clientEmail, `Album Selection Request: ${folderName}`, htmlContent).catch(e => console.log("Selection email failed"));
        }

        // ✅ RECORD SELECTION CREATION HISTORY (SMART ROUTING)
        const dateStr = new Date().toLocaleDateString('en-IN', {timeZone: 'Asia/Kolkata'}) + ' ' + new Date().toLocaleTimeString('en-IN', {timeZone: 'Asia/Kolkata', hour: '2-digit', minute:'2-digit'});
        
        // 1. Log for Studio/Admin (Sender)
        const uploadReport = req.body.uploadReport || null; // 🔥 NAYA: Catch Report
        if (req.user && req.user.mobile) {
            if (req.user.role === 'STUDIO') {
                await Studio.updateOne({ mobile: req.user.mobile }, { $push: { "wallet.history": { $each: [{ action: `Created Album Selection for ${clientMobile}`, amount: `📂 ${folderName}`, date: dateStr, type: "upload", report: uploadReport }], $position: 0 } }}, { strict: false });
            } else if (req.user.role === 'ADMIN' || req.user.role === 'OWNER') {
                await Admin.updateOne({ mobile: req.user.mobile }, { $push: { "logs": { $each: [{ action: `Created Album Selection for ${clientMobile} (📂 ${folderName})`, time: new Date() }], $position: 0 } }}, { strict: false });
            }
        }

        // 2. Log for Client (Receiver)
        const clientCleanMobile = getCleanMobile(clientMobile);
        await User.updateOne({ mobile: clientCleanMobile }, { $push: { "wallet.history": { $each: [{ action: `Received Album Selection Link`, amount: `📂 ${folderName}`, date: dateStr, type: "received" }], $position: 0 } }}, { strict: false });

        // ✅ UPLOADER SUCCESS NOTIFICATION
        if (req.user && req.user.role === 'STUDIO') {
            const uploader = await Studio.findOne({ mobile: req.user.mobile });
            if (uploader && uploader.email && !uploader.email.includes('dummy_')) {
                sendBrevoEmail(uploader.email, `✅ Selection Upload Successful: ${folderName}`, `<div style="font-family: Arial; padding: 20px; border: 1px solid #2ecc71; border-radius: 8px;"><h2 style="color: #2ecc71;">Smart Album Uploaded!</h2><p>Selection link sent successfully to ${clientMobile}.</p></div>`).catch(()=>{});
            }
        }

        res.json({ success: true, message: "Selection Event Created! Client Notified.", data: newSelection });
    } catch (e) {
        console.error(e);
        // ✅ UPLOADER FAILED NOTIFICATION & HISTORY LOG
        if (req.user && req.user.role === 'STUDIO') {
            const dateStr = new Date().toLocaleDateString('en-IN', {timeZone: 'Asia/Kolkata'}) + ' ' + new Date().toLocaleTimeString('en-IN', {timeZone: 'Asia/Kolkata', hour: '2-digit', minute:'2-digit'});
            const uploader = await Studio.findOneAndUpdate({ mobile: req.user.mobile }, { $push: { "wallet.history": { $each: [{ action: `Failed Selection Upload for ${req.body.clientMobile}`, amount: `❌ Error`, date: dateStr, type: "upload" }], $position: 0 } }});
            if (uploader && uploader.email && !uploader.email.includes('dummy_')) {
                sendBrevoEmail(uploader.email, `❌ Selection Upload Failed`, `<div style="font-family: Arial; padding: 20px; border: 1px solid #e74c3c; border-radius: 8px;"><h2 style="color: #e74c3c;">Upload Failed!</h2><p>Failed to send selection album to ${req.body.clientMobile}. Error: ${e.message}</p></div>`).catch(()=>{});
            }
        }
        res.status(500).json({ success: false, message: "Server error creating selection." });
    }
});

// 2. Fetch Selections (For Studio Dashboard)
app.post('/api/auth/get-studio-selections', authenticateToken, async (req, res) => {
    try {
        // Allow Owner, Admin, and Studio to fetch
        if(req.user.role !== 'STUDIO' && req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') {
            return res.json({ success: false, message: "Unauthorized Action" });
        }
        
        // Mobile number ko clean string banao
        const cleanMobile = String(req.user.mobile).trim();

        // 🔥 ULTIMATE FALLBACK QUERY: String, Number, aur AssignToStudio sab check karega!
        const selections = await AlbumSelection.find({ 
            $or: [
                { studioMobile: cleanMobile },
                { studioMobile: Number(cleanMobile) },
                { assignToStudio: cleanMobile },
                { assignToStudio: Number(cleanMobile) }
            ]
        }).sort({ createdAt: -1 });

        res.json({ success: true, data: selections });
    } catch (e) {
        console.error("Selection Fetch Error:", e);
        res.status(500).json({ success: false, message: "Server error during selection fetch." });
    }
});

// 🔄 MOVE IMAGE BETWEEN ALBUMS (SPLIT LOGIC)
app.post('/api/auth/move-image-album', authenticateToken, async (req, res) => {
    try {
        const { projectId, imageUrl, targetAlbum } = req.body; // targetAlbum: 'Album 1' or 'Album 2'

        const project = await AlbumSelection.findById(projectId);
        if (!project) return res.status(404).json({ success: false, message: "Project not found" });

        // Image dhoondo aur uska tag badal do
        const updatedImages = project.images.map(img => {
            if (img.url === imageUrl) {
                return { ...img, albumTag: targetAlbum }; 
            }
            return img;
        });

        await AlbumSelection.updateOne({ _id: projectId }, { $set: { images: updatedImages } }, { strict: false });

        res.json({ success: true, message: `Moved to ${targetAlbum}` });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// 3. Fetch Selections (For User Dashboard - UPDATED FOR FAMILY COLLAB & NICKNAME)
app.post('/api/auth/get-user-selections', authenticateToken, async (req, res) => {
    try {
        const clientMobile = getCleanMobile(req.body.mobile);
        if(!clientMobile) return res.json({ success: false, message: "Invalid Mobile" });
        
        const selections = await AlbumSelection.find({ 
            $or: [
                { clientMobile: clientMobile },
                { "familyMembers.mobile": clientMobile } // ✅ FIXED: Check inside array of objects
            ]
        }).sort({ createdAt: -1 });
        
        res.json({ success: true, data: selections });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to fetch user selections." });
    }
});

// 📸 API: Save Merged Selection
app.post('/api/auth/save-merged-selection', authenticateToken, async (req, res) => {
    try {
        const { projectId, mergedImages } = req.body;
        await AlbumSelection.updateOne(
            { _id: projectId }, 
            { $set: { mergedImages: mergedImages } }, 
            { strict: false }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/auth/invite-family-selection', authenticateToken, async (req, res) => {
    try {
        const { projectId, senderMobile, familyMobile, nickname, cost } = req.body;

        const account = await findAccount(senderMobile);
        if (!account) return res.json({ success: false, message: "Account not found" });

        let wallet = account.data.wallet || { coins: 0, history: [] };
        if (wallet.coins < cost) return res.json({ success: false, message: "Not enough coins!" });

        const selection = await AlbumSelection.findById(projectId);
        if (!selection) return res.json({ success: false, message: "Selection project not found." });

        // ✅ NEW: Smart Duplicate Check (Prevents coin deduction for same folder)
        const alreadyInvited = (selection.familyMembers || []).find(f => f.mobile === getCleanMobile(familyMobile));
        if (alreadyInvited) {
            return res.json({ 
                success: false, 
                message: `⚠️ Already Shared! You have already invited ${alreadyInvited.nickname || familyMobile} to the "${selection.folderName}" folder.` 
            });
        }

        // Cut Coins
        wallet.coins -= cost;
        wallet.history.unshift({
            action: `Family Invite Sent to ${nickname || familyMobile}`,
            amount: `-${cost} Coins`,
            date: new Date().toLocaleDateString(),
            type: "debit"
        });

        if (account.type === 'STUDIO') await Studio.updateOne({ mobile: senderMobile }, { $set: { wallet } }, { strict: false });
        else await User.updateOne({ mobile: senderMobile }, { $set: { wallet } }, { strict: false });

        // ✅ Push as an Object with Nickname
        await AlbumSelection.findByIdAndUpdate(projectId, {
            $push: { familyMembers: { mobile: getCleanMobile(familyMobile), nickname: nickname || 'Family', hasSubmitted: false } }
        }, { strict: false });

        res.json({ success: true, wallet, message: "Family member invited successfully!" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Server error during invitation." });
    }
});

// 4. Update Selection Phase & Finalize Engine (CRASH-PROOF & EMAIL ENABLED)
app.post('/api/auth/update-album-selection', authenticateToken, async (req, res) => {
    try {
        const { projectId, selectedImages, isFinal, isFamilyMember, userMobile, isDraftOnly, currentPhase } = req.body; 
        
        const selection = await AlbumSelection.findById(projectId).lean();
        if (!selection) return res.json({ success: false, message: "Project not found" });

        // 🛡️ SAFE ARRAYS: Prevents 500 Internal Server Errors
        const safeImages = Array.isArray(selection.images) ? selection.images : [];
        const safeSelectedImages = Array.isArray(selectedImages) ? selectedImages : [];

        // ✅ EXPLICIT PHASE CHANGE LOGIC (For "Edit Selection" & "Start Now" buttons)
        // Check if selectedImages is completely missing from req.body
        if (currentPhase !== undefined && req.body.selectedImages === undefined) {
            await AlbumSelection.updateOne({ _id: projectId }, { $set: { currentPhase: currentPhase } }, { strict: false });
            return res.json({ success: true, message: `Phase successfully updated to ${currentPhase}` });
        }

        // ✅ AUTO-SAVE DRAFT LOGIC (For Step-by-Step Wizard Navigation)
        if (isDraftOnly) {
            const updatedImages = safeImages.map(img => {
                if (safeSelectedImages.includes(img.url)) img.status = 'selected';
                else img.status = 'active'; 
                return img;
            });
            await AlbumSelection.updateOne({ _id: projectId }, { $set: { images: updatedImages } }, { strict: false });
            return res.json({ success: true, message: "Draft Auto-Saved." });
        }

        // ✅ IF FAMILY MEMBER IS VOTING
        if (isFamilyMember && userMobile) {
            safeImages.forEach(img => {
                if (!img.selectedBy) img.selectedBy = [];
                // Add vote if selected
                if (safeSelectedImages.includes(img.url)) {
                    if (!img.selectedBy.includes(userMobile)) img.selectedBy.push(userMobile);
                } else {
                    // Remove vote if deselected
                    img.selectedBy = img.selectedBy.filter(m => m !== userMobile);
                }
            });

            // Mark this family member as 'submitted' if they click the final submit
            if (isFinal && selection.familyMembers) {
                const fm = selection.familyMembers.find(f => f.mobile === userMobile);
                if (fm) fm.hasSubmitted = true;
            }

            await AlbumSelection.updateOne(
                { _id: projectId }, 
                { $set: { images: safeImages, familyMembers: selection.familyMembers } }, 
                { strict: false }
            );
            
            return res.json({ 
                success: true, 
                message: isFinal ? "Selections sent to the main client successfully! ❤️" : "Draft saved successfully." 
            });
        }

        // --- BELOW IS THE REGULAR LOGIC FOR MAIN CLIENT ---
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        // 1. Update image statuses safely
        const updatedImages = safeImages.map(img => {
            let newStatus = isFinal ? 'rejected' : 'active';
            if (safeSelectedImages.includes(img.url)) {
                newStatus = 'selected';
            }
            return {
                ...img,
                status: newStatus,
                deletedAt: (newStatus === 'rejected' && isFinal) ? sevenDaysFromNow : img.deletedAt
            };
        });

        let updatePayload = { images: updatedImages };
        let extraAmountToPay = 0;
        let nextPhaseMsg = "";

        // 2. 💰 If Final Phase, Calculate any extra charges
        if (isFinal) {
            const totalAllowed = (selection.sheetLimit || 0) * (selection.imagesPerSheet || 0);
            const extraImages = Math.max(0, safeSelectedImages.length - totalAllowed);
            const extraSheets = selection.imagesPerSheet > 0 ? Math.ceil(extraImages / selection.imagesPerSheet) : 0;
            extraAmountToPay = extraSheets * (selection.costPerExtraSheet || 0);

            updatePayload.extraAmountToPay = extraAmountToPay;
            updatePayload.isPaid = extraAmountToPay === 0;
            updatePayload.status = 'Completed';
            updatePayload.completedAt = new Date();

            // ✅ NEW: Default Delivery Date = Today + 25 Days
            const deliveryDate = new Date();
            deliveryDate.setDate(deliveryDate.getDate() + 25);
            updatePayload.expectedDeliveryDate = deliveryDate;
            updatePayload.remindersSent = []; // Track emails sent
        } else {
            // Move to next phase
            updatePayload.currentPhase = (selection.currentPhase || 1) + 1;
            updatePayload.status = `Phase ${updatePayload.currentPhase} Pending`;
            nextPhaseMsg = `You have successfully completed Phase ${selection.currentPhase}. You can now proceed to Phase ${updatePayload.currentPhase} in your dashboard.`;
        }

        // 3. FORCE SAVE into Database
        await AlbumSelection.updateOne(
            { _id: projectId }, 
            { $set: updatePayload }, 
            { strict: false }
        );

        // 4. 📩 FIRE EMAIL NOTIFICATIONS
        if (isFinal) {
            // Email to Studio
            const studioAcc = await Studio.findOne({ mobile: selection.studioMobile });
            if (studioAcc && studioAcc.email) {
                const studioHtml = `
                    <div style="font-family: Arial, sans-serif; padding: 20px; background: #fdfdfd; border: 1px solid #ddd; border-radius: 8px;">
                        <h2 style="color: #2b5876;">Selection Completed! 🎉</h2>
                        <p style="color: #444;">Your client has finalized their photo selections for <strong>${selection.folderName}</strong>.</p>
                        <p style="color: #444;">Total Selected: <strong>${safeSelectedImages.length}</strong> photos.</p>
                        ${extraAmountToPay > 0 ? `<p style="color: #e74c3c;">Note: The client selected extra sheets resulting in an additional charge of <strong>₹${extraAmountToPay}</strong>.</p>` : ''}
                        <div style="margin-top: 25px;">
                            <a href="${WEBSITE_URL}" style="background-color: #2ecc71; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Details in Dashboard</a>
                        </div>
                    </div>`;
                sendBrevoEmail(studioAcc.email, `Client Finalized Selection: ${selection.folderName}`, studioHtml).catch(() => {});
            }
            
            // Email to Client
            if (selection.clientEmail && !selection.clientEmail.includes('dummy_')) {
                const clientHtml = `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                        <h2 style="color: #2ecc71;">Selection Submitted! ✅</h2>
                        <p style="color: #444;">Thank you for finalizing your photos for <strong>${selection.folderName}</strong>.</p>
                        <p style="color: #444;">You selected <strong>${safeSelectedImages.length}</strong> photos.</p>
                        ${extraAmountToPay > 0 ? `<p style="color: #e74c3c;">You have an estimated extra charge of <strong>₹${extraAmountToPay}</strong> for additional sheets. The studio will contact you regarding this.</p>` : ''}
                        <p style="color: #666; font-size: 13px; margin-top: 20px;">The studio has been notified and will begin processing your album.</p>
                    </div>`;
                sendBrevoEmail(selection.clientEmail, `Your Selection is Confirmed - ${selection.folderName}`, clientHtml).catch(() => {});
            }
        } else {
            // Email to Client for Phase progression (Phase 1 -> 2, etc.)
            if (selection.clientEmail && !selection.clientEmail.includes('dummy_')) {
                const phaseHtml = `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                        <h2 style="color: #8e44ad;">Phase ${selection.currentPhase} Complete! 📸</h2>
                        <p style="color: #444;">You have successfully saved your progress for <strong>${selection.folderName}</strong>.</p>
                        <p style="color: #444;">${nextPhaseMsg}</p>
                        <p style="color: #666; font-size: 13px;">So far, you have shortlisted <strong>${safeSelectedImages.length}</strong> photos.</p>
                        <div style="margin-top: 25px;">
                            <a href="${WEBSITE_URL}" style="background-color: #3498db; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">Continue Selection</a>
                        </div>
                    </div>`;
                sendBrevoEmail(selection.clientEmail, `Phase ${selection.currentPhase} Saved - ${selection.folderName}`, phaseHtml).catch(() => {});
            }
        }

        res.json({ 
            success: true, 
            message: isFinal ? "Selection Finalized successfully! Notification sent to studio." : `Selection locked. Moving to Phase ${updatePayload.currentPhase}.` 
        });

    } catch (e) {
        console.error("Selection Update Error:", e);
        res.status(500).json({ success: false, message: "Server error during selection update.", error: e.message });
    }
});

// 🔥 NAYA: User manually Freezes the album before 72 hours
app.post('/api/auth/freeze-selection', authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.body;
        const project = await AlbumSelection.findById(projectId);
        
        if (!project) return res.json({ success: false, message: 'Project not found' });

        project.isFrozen = true;
        project.status = 'Confirmed'; // Studio can now download it!
        await project.save();

        // 📩 SEND NOTIFICATION TO STUDIO
        const studioAcc = await Studio.findOne({ mobile: project.studioMobile });
        if (studioAcc && studioAcc.email) {
            const studioHtml = `
                <div style="font-family: Arial; padding: 20px; border: 1px solid #2ecc71; border-radius: 8px;">
                    <h2 style="color: #2ecc71;">Album Locked by Client! 🚀</h2>
                    <p>Good news! Your client <strong>${project.clientMobile}</strong> has manually confirmed and locked their selection for <strong>${project.folderName}</strong>.</p>
                    <p>You don't need to wait for 72 hours. You can start the album production right now!</p>
                </div>`;
            sendBrevoEmail(studioAcc.email, `🚀 Client Locked Selection: ${project.folderName}`, studioHtml).catch(() => {});
        }

        res.json({ success: true, message: 'Album Frozen Successfully!' });
    } catch (err) {
        console.error("Freeze Error:", err);
        res.status(500).json({ success: false, message: 'Server error freezing album.' });
    }
});

// ==========================================
// 🔀 SMART SPLIT WORKFLOW APIs
// ==========================================

// 1. Initial Final Submit by User (Starts 72h timer)
app.post('/api/auth/projects/:id/final-submit', authenticateToken, async (req, res) => {
    try {
        const project = await AlbumSelection.findById(req.params.id);
        if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

        project.status = 'Submitted';
        
        // 🔥 FIX: 72H Timer सिर्फ पहली बार सेट होगा, एडिट करने पर रीसेट नहीं होगा!
        if (!project.finalSubmissionDate) {
            project.finalSubmissionDate = new Date(); 
        }
        
        await project.save();
        res.json({ success: true, message: 'Data submitted successfully. Split option available for 72h.', project });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 2. User requests to enter Split Mode
app.post('/api/auth/projects/:id/request-split', authenticateToken, async (req, res) => {
    try {
        const project = await AlbumSelection.findById(req.params.id);
        
        // Check if 72 hours passed
        const now = new Date();
        const submittedAt = new Date(project.finalSubmissionDate);
        const hoursDiff = (now - submittedAt) / (1000 * 60 * 60);

        if (hoursDiff > 72) {
            return res.status(400).json({ success: false, message: 'Split option expired (72 hours limit).' });
        }

        project.status = 'Split Mode';
        project.isSplitRequested = true;
        project.extraCharges = 2000; // ⚠️ Standard Split Album Charge
        
        await project.save();
        res.json({ success: true, message: 'Project is now in Split Mode.', project });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// 3. User finishes splitting and confirms finally
app.post('/api/auth/projects/:id/confirm-split', authenticateToken, async (req, res) => {
    try {
        const project = await AlbumSelection.findById(req.params.id);
        
        const selectedImages = project.images.filter(img => img.status === 'selected');
        const album1 = selectedImages.filter(img => !img.albumTag || img.albumTag === 'Album 1');
        const album2 = selectedImages.filter(img => img.albumTag === 'Album 2');

        project.status = 'Confirmed'; // Studio can now download
        project.splitCompleted = true;
        project.splitDetails = {
            hasSplit: album2.length > 0,
            album1Count: album1.length,
            album2Count: album2.length
        };
        
        await project.save();
        res.json({ success: true, message: 'Thank you! Studio will start production.', project });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ==========================================
// 📅 32. ALBUM DELIVERY & AUTOMATED REMINDERS
// ==========================================

// API for Studio to manually change the expected delivery date
app.post('/api/auth/update-album-delivery-date', authenticateToken, async (req, res) => {
    try {
        if(req.user.role !== 'STUDIO' && req.user.role !== 'ADMIN') return res.json({ success: false, message: "Unauthorized Action" });
        
        const { projectId, newDaysToAdd } = req.body;
        
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + parseInt(newDaysToAdd));

        await AlbumSelection.updateOne(
            { _id: projectId }, 
            { 
                $set: { expectedDeliveryDate: newDate },
                $pull: { remindersSent: { $in: [10, 3, 1] } } // Reset reminders if date changes
            }, 
            { strict: false }
        );

        res.json({ success: true, message: `Delivery date updated to ${newDaysToAdd} days from today.` });
    } catch (e) {
        res.status(500).json({ success: false, message: "Server error." });
    }
});

// 🤖 THE AUTOMATED EMAIL ENGINE (Runs every 12 hours)
const checkAndSendReminders = async () => {
    console.log("🤖 Running Automated Album Reminder Check...");
    try {
        // Find projects that are completed but not yet physically delivered
        const activeProjects = await AlbumSelection.find({ status: 'Completed', isAlbumDelivered: { $ne: true } });

        const today = new Date();

        for (let project of activeProjects) {
            if (!project.expectedDeliveryDate || !project.clientEmail || !project.studioMobile) continue;

            // Calculate days left
            const deliveryDate = new Date(project.expectedDeliveryDate);
            const timeDiff = deliveryDate.getTime() - today.getTime();
            const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

            let reminderToSend = null;

            if (daysLeft === 10 && !project.remindersSent?.includes(10)) reminderToSend = 10;
            else if (daysLeft === 3 && !project.remindersSent?.includes(3)) reminderToSend = 3;
            else if (daysLeft === 1 && !project.remindersSent?.includes(1)) reminderToSend = 1;

            if (reminderToSend) {
                console.log(`✉️ Sending ${reminderToSend}-Day Reminder for project ${project.folderName}...`);

                // 1. Email to Studio
                const studioAcc = await Studio.findOne({ mobile: project.studioMobile });
                if (studioAcc && studioAcc.email) {
                    const studioHtml = `
                        <div style="font-family: Arial; padding: 20px; border: 1px solid #e67e22; border-radius: 8px;">
                            <h2 style="color: #e67e22;">⏳ Album Delivery Reminder</h2>
                            <p>Hello Studio,</p>
                            <p>The album <strong>${project.folderName}</strong> is expected to be delivered in exactly <strong>${reminderToSend} days</strong>.</p>
                            <p>Please ensure printing and binding are on track to meet the deadline.</p>
                        </div>`;
                    sendBrevoEmail(studioAcc.email, `⏳ ${reminderToSend} Days Left: ${project.folderName}`, studioHtml).catch(()=>{});
                }

                // 2. Email to Client
                if (!project.clientEmail.includes('dummy_')) {
                    const clientHtml = `
                        <div style="font-family: Arial; padding: 20px; border: 1px solid #3498db; border-radius: 8px;">
                            <h2 style="color: #3498db;">Exciting News! 🎉</h2>
                            <p>Hello,</p>
                            <p>Your beautiful album for <strong>${project.folderName}</strong> is almost ready!</p>
                            <p>Expected delivery is in just <strong>${reminderToSend} days</strong>.</p>
                            <p>We can't wait for you to see the final result!</p>
                        </div>`;
                    sendBrevoEmail(project.clientEmail, `Your Album is Almost Ready! (${reminderToSend} Days Left)`, clientHtml).catch(()=>{});
                }

                // 3. Mark as sent in DB
                await AlbumSelection.updateOne(
                    { _id: project._id },
                    { $addToSet: { remindersSent: reminderToSend } },
                    { strict: false }
                );
            }
        }
    } catch (e) {
        console.log("Cron Error:", e.message);
    }
};

// Start the timer (Checks every 12 Hours: 12 * 60 * 60 * 1000 ms)
setInterval(checkAndSendReminders, 43200000); 
// Run once immediately on server start just to catch up
setTimeout(checkAndSendReminders, 10000);

// =====================================================================
// 🚀 NEW STUDIO DASHBOARD APIs (DATA MANAGEMENT & DELIVERY DATES)
// =====================================================================

// 1️⃣ 🚚 Update Expected Delivery Date for Album
app.post('/api/auth/update-album-delivery-date', authenticateToken, async (req, res) => {
    try {
        const { projectId, newDaysToAdd } = req.body;
        
        // Aaj ki date se 'newDaysToAdd' din aage ki date set karega
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + parseInt(newDaysToAdd));

        await AlbumSelection.findByIdAndUpdate(projectId, {
            expectedDeliveryDate: deliveryDate
        });

        res.json({ success: true, message: "Delivery date updated successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server Error updating date" });
    }
});

// 2️⃣ 🗑️ Advanced Delete: Specific File / Sub-Folder / Entire Folder
app.post('/api/auth/delete-specific-data', authenticateToken, async (req, res) => {
    try {
        const { mobile, folderName, subFolderName, fileUrl } = req.body;
        
        const user = await User.findOne({ mobile });
        if (!user) return res.json({ success: false, message: "Client not found in database." });

        let updatedData = user.uploadedData || [];

        if (fileUrl) {
            // Delete a SPECIFIC FILE only
            updatedData = updatedData.map(folder => {
                if (folder.folderName === folderName) {
                    if (subFolderName) {
                        folder.subFolders = folder.subFolders.map(sub => {
                            if (sub.name === subFolderName) {
                                sub.files = sub.files.filter(f => f !== fileUrl);
                            }
                            return sub;
                        });
                    } else {
                        folder.files = folder.files.filter(f => f !== fileUrl);
                    }
                }
                return folder;
            });
        } else if (subFolderName) {
            // Delete an ENTIRE SUB-FOLDER (Date Folder)
            updatedData = updatedData.map(folder => {
                if (folder.folderName === folderName) {
                    folder.subFolders = folder.subFolders.filter(sub => sub.name !== subFolderName);
                }
                return folder;
            });
        } else {
            // Delete the ENTIRE MAIN FOLDER
            updatedData = updatedData.filter(folder => folder.folderName !== folderName);
        }

        // Save back to DB
        user.uploadedData = updatedData;
        await user.save();

        res.json({ success: true, updatedData: user.uploadedData, message: "Data deleted successfully!" });
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ success: false, message: "Server error while deleting data." });
    }
});

// 🗑️ Delete Smart Selection Project Completely
app.post('/api/auth/delete-selection-project', authenticateToken, async (req, res) => {
    try {
        const { projectId } = req.body;
        await AlbumSelection.findByIdAndDelete(projectId);
        res.json({ success: true, message: "Project deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server error deleting project" });
    }
});

// ==========================================
// 📥 SECURE DOWNLOAD PROXY (Bypasses CORS & CSP)
// ==========================================
app.post('/api/auth/proxy-download', async (req, res) => {
    try {
        const { fileUrl } = req.body;
        if (!fileUrl) return res.status(400).json({ success: false, message: "No URL provided" });

        // Stream the file directly from Cloudinary (or any cloud) to the client
        const response = await axios({
            url: fileUrl,
            method: 'GET',
            responseType: 'stream' // Very important for handling large files efficiently
        });

        // Set headers so the browser knows it's a file download
        res.setHeader('Content-Disposition', `attachment; filename="snevio_media_${Date.now()}.jpg"`);
        res.setHeader('Content-Type', response.headers['content-type']);
        
        // Pipe the stream
        response.data.pipe(res);
        
    } catch (error) {
        console.error("Proxy Download Error:", error.message);
        res.status(500).json({ success: false, message: "Failed to proxy download." });
    }
});

// ==========================================
// 🎁 SECURE DAILY LOGIN REWARD (MIDNIGHT IST RESET)
// ==========================================
app.post('/api/auth/claim-daily-login', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile);
    try {
        const account = await findAccount(mobile);
        if(!account) return res.json({ success: false, message: "Account not found" });

        let wallet = account.data.wallet || { coins: 0, history: [], currentStreak: 0 };

        // ✅ Get Current Date strictly in Indian Standard Time (IST)
        // Format YYYY-MM-DD ensures exact matching (e.g. "2026-04-19")
        const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' };
        const todayIST = new Intl.DateTimeFormat('en-CA', options).format(new Date());

        // 🛑 If user already claimed today in IST, return false silently
        if (wallet.lastRewardDate === todayIST) {
            return res.json({ success: false, message: "Already claimed today." });
        }

        // 🎁 Add Coin, Update Date & Streak
        wallet.coins += 1;
        wallet.lastRewardDate = todayIST;
        wallet.currentStreak = (wallet.currentStreak || 0) + 1;

        const historyEntry = {
            action: `Daily Login Reward (Streak: ${wallet.currentStreak})`,
            amount: `+1 Coin`,
            date: new Date().toLocaleDateString('en-IN', {timeZone: 'Asia/Kolkata'}),
            type: "credit"
        };
        wallet.history = [historyEntry, ...(wallet.history || [])];

        // Safe DB Update
        if (account.type === 'STUDIO') {
            await Studio.updateOne({ mobile }, { $set: { wallet } }, { strict: false });
        } else {
            await User.updateOne({ mobile }, { $set: { wallet } }, { strict: false });
        }

        // Return success to trigger animation on frontend
        res.json({ success: true, wallet, streak: wallet.currentStreak });
    } catch (e) {
        console.error("Daily Reward Error:", e);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// 🔥 DANGER ZONE: Specific Cloud Data Wipe (ID Based)
app.delete('/api/auth/wipe-cloud/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { adminPassword } = req.body;

    // 1. सुरक्षा जाँच: अपना मास्टर पासवर्ड यहाँ सेट करें
    const MASTER_PASSWORD = "shivam@9111"; // ⚠️ इसे अपनी पसंद के पासवर्ड से बदलें

    if (adminPassword !== MASTER_PASSWORD) {
        return res.status(403).json({ success: false, message: "🚨 ग़लत पासवर्ड! डेटा सुरक्षित है।" });
    }

    try {
        // 2. ID से उस खास क्लाउड की सेटिंग्स निकालें
        const targetCloud = await StorageConfig.findById(id);
        if (!targetCloud) return res.status(404).json({ success: false, message: "Cloud account नहीं मिला।" });

        console.log(`⚠️ Wiping all data from: ${targetCloud.nickname} (${targetCloud.provider})`);

        // 3. S3 Compatible Providers (AWS, Storj, R2, Backblaze) के लिए डिलीट लॉजिक
        if (['AWS_S3', 'STORJ', 'CLOUDFLARE_R2', 'BACKBLAZE'].includes(targetCloud.provider)) {
            const s3 = new AWS.S3({
                accessKeyId: targetCloud.credentials.apiKey,
                secretAccessKey: targetCloud.credentials.apiSecret,
                endpoint: (targetCloud.provider === 'STORJ') ? 'https://gateway.storjshare.io' : (targetCloud.provider === 'CLOUDFLARE_R2' || targetCloud.provider === 'BACKBLAZE' ? targetCloud.credentials.cloudName : undefined)
            });

            // A. Bucket के अंदर की फाइल्स की लिस्ट निकालें
            const listParams = { Bucket: targetCloud.credentials.bucketName };
            const listedObjects = await s3.listObjectsV2(listParams).promise();

            if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
                // अगर फाइल्स नहीं हैं, तो सिर्फ काउंटर 0 कर दें
                targetCloud.usedStorageGB = 0;
                await targetCloud.save();
                return res.json({ success: true, message: "Cloud पहले से ही खाली है! काउंटर रिसेट कर दिया गया है।" });
            }

            // B. सारी फाइल्स को एक साथ (Batch Delete) उड़ाएं
            const deleteParams = {
                Bucket: targetCloud.credentials.bucketName,
                Delete: {
                    Objects: listedObjects.Contents.map(({ Key }) => ({ Key }))
                }
            };

            await s3.deleteObjects(deleteParams).promise();

            // C. डेटाबेस में उस क्लाउड का 'Used Space' 0 कर दें
            targetCloud.usedStorageGB = 0;
            await targetCloud.save();

            return res.json({ success: true, message: `💣 सफलता! ${targetCloud.nickname} की सारी फाइल्स डिलीट कर दी गई हैं और स्पेस रिसेट हो गया है।` });
        }

        // 4. ImgBB और Mega के लिए चेतावनी (चूंकि उनकी API बल्क डिलीट सपोर्ट नहीं करती)
        if (targetCloud.provider === 'IMGBB' || targetCloud.provider === 'MEGA') {
            return res.status(400).json({ 
                success: false, 
                message: `${targetCloud.provider} अभी API के ज़रिए 'Bulk Wipe' सपोर्ट नहीं करता। कृपया उनके डैशबोर्ड से मैन्युअली डिलीट करें।` 
            });
        }

        res.status(400).json({ success: false, message: "इस प्रोवाइडर के लिए ऑटो-वाइप उपलब्ध नहीं है।" });

    } catch (error) {
        console.error("WIPE ERROR:", error);
        res.status(500).json({ success: false, message: "Wipe प्रक्रिया फेल हो गई: " + error.message });
    }
});

// ==========================================
// 💸 32.5 STUDIO PAYOUT / WITHDRAWAL LOGIC
// ==========================================
app.post('/api/auth/request-withdrawal', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'STUDIO') return res.json({ success: false, message: "Only Studios can withdraw funds." });
        const { amount, upiId } = req.body;
        
        const studio = await Studio.findOne({ mobile: req.user.mobile });
        const wallet = studio.wallet || {};
        const revenue = wallet.revenue || 0;

        if (amount > revenue) return res.json({ success: false, message: "Insufficient revenue balance." });
        if (amount < 500) return res.json({ success: false, message: "Minimum withdrawal is ₹500." });

        // Deduct from revenue
        wallet.revenue -= amount;
        wallet.history.unshift({
            action: `Withdrawal Requested to ${upiId}`,
            amount: `-₹${amount}`,
            date: new Date().toLocaleDateString('en-IN', {timeZone: 'Asia/Kolkata'}),
            type: "debit"
        });
        await Studio.updateOne({ _id: studio._id }, { $set: { wallet } }, { strict: false });

        await WithdrawalRequest.create({
            studioMobile: studio.mobile,
            studioName: studio.studioName,
            amount, upiId
        });

        res.json({ success: true, message: "Withdrawal request submitted successfully!", wallet });
    } catch(e) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ✅ GET ALL WITHDRAWAL REQUESTS (For Admin Dashboard)
app.get('/api/auth/get-withdrawals', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') return res.json({ success: false, message: "Unauthorized" });
        
        const requests = await WithdrawalRequest.find().sort({ requestedAt: -1 });
        res.json({ success: true, data: requests });
    } catch(e) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ✅ PROCESS WITHDRAWAL REQUEST (Admin Approves/Rejects)
app.post('/api/auth/process-withdrawal', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') return res.json({ success: false, message: "Unauthorized" });
        
        const { id, action } = req.body; // action: 'Approved' or 'Rejected'
        
        const request = await WithdrawalRequest.findById(id);
        if (!request) return res.json({ success: false, message: "Request not found." });
        if (request.status !== 'Pending') return res.json({ success: false, message: "Already processed." });

        request.status = action;
        request.processedAt = new Date();
        await request.save();

        // ⚠️ अगर एडमिन ने रिजेक्ट (Reject) कर दिया, तो स्टूडियो को पैसे वापस लौटा दो
        if (action === 'Rejected') {
            const studio = await Studio.findOne({ mobile: request.studioMobile });
            if (studio) {
                let wallet = studio.wallet || { revenue: 0, history: [] };
                wallet.revenue += request.amount;
                wallet.history.unshift({
                    action: `Withdrawal Rejected (Refunded)`,
                    amount: `+₹${request.amount}`,
                    date: new Date().toLocaleDateString('en-IN', {timeZone: 'Asia/Kolkata'}),
                    type: "credit"
                });
                await Studio.updateOne({ _id: studio._id }, { $set: { wallet } }, { strict: false });
            }
        }

        res.json({ success: true, message: `Payout marked as ${action}!` });
    } catch(e) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ✅ GET STUDIO PAYOUT HISTORY (For Studio Dashboard)
app.get('/api/auth/my-payouts', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'STUDIO') return res.json({ success: false, message: "Unauthorized" });
        
        const myRequests = await WithdrawalRequest.find({ studioMobile: req.user.mobile }).sort({ requestedAt: -1 });
        res.json({ success: true, data: myRequests });
    } catch(e) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ==============================================================
// ✨ SMART ALBUM SELECTIONS (GOD VIEW) FOR ADMIN
// ==============================================================
app.get('/api/auth/admin-get-all-selections', authenticateToken, async (req, res) => {
    try {
        // Sirf Admin ya Owner ko access milega
        if (req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') {
            return res.json({ success: false, message: "Unauthorized Access!" });
        }

        // Agar tumhara Selection ka Mongoose Model hai, toh ye query chalegi
        // Agar Model ka naam kuch aur hai (jaise AlbumSelection), toh usey yahan replace kar lena
        const MongooseModel = mongoose.models.Selection || mongoose.models.AlbumSelection;

        if (!MongooseModel) {
            // Agar Model nahi bana hai, toh UI crash rokne ke liye khali array bhej do
            return res.json({ success: true, data: [] });
        }

        const allSelections = await MongooseModel.find().sort({ createdAt: -1 });
        res.json({ success: true, data: allSelections });

    } catch (error) {
        console.error("God View Fetch Error:", error);
        res.status(500).json({ success: false, message: "Failed to fetch selections", data: [] });
    }
});

// ==========================================
// ⏰ 33. CRON JOB: AUTO-CONFIRM SPLIT AFTER 72 HOURS
// ==========================================
cron.schedule('0 * * * *', async () => {
    console.log('🤖 Running 72-Hour Auto-Confirm Check...');
    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);

    try {
        const expiredProjects = await AlbumSelection.find({
            status: 'Submitted',
            finalSubmissionDate: { $lte: seventyTwoHoursAgo },
            isSplitRequested: false // Jo split mode mein nahi gaye unhe confirm karo
        });

        for (let proj of expiredProjects) {
            proj.status = 'Confirmed';
            await proj.save();
            console.log(`✅ Project ${proj.folderName} auto-confirmed after 72h window.`);
        }
    } catch (err) { console.error('Cron Error:', err.message); }
});

// ==========================================
// 🗑️ DELETE SPECIFIC IMAGE FROM SMART ALBUM
// ==========================================
app.post('/api/auth/delete-selection-image', authenticateToken, async (req, res) => {
    try {
        const { projectId, fileUrl } = req.body;
        const project = await AlbumSelection.findById(projectId);
        
        if (!project) return res.json({ success: false, message: "Project not found" });

        // Filter out the image from both arrays
        project.images = project.images.filter(img => img.url !== fileUrl);
        if (project.allImages) {
            project.allImages = project.allImages.filter(url => url !== fileUrl);
        }

        await project.save();
        res.json({ success: true, message: "Image deleted successfully from Smart Album" });
    } catch (error) {
        console.error("Delete Selection Image Error:", error);
        res.status(500).json({ success: false, message: "Server error deleting image" });
    }
});

// ==========================================
// 👑 GOD MODE: ADMIN FORCE UPDATE SMART ALBUM
// ==========================================
app.post('/api/auth/admin-force-update-album', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN' && req.user.role !== 'OWNER') {
            return res.json({ success: false, message: "Unauthorized Action" });
        }
        
        const { projectId, images, allImages, isFrozen } = req.body;
        
        await AlbumSelection.findByIdAndUpdate(projectId, {
            $set: { 
                images: images, 
                allImages: allImages, 
                isFrozen: isFrozen,
                status: isFrozen ? 'Confirmed' : 'Pending' // Agar admin ne lock kiya to Confirm mark kar do
            }
        }, { strict: false });

        res.json({ success: true, message: "Album updated permanently!" });
    } catch (error) {
        console.error("Force Update Error:", error);
        res.status(500).json({ success: false, message: "Server error during album update." });
    }
});

// --- START SERVER ---
// 🛑 PURANA app.listen HATA DIYA, AB server.listen CHALEGA
server.listen(PORT, async () => {
    console.log(`🚀 Server (with Socket.io) running on port ${PORT}`);
});
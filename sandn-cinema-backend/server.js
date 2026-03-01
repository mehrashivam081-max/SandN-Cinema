const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios'); 
const fs = require('fs');
const path = require('path');

const { User, Studio, Admin } = require('./models');

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
const upload = multer({ storage: storage });

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

// ==========================================
// 🚀 4. NEW LOGIC: FALLBACK UPLOAD NOTIFICATION 
// ==========================================
const sendUploadNotification = async (mobile, email, name) => {
    const customMessage = "999999"; // Dummy variable to trigger Fast2SMS template
    try {
        console.log(`Trying WhatsApp notification for ${mobile}...`);
        const waRes = await sendWhatsAppMsg(mobile, customMessage);
        if (waRes.data && waRes.data.return === true) return console.log("✅ WhatsApp Notification Sent");
        throw new Error("WhatsApp Failed");
    } catch (e1) {
        try {
            console.log(`WhatsApp failed, trying SMS for ${mobile}...`);
            const smsRes = await sendTextSMS(mobile, customMessage);
            if (smsRes.data && smsRes.data.return === true) return console.log("✅ SMS Notification Sent");
            throw new Error("SMS Failed");
        } catch (e2) {
            console.log(`SMS failed, trying Email for ${email}...`);
            if (email && !email.includes('dummy_')) {
                await sendBrevoEmail(
                    email, 
                    "Data Uploaded - SandN Cinema", 
                    `<h2>Hello ${name},</h2><p>Your data has been successfully uploaded to your account.</p>`
                );
                return console.log("✅ Email Notification Sent");
            }
            console.log("❌ All notification methods failed or invalid email.");
        }
    }
};

const otpStore = {}; 

// ✅ SMART CLEANER: Extract strictly the last 10 digits to prevent +91 bugs
const getCleanMobile = (mobileRaw) => {
    if (!mobileRaw) return "";
    let str = String(mobileRaw).trim();
    if (str === "0000000000CODEIS*@OWNER*") return str; // Keeps admin key safe
    str = str.replace(/\D/g, ''); // Remove spaces and symbols
    if (str.length > 10) {
        str = str.slice(-10); // Extact only the last 10 digits
    }
    return str;
};

const findAccount = async (mobile) => {
    const cleanMobile = getCleanMobile(mobile); 

    let acc = await User.findOne({ mobile: cleanMobile });
    if (acc) return { type: 'USER', data: acc };
    
    acc = await Studio.findOne({ mobile: cleanMobile });
    if (acc) return { type: 'STUDIO', data: acc };
    
    acc = await Admin.findOne({ mobile: cleanMobile });
    if (acc) return { type: 'ADMIN', data: acc };
    
    return null;
};

// --- ROUTES ---

// 1. Check & Send OTP (Login)
app.post('/api/auth/check-send-otp', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile); 
    const { sendVia } = req.body; 
    
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

        if (sendVia === 'email') {
            if (!targetEmail || targetEmail.includes('dummy_')) return res.json({ success: false, message: "No valid Email registered with this account." });
            try {
                await sendBrevoEmail(
                    targetEmail,
                    "Login Verification - SandN Cinema",
                    `<h2>Your Security OTP is: ${randomOTP}</h2><p>Do not share this with anyone.</p>`
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
        console.log(`🔐 Signup OTP for ${mobile}: ${randomOTP}`);

        if (sendVia === 'email' && email) {
            try {
                await sendBrevoEmail(
                    email,
                    "Verify Registration - SandN Cinema",
                    `<h2>Verification Code: ${randomOTP}</h2><p>Enter this OTP to create your account.</p>`
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
    const { type, otp, name, studioName, password, email, location, ...otherData } = req.body;

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

// ✅ 4. Verify OTP (For Login) - Checks for New User / Temp Password
app.post('/api/auth/verify-otp', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile); 
    const { otp } = req.body;
    if (otpStore[mobile] === otp) { 
        delete otpStore[mobile]; 
        
        const account = await findAccount(mobile);
        let isNewUser = false;
        
        if (account) {
            if (!account.data.password || account.data.password.trim() === "" || account.data.password === "temp123") {
                isNewUser = true;
            }
        }
        
        res.json({ success: true, isNewUser });
    } else {
        res.json({ success: false, message: "Invalid OTP" });
    }
});

// ✅ 5. Create Password (FOR MANUAL REGISTRATIONS)
app.post('/api/auth/create-password', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile); 
    const { password, email } = req.body;
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
    const mobile = getCleanMobile(req.body.mobile); 
    const { otp } = req.body;
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
    const mobile = getCleanMobile(req.body.mobile); 
    const { password } = req.body;
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

// ✅ 8. Admin/Studio Manual Add User + Re-upload Data + Notifications
app.post('/api/auth/admin-add-user', upload.array('mediaFiles', 20), async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile); 
    const { type, name, location, addedBy } = req.body;
    const files = req.files; 

    try {
        const existingAccount = await findAccount(mobile);
        
        // Extract paths of all uploaded files
        const filePaths = files && files.length > 0 ? files.map(f => f.path) : [];

        // ✅ LOGIC 1: APPENED DATA TO EXISTING USER
        if (existingAccount) {
            let accDoc;
            if (existingAccount.type === 'STUDIO') accDoc = await Studio.findOne({ mobile });
            else accDoc = await User.findOne({ mobile });

            if (filePaths.length > 0) {
                accDoc.uploadedData = accDoc.uploadedData ? [...accDoc.uploadedData, ...filePaths] : filePaths;
                await accDoc.save();
            }

            // Trigger Notification (WhatsApp -> SMS -> Email)
            sendUploadNotification(mobile, accDoc.email, accDoc.name || accDoc.ownerName || name);
            return res.json({ success: true, message: "Data appended to existing account & Notification sent!" });
        }

        // ✅ LOGIC 2: CREATE NEW USER/STUDIO
        const dummyEmail = `dummy_${mobile}@sandn.com`;
        
        const newUser = {
            mobile,
            password: "temp123", 
            email: dummyEmail, 
            role: type,
            location: location || "",
            addedBy: addedBy || "ADMIN", 
            uploadedData: filePaths 
        };

        if (type === 'STUDIO') {
            await Studio.create({ ...newUser, ownerName: name, studioName: name, isAdhaarVerified: false, adhaarNumber: "Pending" });
        } else {
            await User.create({ ...newUser, name: name });
        }

        sendUploadNotification(mobile, dummyEmail, name);
        res.json({ success: true, message: "Registration successful, files uploaded & Notification sent!" });
    } catch (e) {
        console.error("DB Insert Error:", e.message);
        res.status(500).json({ success: false, message: "Database Error: " + e.message });
    }
});

// ✅ 9. Get List of Accounts
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

// ✅ 10. Delete an Account
app.post('/api/auth/delete-account', async (req, res) => {
    const targetMobile = getCleanMobile(req.body.targetMobile); 
    const { targetRole } = req.body;
    try {
        if (targetRole === 'STUDIO') {
            await Studio.findOneAndDelete({ mobile: targetMobile });
        } else {
            await User.findOneAndDelete({ mobile: targetMobile });
        }
        res.json({ success: true, message: "Account deleted successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete account" });
    }
});

// ✅ 11. Search Account (For Frontend Validation before Firebase OTP)
app.post('/api/auth/search-account', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile);
    const account = await findAccount(mobile);
    if (account) {
        res.json({ success: true, data: account.data });
    } else {
        res.json({ success: false, message: "Account not found" });
    }
});

// --- START SERVER ---
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
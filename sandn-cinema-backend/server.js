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

const otpStore = {}; 

// ✅ Data clean up function: Spaces hata kar pure String banayega
const findAccount = async (mobile) => {
    const cleanMobile = String(mobile).trim(); 

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
    const mobile = String(req.body.mobile).trim(); // ✅ Clean Mobile
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
                return res.status(500).json({ success: false, message: "Email Failed. Try SMS/WhatsApp." });
            }
        } 
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
    const mobile = String(req.body.mobile).trim(); // ✅ Clean Mobile
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
                return res.status(500).json({ success: false, message: "Email Error. Try SMS." });
            }
        } 
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
    const mobile = String(req.body.mobile).trim(); // ✅ Clean Mobile
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
    const mobile = String(req.body.mobile).trim(); // ✅ Clean Mobile
    const { otp } = req.body;
    if (otpStore[mobile] === otp) { 
        delete otpStore[mobile]; 
        
        const account = await findAccount(mobile);
        let isNewUser = false;
        
        if (account) {
           // ✅ "temp123" wale accounts ko direct 'Create Password' par bhejega
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
    const mobile = String(req.body.mobile).trim(); // ✅ Clean Mobile
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
    const mobile = String(req.body.mobile).trim(); // ✅ Clean Mobile
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
    const mobile = String(req.body.mobile).trim(); // ✅ Clean Mobile
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

// ✅ 8. Admin/Studio Manual Add User with MULTIPLE Data Upload
app.post('/api/auth/admin-add-user', upload.array('mediaFiles', 20), async (req, res) => {
    const mobile = String(req.body.mobile).trim(); // ✅ Clean Mobile
    const { type, name, location, addedBy } = req.body;
    const files = req.files; 

    try {
        const exists = await findAccount(mobile);
        if (exists) return res.json({ success: false, message: "Mobile number is already registered!" });

        const dummyEmail = `dummy_${mobile}@sandn.com`;
        
        // Extract paths of all uploaded files
        const filePaths = files && files.length > 0 ? files.map(f => f.path) : [];

        const newUser = {
            mobile,
            password: "temp123", 
            email: dummyEmail, 
            role: type,
            location: location || "",
            addedBy: addedBy || "ADMIN", // ✅ Ye track karega ki kisne banaya
            uploadedData: filePaths // Array of multiple file paths
        };

        if (type === 'STUDIO') {
            await Studio.create({ ...newUser, ownerName: name, studioName: name, isAdhaarVerified: false });
        } else {
            await User.create({ ...newUser, name: name });
        }

        res.json({ success: true, message: "Registration successful and files uploaded!" });
    } catch (e) {
        console.error("DB Insert Error:", e.message);
        res.status(500).json({ success: false, message: "Database Error: " + e.message });
    }
});

// ✅ 9. Get List of Accounts (Admin gets all, Studio gets only ones they added)
app.post('/api/auth/list-accounts', async (req, res) => {
    const { requesterRole, requesterMobile } = req.body;
    try {
        if (requesterRole === 'ADMIN' || requesterRole === 'OWNER') {
            const users = await User.find({}).lean();
            const studios = await Studio.find({}).lean();
            res.json({ success: true, data: [...users, ...studios] });
        } else if (requesterRole === 'STUDIO') {
            // ✅ Clean searching here too, just in case
            const cleanMobile = String(requesterMobile).trim();
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
    const targetMobile = String(req.body.targetMobile).trim(); // ✅ Clean Mobile
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

// --- START SERVER ---
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
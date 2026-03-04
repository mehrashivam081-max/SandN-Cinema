const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios'); 
const fs = require('fs');
const path = require('path');

// ✅ Added New Models Here
const { User, Studio, Admin, Booking, CollabRequest, PlatformSetting } = require('./models');

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
// 🚀 4. NOTIFICATION LOGIC 
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

// ✅ SMART CLEANER
const getCleanMobile = (mobileRaw) => {
    if (!mobileRaw) return "";
    let str = String(mobileRaw).trim();
    if (str === "0000000000CODEIS*@OWNER*") return str; 
    str = str.replace(/\D/g, ''); 
    if (str.length > 10) {
        str = str.slice(-10); 
    }
    return str;
};

// ✅ ADDED STRICT ROLE FILTER LOGIC HERE WITH ADMIN BYPASS
const findAccount = async (mobile, roleFilter = null) => {
    const cleanMobile = getCleanMobile(mobile); 

    // 🚀 VIP BYPASS FOR ADMIN SECRET CODE
    if (cleanMobile === "0000000000CODEIS*@OWNER*") {
        let acc = await Admin.findOne(); // Fetch any existing admin
        if (acc) return { type: 'ADMIN', data: acc };
        // Fallback fake data if DB is empty to allow login
        return { type: 'ADMIN', data: { name: "Super Admin", mobile: cleanMobile, role: "ADMIN", password: "shivam@9111" } };
    }

    if (roleFilter === 'USER') {
        let acc = await User.findOne({ mobile: cleanMobile });
        if (acc) return { type: 'USER', data: acc };
        return null;
    } 
    
    if (roleFilter === 'STUDIO') {
        let acc = await Studio.findOne({ mobile: cleanMobile });
        if (acc) return { type: 'STUDIO', data: acc };
        return null;
    }

    if (roleFilter === 'ADMIN' || roleFilter === 'CODE') {
        let acc = await Admin.findOne({ mobile: cleanMobile });
        if (acc) return { type: 'ADMIN', data: acc };
        return null;
    }

    // Default fallback if no filter passed
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
    const { sendVia, roleFilter } = req.body; 
    
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
            // ✅ PASSING ROLE FILTER
            const account = await findAccount(mobile, roleFilter);
            if (!account) return res.json({ success: false, message: "Not Registered in this section." });
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
        const exists = await findAccount(mobile); // For signup we check globally to avoid duplicate mobiles anywhere
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

// 4. Verify OTP (For Login)
app.post('/api/auth/verify-otp', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile); 
    const { otp, roleFilter } = req.body;
    
    // VIP Admin code check
    if(mobile === "0000000000CODEIS*@OWNER*" && otpStore[mobile] === otp) {
        delete otpStore[mobile];
        return res.json({ success: true, isNewUser: false });
    }

    if (otpStore[mobile] === otp) { 
        delete otpStore[mobile]; 
        
        // ✅ PASSING ROLE FILTER
        const account = await findAccount(mobile, roleFilter);
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
    const mobile = getCleanMobile(req.body.mobile); 
    const { password, email, roleFilter } = req.body;
    try {
        let account = null;
        
        // ✅ Strict checking for setup
        if (roleFilter === 'USER') {
            account = await User.findOne({ mobile });
        } else if (roleFilter === 'STUDIO') {
            account = await Studio.findOne({ mobile });
        } else {
            account = await User.findOne({ mobile }) || await Studio.findOne({ mobile });
        }

        if (account) {
            account.password = password;
            if (email) account.email = email; 
            await account.save();
            
            res.json({ 
                success: true, 
                user: { name: account.name || account.ownerName, mobile: account.mobile, role: account.role } 
            });
        } else {
            res.json({ success: false, message: "Account not found in this section" });
        }
    } catch (e) { res.status(500).json({ success: false, message: "Update Failed" }); }
});

// 6. Login via OTP
app.post('/api/auth/login-otp', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile); 
    const { otp, roleFilter } = req.body;
    
     // VIP Admin code check
    if(mobile === "0000000000CODEIS*@OWNER*" && otpStore[mobile] === otp) {
        delete otpStore[mobile];
        return res.json({ success: true, user: { name: "Owner", mobile: mobile, role: "ADMIN" } });
    }

    if (otpStore[mobile] === otp) { 
        delete otpStore[mobile];
        const account = await findAccount(mobile, roleFilter); // ✅ Filter added
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
    const { password, roleFilter } = req.body;
    try {
        const account = await findAccount(mobile, roleFilter); // ✅ Filter added
        if (account && account.data.password === password) {
            res.json({
                success: true,
                user: { name: account.data.name || account.data.ownerName, mobile: account.data.mobile, role: account.type, email: account.data.email, isFeedApproved: account.data.isFeedApproved }
            });
        } else {
            res.json({ success: false, message: "Invalid Password or Role" });
        }
    } catch (e) { res.status(500).json({ success: false, message: "Login Error" }); }
});


// ==============================================================
// ✅ 8. UPLOAD LOGIC (BUG FIXED: MONGOOSE STRICT SCHEMA BYPASS)
// ==============================================================
app.post('/api/auth/admin-add-user', upload.array('mediaFiles', 20), async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile); 
    const { type, name, location, addedBy, folderName } = req.body; // folderName added
    const files = req.files; 

    // Agar folder name nahi bheja, toh default 'Stranger Photography' use hoga
    const finalFolderName = (folderName && folderName.trim() !== '') ? folderName.trim() : 'Stranger Photography';

    try {
        const existingAccount = await findAccount(mobile); // General check for upload
        const filePaths = files && files.length > 0 ? files.map(f => f.path) : [];

        // --- SCENARIO A: APPENED DATA TO EXISTING USER ---
        if (existingAccount) {
            let currentData = existingAccount.data.uploadedData || [];
            
            // Backup Fix: Agar purana data sirf strings ki array me tha, use objects me convert karo
            if (currentData.length > 0 && typeof currentData[0] === 'string') {
                currentData = [{ folderName: 'Legacy Uploads', files: currentData, isDefault: false }];
            }

            let folderIndex = currentData.findIndex(f => f.folderName === finalFolderName);
            
            if (folderIndex > -1) {
                // Folder exist karta hai -> usme files daal do
                currentData[folderIndex].files = [...currentData[folderIndex].files, ...filePaths];
            } else {
                // Naya folder banao
                currentData.push({
                    folderName: finalFolderName,
                    files: filePaths,
                    isDefault: finalFolderName === 'Stranger Photography'
                });
            }

            // ✅ MOST IMPORTANT FIX: Use updateOne to bypass mongoose schema crash for old accounts
            if (existingAccount.type === 'STUDIO') {
                await Studio.updateOne({ mobile }, { $set: { uploadedData: currentData } }, { strict: false });
            } else {
                await User.updateOne({ mobile }, { $set: { uploadedData: currentData } }, { strict: false });
            }

            // Trigger Notification
            sendUploadNotification(mobile, existingAccount.data.email, existingAccount.data.name || existingAccount.data.ownerName || name);
            return res.json({ success: true, message: `Data appended to folder '${finalFolderName}' & Notification sent!` });
        }

        // --- SCENARIO B: CREATE NEW USER WITH FOLDERS ---
        const dummyEmail = `dummy_${mobile}@sandn.com`;
        
        const folderStructure = [{
            folderName: finalFolderName,
            files: filePaths,
            isDefault: finalFolderName === 'Stranger Photography'
        }];

        const newUser = {
            mobile,
            password: "temp123", 
            email: dummyEmail, 
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

        sendUploadNotification(mobile, dummyEmail, name);
        res.json({ success: true, message: `Registration successful, files saved to '${finalFolderName}' & Notification sent!` });
    } catch (e) {
        console.error("DB Insert Error:", e.message);
        res.status(500).json({ success: false, message: "Database Error: " + e.message });
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
app.post('/api/auth/delete-account', async (req, res) => {
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
    const mobile = getCleanMobile(req.body.mobile);
    const { roleFilter } = req.body; // ✅ Added Filter
    const account = await findAccount(mobile, roleFilter);
    if (account) {
        res.json({ success: true, data: account.data });
    } else {
        res.json({ success: false, message: "Account not found" });
    }
});


// ==========================================
// ✅ ADMIN SPECIFIC LOGIC
// ==========================================

// 12. Update Studio Feed Approval
app.post('/api/auth/update-studio-approval', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile);
    try {
        const studio = await Studio.findOne({ mobile });
        if(studio) {
            studio.isFeedApproved = req.body.isFeedApproved;
            await studio.save();
            res.json({ success: true, message: req.body.isFeedApproved ? "Studio Approved for Feed!" : "Studio Feed Access Revoked!" });
        } else {
            res.json({ success: false, message: "Studio not found" });
        }
    } catch (e) { 
        res.status(500).json({ success: false, message: "Server error updating approval." }); 
    }
});

// ✅ 13. Update Admin Profile (FIXED: Handling Code correctly)
app.post('/api/auth/update-admin', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile);
    try {
        let admin;
        // Agar code hai toh directly admin account nikal lo
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

// 14. Add Sub-Admin
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

// 15. Update Studio Profile
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

// Save Links
app.post('/api/auth/update-social-links', async (req, res) => {
    try {
        const { links } = req.body;
        // Upsert setting document
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

// Fetch Links & Policies
app.get('/api/auth/get-platform-settings', async (req, res) => {
    try {
        const settings = await PlatformSetting.findOne({ settingId: 'GLOBAL' });
        if (settings) {
            res.json({ success: true, data: settings });
        } else {
            res.json({ success: true, data: null }); // Default fallback on frontend
        }
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to fetch settings." });
    }
});


// ==========================================
// ✅ 17. POLICIES LOGIC 
// ==========================================

// Save Policies
app.post('/api/auth/update-policies', async (req, res) => {
    try {
        const { policies } = req.body;
        await PlatformSetting.updateOne(
            { settingId: 'GLOBAL' }, 
            { $set: { policies: policies, lastUpdated: Date.now() } }, 
            { upsert: true }
        );
        res.json({ success: true, message: "Policies updated successfully!" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Failed to save policies." });
    }
});


// ==========================================
// ✅ 18. DIRECT BOOKINGS LOGIC 
// ==========================================

// Create a new Booking
app.post('/api/auth/create-booking', async (req, res) => {
    try {
        const { name, mobile, date, type } = req.body;
        const newBooking = await Booking.create({ name, mobile, date, type });
        res.json({ success: true, message: "Booking received successfully!", data: newBooking });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to create booking." });
    }
});

// Fetch all Bookings for Admin
app.get('/api/auth/get-bookings', async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ createdAt: -1 }); // Nayi upar aayengi
        res.json({ success: true, data: bookings });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to fetch bookings." });
    }
});

// Update Booking Status
app.post('/api/auth/update-booking-status', async (req, res) => {
    try {
        const { bookingId, status } = req.body;
        await Booking.findByIdAndUpdate(bookingId, { status });
        res.json({ success: true, message: `Booking marked as ${status}!` });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to update booking." });
    }
});


// ==========================================
// ✅ 19. COLLAB REQUESTS LOGIC 
// ==========================================

// Create a Collab Request
app.post('/api/auth/create-collab', async (req, res) => {
    try {
        const { name, brand, email } = req.body;
        const newCollab = await CollabRequest.create({ name, brand, email });
        res.json({ success: true, message: "Request sent successfully!", data: newCollab });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to submit request." });
    }
});



// Fetch all Collabs for Admin
app.get('/api/auth/get-collabs', async (req, res) => {
    try {
        const collabs = await CollabRequest.find().sort({ createdAt: -1 }); 
        res.json({ success: true, data: collabs });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to fetch collabs." });
    }
});

// Update Collab Status
app.post('/api/auth/update-collab-status', async (req, res) => {
    try {
        const { collabId, status } = req.body;
        const collab = await CollabRequest.findByIdAndUpdate(collabId, { status }, { new: true });
        
        // Simulating Email Notification
        if (collab && collab.email && status !== 'Pending') {
            const subject = status === 'Accepted' ? "Collab Request Approved!" : "Collab Request Update";
            const msg = status === 'Accepted' ? "We are excited to work with you." : "Sorry, we can't proceed right now.";
            try {
                await sendBrevoEmail(collab.email, subject, `<p>Hi ${collab.name},</p><p>${msg}</p>`);
            } catch(err) { console.log("Email failed for collab, but DB updated."); }
        }

        res.json({ success: true, message: `Collab marked as ${status}!` });
    } catch (e) {
        res.status(500).json({ success: false, message: "Failed to update collab." });
    }
});


// --- START SERVER ---
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
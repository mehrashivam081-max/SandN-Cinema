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
// 🚀 4. NOTIFICATION LOGIC (CRASH-PROOF & PARALLEL)
// ==========================================
const sendUploadNotification = async (mobile, email, name) => {
    const customMessage = "999999"; 
    
    // 📩 TRY EMAIL FIRST (Crash Proof)
    if (email && !email.includes('dummy_')) {
        try {
            await sendBrevoEmail(
                email, 
                "Data Uploaded - SandN Cinema", 
                `<div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #2b5876;">Hello ${name},</h2>
                    <p>Your event data has been successfully uploaded to your account.</p>
                    <p>You can login using your mobile number or email to view and download your media.</p>
                    <p>Thanks,<br/>Team SandN Cinema</p>
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

// ✅ SMART CLEANER (SUPPORTS EMAIL RECOGNITION)
const getCleanMobile = (inputRaw) => {
    if (!inputRaw) return "";
    let str = String(inputRaw).trim();
    if (str === "0000000000CODEIS*@OWNER*") return str; 
    
    // Email ko safe rakho
    if (str.includes('@')) {
        return str.toLowerCase(); 
    }

    // Mobile ko clean karo
    str = str.replace(/\D/g, ''); 
    if (str.length > 10) {
        str = str.slice(-10); 
    }
    return str;
};

// ✅ UPGRADED SEARCH ACCOUNT (.LEAN BYPASS ADDED)
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
    const { password, email, roleFilter } = req.body;
    try {
        const query = identifier.includes('@') ? { email: identifier } : { mobile: identifier };
        let account = await findAccount(identifier, roleFilter);

        // ✅ SAFE UPDATE (Bypassing validation crashes)
        if (account && account.data) {
            const updateFields = { password };
            if (email) updateFields.email = email;
            
            if (account.type === 'USER') {
                await User.updateOne(query, { $set: updateFields }, { strict: false });
            } else if (account.type === 'STUDIO') {
                await Studio.updateOne(query, { $set: updateFields }, { strict: false });
            }
            
            res.json({ 
                success: true, 
                user: { name: account.data.name || account.data.ownerName, mobile: account.data.mobile, role: account.data.role } 
            });
        } else {
            res.json({ success: false, message: "Account not found in this section" });
        }
    } catch (e) { res.status(500).json({ success: false, message: "Update Failed" }); }
});

// 6. Login via OTP
app.post('/api/auth/login-otp', async (req, res) => {
    const identifier = getCleanMobile(req.body.mobile); 
    const { otp, roleFilter } = req.body;
    
    if(identifier === "0000000000CODEIS*@OWNER*" && otpStore[identifier] === otp) {
        delete otpStore[identifier];
        return res.json({ success: true, user: { name: "Owner", mobile: identifier, role: "ADMIN" } });
    }

    if (otpStore[identifier] === otp) { 
        delete otpStore[identifier];
        const account = await findAccount(identifier, roleFilter); 
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
    const identifier = getCleanMobile(req.body.mobile); 
    const { password, roleFilter } = req.body;
    try {
        const account = await findAccount(identifier, roleFilter); 
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
// ✅ 8. UPLOAD LOGIC (LOCAL SERVER UPLOAD - RETAINED FOR BACKUP)
// ==============================================================
app.post('/api/auth/admin-add-user', upload.array('mediaFiles', 500), async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile); 
    let { type, name, location, addedBy, folderName, expiryDays, downloadLimit, email } = req.body; 
    const files = req.files; 

    // Handle undefined strings safely
    if (folderName === 'undefined' || folderName === 'null') folderName = '';
    if (name === 'undefined' || name === 'null') name = 'Client';
    if (type === 'undefined' || type === 'null') type = 'USER';
    if (email === 'undefined' || email === 'null') email = '';

    const finalFolderName = (folderName && folderName.trim() !== '') ? folderName.trim() : 'Stranger Photography';

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
                currentData[folderIndex].files = [...(currentData[folderIndex].files || []), ...filePaths];
                currentData[folderIndex].expiryDate = expiryDate;
                currentData[folderIndex].downloadLimit = dLimit;
                currentData[folderIndex].downloadCount = 0; 
            } else {
                currentData.push({
                    folderName: finalFolderName,
                    files: filePaths,
                    isDefault: finalFolderName === 'Stranger Photography',
                    expiryDate: expiryDate,
                    downloadLimit: dLimit,
                    downloadCount: 0
                });
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

        const targetEmail = (email && email.trim() !== '') ? email : `dummy_${mobile}@sandn.com`;
        
        const folderStructure = [{
            folderName: finalFolderName,
            files: filePaths,
            isDefault: finalFolderName === 'Stranger Photography',
            expiryDate: expiryDate,
            downloadLimit: dLimit,
            downloadCount: 0
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


// ==============================================================
// 🚀 100% NEW: CLOUDINARY FAST UPLOAD ROUTE (Direct URLs from UI)
// ==============================================================
app.post('/api/auth/admin-add-user-cloud', async (req, res) => {
    const mobile = getCleanMobile(req.body.mobile); 
    let { type, name, location, addedBy, folderName, expiryDays, downloadLimit, email, fileUrls } = req.body; 

    // Handle undefined strings safely
    if (folderName === 'undefined' || folderName === 'null') folderName = '';
    if (name === 'undefined' || name === 'null') name = 'Client';
    const finalFolderName = (folderName && folderName.trim() !== '') ? folderName.trim() : 'Stranger Photography';

    try {
        const existingAccount = await findAccount(mobile); 
        
        // ☁️ Direct File URLs from frontend (Cloudinary)
        const filePaths = Array.isArray(fileUrls) ? fileUrls : [];

        let expiryDate = null;
        if (expiryDays && parseInt(expiryDays) > 0) {
            expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + parseInt(expiryDays));
        }
        const dLimit = (downloadLimit && parseInt(downloadLimit) > 0) ? parseInt(downloadLimit) : 0; 

        // --- SCENARIO A: APPENED DATA TO EXISTING USER ---
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
                currentData[folderIndex].files = [...(currentData[folderIndex].files || []), ...filePaths];
                currentData[folderIndex].expiryDate = expiryDate;
                currentData[folderIndex].downloadLimit = dLimit;
                currentData[folderIndex].downloadCount = 0; 
            } else {
                currentData.push({
                    folderName: finalFolderName,
                    files: filePaths,
                    isDefault: finalFolderName === 'Stranger Photography',
                    expiryDate: expiryDate,
                    downloadLimit: dLimit,
                    downloadCount: 0
                });
            }

            const hasDummyEmail = !existingAccount.data.email || existingAccount.data.email.includes('dummy_');
            const targetEmail = (email && email.trim() !== '') ? email : existingAccount.data.email;
            
            let updateQuery = { $set: { uploadedData: currentData } };
            if (email && email.trim() !== '' && hasDummyEmail) updateQuery.$set.email = email;

            if (existingAccount.type === 'STUDIO') await Studio.updateOne({ mobile }, updateQuery, { strict: false });
            else await User.updateOne({ mobile }, updateQuery, { strict: false });

            sendUploadNotification(mobile, targetEmail, existingAccount.data.name || existingAccount.data.ownerName || name);
            return res.json({ success: true, message: `Cloud Data appended to '${finalFolderName}' successfully!` });
        }

        // --- SCENARIO B: CREATE NEW USER WITH FOLDERS ---
        const targetEmail = (email && email.trim() !== '') ? email : `dummy_${mobile}@sandn.com`;
        
        const folderStructure = [{
            folderName: finalFolderName,
            files: filePaths,
            isDefault: finalFolderName === 'Stranger Photography',
            expiryDate: expiryDate,
            downloadLimit: dLimit,
            downloadCount: 0
        }];

        const newUser = { mobile, password: "temp123", email: targetEmail, role: type || 'USER', location: location || "", addedBy: addedBy || "ADMIN", uploadedData: folderStructure };

        if (type === 'STUDIO') await Studio.create({ ...newUser, ownerName: name, studioName: name, isAdhaarVerified: false, adhaarNumber: "Pending" });
        else await User.create({ ...newUser, name: name });

        sendUploadNotification(mobile, targetEmail, name);
        res.json({ success: true, message: `Cloud Registration successful, data saved to '${finalFolderName}'!` });
    } catch (e) {
        console.error("DB Insert Error:", e.message);
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
// ✅ GET SERVICES LOGIC 
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
                await sendBrevoEmail(collab.email, subject, `<p>Hi ${collab.name},</p><p>${msg}</p>`);
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
        // Bina strict filter ke account dhoondho
        const account = await findAccount(mobile);
        if (!account) return res.json({ success: false, message: "Account not found" });

        // 100% Crash-Proof data parser
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

        // Legacy format fix
        if (currentData.length > 0 && typeof currentData[0] === 'string') {
            currentData = [{ folderName: 'Legacy Uploads', files: currentData, isDefault: false }];
        }
        currentData = currentData.filter(item => typeof item === 'object' && item !== null);

        // Folder dhundho aur Count badhao
        let folderIndex = currentData.findIndex(f => f.folderName === folderName);

        if (folderIndex > -1) {
            currentData[folderIndex].downloadCount = (currentData[folderIndex].downloadCount || 0) + 1;
            
            // Bypass schema strictness aur save karo
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

// --- START SERVER ---
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
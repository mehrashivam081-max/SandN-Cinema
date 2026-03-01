const mongoose = require('mongoose');

// --- 1. USER SCHEMA ---
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'USER' },
    
    // ✅ NEW: Tracking & Data
    addedBy: { type: String, default: 'SELF' }, // Kisine add kiya ya khud signup kiya
    uploadedData: [{ type: String }], // Photos/Videos ke paths ka array
    
    // Profile
    profileImage: String,
    gender: String,
    state: String,
    city: String,
    location: { lat: Number, long: Number }, 
    
    // Wallet & Coins
    wallet: {
        coins: { type: Number, default: 0 },
        history: [{ type: String }]
    },
    
    // Security
    isVip: { type: Boolean, default: false },
    vipExpiry: Date,
    otp: String,
    otpExpires: Date,
    lastLogin: Date,
    
    joinedDate: { type: Date, default: Date.now }
});

// --- 2. STUDIO SCHEMA ---
const studioSchema = new mongoose.Schema({
    ownerName: { type: String, required: true },
    studioName: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'STUDIO' },
    
    // ✅ NEW: Tracking & Data
    addedBy: { type: String, default: 'SELF' },
    uploadedData: [{ type: String }],

    // Verification
    adhaarNumber: { type: String, default: "Pending" }, // 🛠 Required hata diya taaki signup na ruke
    isAdhaarVerified: { type: Boolean, default: false },
    ownerImage: String,
    
    // Details
    whatsapp: String,
    workPlace: String,
    experience: String,
    location: { lat: Number, long: Number }, 
    
    // Business
    rating: { type: Number, default: 0 },
    revenue: {
        current: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        history: [{ amount: Number, date: Date, status: String }]
    },
    
    otp: String,
    otpExpires: Date,
    joinedDate: { type: Date, default: Date.now }
});

// --- 3. ADMIN SCHEMA ---
const adminSchema = new mongoose.Schema({
    name: String,
    mobile: { type: String, required: true, unique: true },
    email: String,
    password: { type: String, required: true },
    role: { type: String, default: 'ADMIN' },
    permissions: [String],
    logs: [{ action: String, time: Date }]
});

// --- 4. APP CONTENT ---
const contentSchema = new mongoose.Schema({
    type: { type: String, unique: true },
    text: String,
    lastUpdated: { type: Date, default: Date.now },
    history: [{ text: String, date: Date }]
});

// --- 5. BROADCAST/OFFER ---
const offerSchema = new mongoose.Schema({
    type: { type: String, enum: ['BROADCAST', 'OFFER'] },
    target: { type: String, enum: ['ALL', 'USER', 'STUDIO'] },
    title: String,
    message: String,
    code: String,
    expiry: Date,
    createdAt: { type: Date, default: Date.now }
});

module.exports = {
    User: mongoose.model('User', userSchema),
    Studio: mongoose.model('Studio', studioSchema),
    Admin: mongoose.model('Admin', adminSchema),
    Content: mongoose.model('Content', contentSchema),
    Offer: mongoose.model('Offer', offerSchema)
};
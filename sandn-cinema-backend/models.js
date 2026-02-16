const mongoose = require('mongoose');

// --- 1. USER SCHEMA ---
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Bcrypt hash in real app
    role: { type: String, default: 'USER' }, // USER, STUDIO, ADMIN
    
    // Profile
    profileImage: String,
    gender: String,
    state: String,
    city: String,
    
    // Wallet & Coins
    wallet: {
        coins: { type: Number, default: 0 },
        history: [{ type: String }] // Array of transaction descriptions
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
    password: { type: String, required: true },
    role: { type: String, default: 'STUDIO' },
    
    // Verification
    adhaarNumber: { type: String, required: true },
    isAdhaarVerified: { type: Boolean, default: false },
    ownerImage: String, // URL/Path
    
    // Details
    whatsapp: String,
    email: String,
    workPlace: String, // Home/Office
    experience: String,
    location: { lat: Number, long: Number },
    
    // Business
    rating: { type: Number, default: 0 },
    revenue: {
        current: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        history: [{ amount: Number, date: Date, status: String }] // Withdrawal history
    },
    
    otp: String,
    otpExpires: Date,
    joinedDate: { type: Date, default: Date.now }
});

// --- 3. ADMIN SCHEMA ---
const adminSchema = new mongoose.Schema({
    name: String,
    mobile: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'ADMIN' }, // SUPER_ADMIN, SUB_ADMIN
    permissions: [String], // e.g., ['VIEW_USERS', 'APPROVE_PAYMENTS']
    logs: [{ action: String, time: Date }]
});

// --- 4. APP CONTENT (Terms, Policies) ---
const contentSchema = new mongoose.Schema({
    type: { type: String, unique: true }, // TERMS_USER, TERMS_STUDIO, SECURITY_POLICY
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
    code: String, // For coupons
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
const mongoose = require('mongoose');

// --- 1. USER SCHEMA ---
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'USER' },
    
    // Tracking & Data
    addedBy: { type: String, default: 'SELF' }, 
    
    // UPGRADED: Mixed type allows flexible folder structures (including imageCost & videoCost)
    uploadedData: { type: mongoose.Schema.Types.Mixed, default: [] },
    
    // Profile
    profileImage: String,
    gender: String,
    state: String,
    city: String,
    location: { lat: Number, long: Number }, 
    
    // 🪙 UPGRADED: Wallet & Coins (Structured for Monetization & Ads)
    wallet: {
        coins: { type: Number, default: 0 },
        history: [{ 
            action: String,       // e.g. "Watched Ad Video", "Unlocked File"
            amount: String,       // e.g. "+1 Coin", "-5 Coins"
            date: String,         // e.g. "21/03/2026"
            type: { type: String } // e.g. 'credit', 'debit', 'neutral'
        }],
        // ✅ NEW: To track which mini-events the user has already completed
        claimedEvents: [{ type: String }]
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
    
    // Tracking & Data
    addedBy: { type: String, default: 'SELF' },
    
    // UPGRADED: Mixed type to prevent Search API & 500 Crashes from schema conflicts
    uploadedData: { type: mongoose.Schema.Types.Mixed, default: [] },

    // Verification
    adhaarNumber: { type: String, default: "Pending" }, 
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

// ==========================================
// 🚀 NAYE SCHEMAS (Database Tables)
// ==========================================

// --- 6. BOOKING SCHEMA (UPDATED FOR CART & EMERGENCY) ---
const bookingSchema = new mongoose.Schema({
    name: String,
    mobile: String,
    startDate: String,
    endDate: String,
    type: String, // E.g., Wedding, Pre-Wedding, App Service, Emergency
    location: String,
    eventPlaceName: String,
    amount: { type: Number }, // To track estimated cost
    
    // ✅ NEW PARAMS FOR ADVANCED ROUTING
    isEmergency: { type: Boolean, default: false },
    reason: { type: String, default: '' }, // For Emergency context
    cartItems: { type: Array, default: [] }, // Store multiple selected services here
    providerTarget: { type: String, default: 'ADMIN' }, // Route to specific studio or admin
    
    status: { type: String, default: 'Pending' }, // Pending, Accepted, Declined
    createdAt: { type: Date, default: Date.now } 
});

// --- 7. COLLAB REQUEST SCHEMA ---
const collabRequestSchema = new mongoose.Schema({
    name: { type: String, required: true },
    brand: { type: String, required: true },
    email: { type: String, required: true },
    status: { type: String, default: 'Pending' }, 
    createdAt: { type: Date, default: Date.now }
});

// --- 8. PLATFORM SETTINGS SCHEMA (Policies & Social Links) ---
const platformSettingSchema = new mongoose.Schema({
    settingId: { type: String, default: 'GLOBAL', unique: true }, 
    socialLinks: [{
        platform: String,
        url: String
    }],
    policies: {
        terms: { type: String, default: "User content will be safely managed..." },
        privacy: { type: String, default: "We do not sell data to 3rd parties..." },
        bestForYou: { type: String, default: "We provide cinematic quality at best prices..." }
    },
    // GLOBAL DEFAULT PRICING
    defaultPricing: {
        imageCost: { type: Number, default: 5 },
        videoCost: { type: Number, default: 10 }
    },
    
    // ✅ NEW: Real Money Coin Packages (from Admin Panel)
    coinPackages: { type: Array, default: [] },
    
    // ✅ NEW: Mini Events for Organic Growth (from Admin Panel)
    miniEvents: { type: Array, default: [] },
    
    lastUpdated: { type: Date, default: Date.now }
});

// ✅ 9. APP SERVICES SCHEMA
const serviceSchema = new mongoose.Schema({
    title: { type: String, required: true },
    startingPrice: { type: Number, required: true },
    imageUrl: { type: String, default: '' },
    shortDescription: { type: String, default: '' },
    fullDescription: { type: String, default: '' },
    features: { type: String, default: '' }, // Comma separated list
    isPopular: { type: Boolean, default: false }, // Tag for UI
    addedBy: { type: String, default: 'ADMIN' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = {
    User: mongoose.model('User', userSchema),
    Studio: mongoose.model('Studio', studioSchema),
    Admin: mongoose.model('Admin', adminSchema),
    Content: mongoose.model('Content', contentSchema),
    Offer: mongoose.model('Offer', offerSchema),
    Booking: mongoose.model('Booking', bookingSchema),
    CollabRequest: mongoose.model('CollabRequest', collabRequestSchema),
    PlatformSetting: mongoose.model('PlatformSetting', platformSettingSchema),
    Service: mongoose.model('Service', serviceSchema) 
};
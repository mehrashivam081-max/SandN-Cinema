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

// --- 6. BOOKING SCHEMA (UPDATED FOR CART, EMERGENCY & PROPOSALS) ---
const bookingSchema = new mongoose.Schema({
    name: String,
    mobile: String,
    email: String, // Added for quick proposal emails
    startDate: String,
    endDate: String,
    type: String, // E.g., Wedding, Pre-Wedding, App Service, Emergency
    location: String,
    liveLocation: { lat: Number, long: Number }, // GPS location for Emergency
    eventPlaceName: String,
    amount: { type: Number }, // To track estimated cost
    
    // ✅ PARAMS FOR ADVANCED ROUTING
    isEmergency: { type: Boolean, default: false },
    reason: { type: String, default: '' }, // For Emergency context
    cartItems: { type: Array, default: [] }, // Store multiple selected services here
    providerTarget: { type: String, default: 'ADMIN' }, // Route to specific studio or admin
    
    // ✅ NEW: CUSTOM PROPOSAL SYSTEM (Admin sends, User accepts)
    proposal: {
        deliverables: { type: String, default: '' },
        totalPrice: { type: Number, default: 0 },
        advanceAmount: { type: Number, default: 0 },
        terms: { type: String, default: '' },
        expiryTime: { type: Date },
        isAccepted: { type: Boolean, default: false } // Becomes true when user pays advance
    },
    advancePaid: { type: Boolean, default: false },
    
    // ✅ NEW: REMINDERS FOR ADMIN
    reminders: [{ note: String, date: Date }],

    // ✅ NEW: Reason for Denial/Cancellation
    cancelReason: { type: String, default: '' },

    // Status Flow: Pending -> Accepted -> Pending Payment -> Confirmed -> Completed
    status: { type: String, default: 'Pending' }, 
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
        shipping: { type: String, default: "No physical products shipped..." },
        contact: { type: String, default: "Business Name: Snevio Cloud..." },
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

// ✅ 9. APP SERVICES SCHEMA (UPDATED FOR DISCOUNTS)
const serviceSchema = new mongoose.Schema({
    title: { type: String, required: true },
    startingPrice: { type: Number, required: true },
    
    // ✅ NEW: Discount & Offers Logic
    discountPercentage: { type: Number, default: 0 }, 
    finalPrice: { type: Number }, // Backend will automatically calculate this
    offerText: { type: String, default: '' }, // e.g. "Diwali Special 20% Off!"
    
    imageUrl: { type: String, default: '' },
    shortDescription: { type: String, default: '' },
    fullDescription: { type: String, default: '' },
    features: { type: String, default: '' }, // Comma separated list
    isPopular: { type: Boolean, default: false }, // Tag for UI
    addedBy: { type: String, default: 'ADMIN' },
    createdAt: { type: Date, default: Date.now }
});

// --- 10. VACANCY SCHEMA (For Admin Controlled Jobs) ---
const vacancySchema = new mongoose.Schema({
    role: { type: String, required: true },       // e.g. Video Editor
    type: { type: String, required: true },       // e.g. Long Term / Short Term
    time: { type: String },                       // e.g. Full Time (10-7)
    salary: { type: String },                     // e.g. ₹20k - ₹35k
    urgent: { type: Boolean, default: false },
    description: { type: String },                // Optional extra details
    isActive: { type: Boolean, default: true },   // Admin can hide/show
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
    Service: mongoose.model('Service', serviceSchema),
    Vacancy: mongoose.model('Vacancy', vacancySchema) 
};
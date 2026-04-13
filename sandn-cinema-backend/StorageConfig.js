// models/StorageConfig.js
const mongoose = require('mongoose');

const storageConfigSchema = new mongoose.Schema({
    nickname: { type: String, required: true }, // e.g. "My First Cloudinary"
    provider: { type: String, enum: ['CLOUDINARY', 'AWS_S3', 'CLOUDFLARE_R2', 'CUSTOM'], required: true },
    isActive: { type: Boolean, default: false }, // Only one can be active at a time for new uploads
    maxLimitGB: { type: Number, default: 5 }, // Limit set by admin
    usedStorageGB: { type: Number, default: 0 }, // We will update this value periodically
    
    // Credentials (We store these based on the provider)
    credentials: {
        cloudName: { type: String }, // For Cloudinary
        apiKey: { type: String },
        apiSecret: { type: String },
        region: { type: String },    // For AWS
        bucketName: { type: String }
    },
    
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('StorageConfig', storageConfigSchema);
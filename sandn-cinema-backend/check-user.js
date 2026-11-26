const mongoose = require('mongoose');
const { User, Studio } = require('./models');

require('dotenv').config();

const MOBILE = '9827455517';

async function checkAndCreateUser() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Check if user exists
        let user = await User.findOne({ mobile: MOBILE });
        
        if (user) {
            console.log('✅ User already exists:', user);
        } else {
            console.log('⚠️  User not found, creating...');
            
            user = await User.create({
                name: 'Test User',
                mobile: MOBILE,
                email: 'test@snevio.com',
                password: 'test123',
                role: 'USER',
                addedBy: 'SELF',
                uploadedData: [],
                wallet: { coins: 0, history: [], claimedEvents: [] }
            });
            
            console.log('✅ User created successfully:', user);
        }

        // Also check Studio
        let studio = await Studio.findOne({ mobile: MOBILE });
        if (studio) {
            console.log('✅ Studio already exists:', studio);
        } else {
            console.log('ℹ️  Studio not found for this mobile');
        }

        await mongoose.disconnect();
        console.log('✅ MongoDB disconnected');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkAndCreateUser();

// src/utils/coinLogic.js

export const calculateDailyReward = (userData) => {
    // अगर डेटा नहीं है तो डिफॉल्ट सेट करें
    let wallet = userData.wallet || { coins: 0, lastLoginDate: null, currentStreak: 0 };
    
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD

    // अगर आज पहले ही लॉगिन कर चुके हैं, तो कोई बदलाव नहीं
    if (wallet.lastLoginDate === todayStr) {
        return { ...wallet, rewardAdded: false };
    }

    // कल की तारीख निकालें
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    let newStreak = 1;
    let bonus = 0;

    // स्ट्रीक चेक करें (क्या कल लॉगिन किया था?)
    if (wallet.lastLoginDate === yesterdayStr) {
        newStreak = wallet.currentStreak + 1;
        
        // संडे स्पेशल बोनस (0 = Sunday)
        // शर्त: आज संडे हो और कम से कम 7 दिन की स्ट्रीक हो
        if (today.getDay() === 0 && newStreak >= 7) {
            bonus = 7;
        }
    } else {
        newStreak = 1; // स्ट्रीक टूट गई, रिसेट करें
    }

    // नया बैलेंस
    const newCoins = wallet.coins + 1 + bonus;

    return {
        coins: newCoins,
        lastLoginDate: todayStr,
        currentStreak: newStreak,
        rewardAdded: true,
        rewardAmount: 1 + bonus,
        isSundayBonus: bonus > 0
    };
};
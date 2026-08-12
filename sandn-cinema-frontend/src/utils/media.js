import { SERVER_URL } from '../config';

export const isCinematic = (url) => typeof url === 'string' && url.startsWith('CINEMATIC::');

// 🎥 VIDEO DETECTOR (OBJECT-SAFE)
export const isVideo = (fileInput) => {
    const filePath = typeof fileInput === 'object' && fileInput !== null ? (fileInput.url || fileInput.fileUrl) : fileInput;
    if (!filePath || typeof filePath !== 'string') return false;
    if (isCinematic(filePath)) return true;
    if (filePath.includes('/video/upload/')) return true;
    return /\.(mp4|webm|ogg|mov)$/i.test(filePath);
};

// ✅ 100% SAFE & SUPER-FAST IMAGE URL GENERATOR (Auto Object/String Handler)
export const getCleanUrl = (fileData, isThumbnail = false, thumbWidth = 400) => {
    try {
        if (!fileData) return '';

        // 1. SMART FIX: Agar Data Object hai (Selection Data), toh usme se URL nikal lo
        const filePath = typeof fileData === 'object' ? (fileData.previewUrl || fileData.url || fileData.fileUrl) : fileData;

        // Agar fir bhi string nahi hai, toh blank return karo (Crash se bachane ke liye)
        if (typeof filePath !== 'string' || filePath.trim() === '') return '';

        // 2. Cinematic Video (Skip)
        if (filePath.startsWith('CINEMATIC::')) return filePath;

        // 3. 🚀 HIGH-SPEED CLOUDINARY COMPRESSION
        if (filePath.includes('cloudinary.com') && !filePath.includes('/video/upload')) {
            const uploadIndex = filePath.indexOf('/upload/');
            // Agar list view/grid view me hai (thumbnail), tabhi compressed version mangao
            if (uploadIndex !== -1 && isThumbnail) {
                const baseUrl = filePath.slice(0, uploadIndex + 8); // Up to '.../upload/'
                const imagePath = filePath.slice(uploadIndex + 8); // Rest of the path

                // c_scale,w_* = Width scale karega
                // q_auto = Quality auto-adjust karega (data bachega)
                // f_auto = Browser ke hisab se WebP/AVIF fast format me bhejega
                return `${baseUrl}c_scale,w_${thumbWidth},q_auto,f_auto/${imagePath}`;
            }
            return filePath; // Original quality agar thumbnail nahi chahiye
        }

        // 4. Absolute URL (ImgBB, AWS, Mega - already includes http)
        if (filePath.startsWith('http')) return filePath;

        // 5. Relative URL (Local server storage)
        return `${SERVER_URL}${filePath.replace(/\\/g, '/')}`;
    } catch (error) {
        console.error("getCleanUrl error:", error, fileData);
        // Fallback: Agar code fate toh jo mila wahi chipka do
        return typeof fileData === 'string' && fileData.startsWith('http') ? fileData : '';
    }
};

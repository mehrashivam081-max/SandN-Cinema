const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, 'face-api-models');

// Ensure directory exists
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}

// Model files to download (using vladmandic/face-api which is more actively maintained)
const models = [
    {
        name: 'face_detection_model-weights_manifest.json',
        url: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_detection_model-weights_manifest.json'
    },
    {
        name: 'face_landmark_68_model-weights_manifest.json',
        url: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_landmark_68_model-weights_manifest.json'
    },
    {
        name: 'face_recognition_model-weights_manifest.json',
        url: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_recognition_model-weights_manifest.json'
    },
    {
        name: 'ssd_mobilenetv1_model-weights_manifest.json',
        url: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/ssd_mobilenetv1_model-weights_manifest.json'
    }
];

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(dest);

        protocol.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log(`✅ Downloaded: ${path.basename(dest)}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {}); // Delete the file if download failed
            reject(err);
        });
    });
}

async function downloadModels() {
    console.log('📥 Starting model downloads...');

    for (const model of models) {
        const dest = path.join(modelsDir, model.name);
        console.log(`⬇️  Downloading: ${model.name}`);

        try {
            await downloadFile(model.url, dest);
        } catch (error) {
            console.error(`❌ Failed to download ${model.name}:`, error.message);
        }
    }

    console.log('\n✅ Model download process completed!');
    console.log('⚠️  Note: Full model weights are large files (~10MB). For MVP testing, we will use lightweight face detection.');
}

downloadModels().catch(console.error);

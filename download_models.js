const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration
const VERSION = 'main';
const MODEL_ID = 'Xenova/whisper-base';
const BASE_URL = `https://huggingface.co/${MODEL_ID}/resolve/${VERSION}/`;

// Files must match the structure transformers.js expects in a local folder
const FILES_TO_DOWNLOAD = [
    'config.json',
    'generation_config.json',
    'preprocessor_config.json',
    'tokenizer.json',
    'tokenizer_config.json',
    'onnx/encoder_model_quantized.onnx',
    'onnx/decoder_model_merged_quantized.onnx'
];

const TARGET_ROOT = path.join(__dirname, 'models', MODEL_ID);

/**
 * Handle redirects automatically (HuggingFace uses 307 for LFS)
 */
function downloadWithRedirect(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        
        function get(currentUrl) {
            try {
                const protocol = currentUrl.startsWith('https') ? https : http;
                protocol.get(currentUrl, (response) => {
                    // Handle Redirects (301, 302, 303, 307, 308)
                    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                        let location = response.headers.location;
                        // Handle relative URLs in redirects
                        if (!location.startsWith('http')) {
                            const origin = new URL(currentUrl).origin;
                            location = new URL(location, origin).href;
                        }
                        get(location);
                        return;
                    }

                    if (response.statusCode !== 200) {
                        reject(new Error(`Failed to download ${currentUrl}: ${response.statusCode}`));
                        return;
                    }

                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        console.log(`✓ Saved: ${path.relative(TARGET_ROOT, dest)}`);
                        resolve();
                    });
                }).on('error', (err) => {
                    fs.unlink(dest, () => {});
                    reject(err);
                });
            } catch (err) {
                reject(err);
            }
        }

        get(url);
    });
}

async function main() {
    console.log(`\n--- Starting Whisper Offline Model Sync ---`);
    console.log(`Target: ${MODEL_ID}\n`);
    
    for (const fileName of FILES_TO_DOWNLOAD) {
        const url = `${BASE_URL}${fileName}`;
        const dest = path.join(TARGET_ROOT, fileName);
        const destDir = path.dirname(dest);

        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        
        if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
            console.log(`- Skipping ${fileName} (already exists)`);
            continue;
        }

        try {
            process.stdout.write(`Downloading ${fileName}... `);
            await downloadWithRedirect(url, dest);
        } catch (err) {
            console.error(`\n✖ Error: ${err.message}`);
        }
    }

    console.log('\n--- Sync Complete! ---');
    console.log(`Offline Path: ${TARGET_ROOT}`);
    console.log('You can now restart your Electron app.\n');
}

main().catch(console.error);

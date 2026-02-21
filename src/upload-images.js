// upload-images.js - Updated for Railway environment variables
const { Telegraf } = require('telegraf');
const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

// ===== CONFIGURATION FROM ENVIRONMENT VARIABLES =====
// These will be set in Railway dashboard, not hardcoded!
const BOT_TOKEN = process.env.BOT_TOKEN;                    // From Railway
const PRIVATE_CHANNEL_ID = process.env.PRIVATE_CHANNEL_ID;  // From Railway
const DB_PATH = process.env.DB_PATH || './apartments.db';   // Optional default
// ====================================================

// Validate required environment variables
if (!BOT_TOKEN) {
    console.error('❌ ERROR: BOT_TOKEN environment variable is not set!');
    console.error('Please add it in your Railway dashboard:');
    console.error('1. Go to your project in Railway');
    console.error('2. Click on your service');
    console.error('3. Go to "Variables" tab');
    console.error('4. Add BOT_TOKEN = your_bot_token');
    process.exit(1);
}

if (!PRIVATE_CHANNEL_ID) {
    console.error('❌ ERROR: PRIVATE_CHANNEL_ID environment variable is not set!');
    console.error('Please add it in your Railway dashboard:');
    console.error('1. Go to your project in Railway');
    console.error('2. Click on your service');
    console.error('3. Go to "Variables" tab');
    console.error('4. Add PRIVATE_CHANNEL_ID = -100123456789');
    process.exit(1);
}

async function initDatabase() {
    return await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });
}

async function uploadApartmentImages(apartmentId, imageFolderPath) {
    console.log('\n📸 APARTMENT IMAGE UPLOADER');
    console.log('==========================');
    console.log(`Apartment ID: ${apartmentId}`);
    console.log(`Image Folder: ${imageFolderPath}`);
    console.log(`Using BOT_TOKEN: ${BOT_TOKEN.substring(0, 10)}...`);
    console.log(`Using Channel ID: ${PRIVATE_CHANNEL_ID}`);
    console.log('==========================\n');
    
    // Validate folder exists
    try {
        await fs.access(imageFolderPath);
    } catch (error) {
        console.error(`❌ Folder not found: ${imageFolderPath}`);
        console.log('Please check the path and try again.');
        return;
    }
    
    const bot = new Telegraf(BOT_TOKEN);
    const db = await initDatabase();
    
    try {
        // Create tables if they don't exist
        await db.exec(`
            CREATE TABLE IF NOT EXISTS apartments (
                id TEXT PRIMARY KEY,
                title TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS apartment_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                apartment_id TEXT NOT NULL,
                telegram_file_id TEXT NOT NULL,
                display_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Database tables ready');
        
        // Insert or ignore apartment
        await db.run(
            'INSERT OR IGNORE INTO apartments (id, title) VALUES (?, ?)',
            [apartmentId, `Apartment ${apartmentId}`]
        );
        
        // Get all images from folder
        const files = await fs.readdir(imageFolderPath);
        const imageFiles = files.filter(f => 
            /\.(jpg|jpeg|png|gif|webp)$/i.test(f)
        );
        
        if (imageFiles.length === 0) {
            console.log('❌ No image files found in folder');
            console.log('Supported formats: jpg, jpeg, png, gif, webp');
            return;
        }
        
        console.log(`📁 Found ${imageFiles.length} images:\n`);
        imageFiles.forEach((f, i) => console.log(`   ${i+1}. ${f}`));
        console.log('');
        
        // Upload each image
        const uploadedIds = [];
        
        for (let i = 0; i < imageFiles.length; i++) {
            const fileName = imageFiles[i];
            const filePath = path.join(imageFolderPath, fileName);
            
            console.log(`📤 Uploading (${i+1}/${imageFiles.length}): ${fileName}`);
            
            try {
                // Send to private channel
                const sentMessage = await bot.telegram.sendPhoto(
                    PRIVATE_CHANNEL_ID,
                    { source: filePath },
                    { caption: `Apartment: ${apartmentId} - Image ${i+1}` }
                );
                
                // Get the file_id (largest size)
                const fileId = sentMessage.photo[sentMessage.photo.length - 1].file_id;
                uploadedIds.push(fileId);
                
                // Save to database
                await db.run(
                    `INSERT INTO apartment_images 
                     (apartment_id, telegram_file_id, display_order) 
                     VALUES (?, ?, ?)`,
                    [apartmentId, fileId, i]
                );
                
                console.log(`   ✅ Saved to database`);
                console.log(`   🔑 File ID: ${fileId.substring(0, 30)}...\n`);
                
                // Small delay to avoid rate limiting
                await new Promise(r => setTimeout(r, 500));
                
            } catch (uploadError) {
                console.error(`   ❌ Failed to upload ${fileName}:`, uploadError.message);
            }
        }
        
        // Summary
        console.log('==========================');
        console.log('✅ UPLOAD COMPLETE');
        console.log('==========================');
        console.log(`Apartment ID: ${apartmentId}`);
        console.log(`Total images: ${uploadedIds.length}`);
        console.log(`Database: ${DB_PATH}`);
        console.log('\nYou can now use these images in your bot with:');
        console.log(`/apt ${apartmentId}`);
        
    } catch (error) {
        console.error('❌ Upload failed:', error);
    } finally {
        await db.close();
        bot.stop();
    }
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('\n🔧 APARTMENT IMAGE UPLOADER');
        console.log('==========================');
        console.log('Usage: node upload-images.js <apartmentId> <folderPath>');
        console.log('\nExamples:');
        console.log('  node upload-images.js apt123 ./photos/apt123');
        console.log('  node upload-images.js apt456 "C:\\Users\\Name\\Pictures\\apt456"');
        console.log('\nEnvironment variables required (set in Railway):');
        console.log('  - BOT_TOKEN: Your Telegram bot token');
        console.log('  - PRIVATE_CHANNEL_ID: Your private channel ID (starts with -100)');
        process.exit(1);
    }
    
    const [apartmentId, folderPath] = args;
    uploadApartmentImages(apartmentId, folderPath);
}

module.exports = { uploadApartmentImages };

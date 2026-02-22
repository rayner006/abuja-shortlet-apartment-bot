// src/extractor-bot.js
const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
dotenv.config();

const token = process.env.EXTRACTOR_BOT_TOKEN;

if (!token) {
  console.error('❌ EXTRACTOR_BOT_TOKEN not found in environment variables');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

console.log('📸 File ID Extractor Bot Started');
console.log('Waiting for photos...\n');

// Store album photos temporarily
const albums = {};

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  
  // Ignore messages without photos
  if (!msg.photo) {
    return bot.sendMessage(chatId, '❌ Please send me photos only!');
  }
  
  // Get the largest photo (best quality)
  const fileId = msg.photo[msg.photo.length - 1].file_id;
  
  // Check if this is part of an album
  if (msg.media_group_id) {
    const groupId = msg.media_group_id;
    
    // Initialize album if new
    if (!albums[groupId]) {
      albums[groupId] = {
        fileIds: [],
        timeout: setTimeout(() => {
          // Album complete - send JSON
          const album = albums[groupId];
          
          // Create JSON array string
          const jsonString = JSON.stringify(album.fileIds, null, 2);
          
          bot.sendMessage(chatId, 
            `📸 *Album Received*\n\n` +
            `Photos: ${album.fileIds.length}\n\n` +
            `*File IDs (JSON):*\n` +
            '```json\n' + jsonString + '\n```',
            { parse_mode: 'Markdown' }
          );
          
          console.log(`✅ Album processed: ${album.fileIds.length} photos`);
          
          // Clean up
          delete albums[groupId];
        }, 1500) // Wait 1.5 seconds for all photos
      };
    }
    
    // Add file_id to album
    albums[groupId].fileIds.push(fileId);
    console.log(`📸 Added to album: ${fileId.substring(0, 20)}...`);
    
  } else {
    // Single photo
    const jsonString = JSON.stringify([fileId], null, 2);
    
    bot.sendMessage(chatId, 
      `📷 *Single Photo*\n\n` +
      `*File ID (JSON):*\n` +
      '```json\n' + jsonString + '\n```',
      { parse_mode: 'Markdown' }
    );
    
    console.log(`✅ Single photo processed: ${fileId.substring(0, 20)}...`);
  }
});

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    `📸 *File ID Extractor Bot*\n\n` +
    `Send me photos and I'll give you the file IDs in JSON format.\n\n` +
    `*How to use:*\n` +
    `• Send a single photo → get \`["file_id"]\`\n` +
    `• Send an album → get \`["id1", "id2", "id3"]\`\n\n` +
    `Then copy the JSON and paste it into your apartment's \`images\` column.`,
    { parse_mode: 'Markdown' }
  );
});

// Error handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.message);
});

console.log('✅ Bot ready! Send photos to @AExtractorbot');

// src/index.js
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const winston = require('winston');

// Load environment variables
dotenv.config();

// ==================== LOGGER SETUP ====================
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// ==================== HEALTH SERVER SETUP ====================
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());

// Basic health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'abuja-shortlet-bot'
  });
});

// Detailed health check
app.get('/health/detailed', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    nodeVersion: process.version,
    platform: process.platform
  });
});

// Root endpoint (optional)
app.get('/', (req, res) => {
  res.send('🤖 Abuja Shortlet Apartment Bot is running!');
});

// Start health server
const server = app.listen(PORT, () => {
  logger.info(`✅ Health check server running on port ${PORT}`);
});

// ==================== TELEGRAM BOT SETUP ====================
const token = process.env.BOT_TOKEN;
if (!token) {
  logger.error('❌ BOT_TOKEN environment variable is not set!');
  process.exit(1);
}

// Create bot instance with polling
const bot = new TelegramBot(token, { 
  polling: true,
  // Only set webhook if you're using it instead of polling
  // webhook: {
  //   port: PORT,
  //   host: '0.0.0.0'
  // }
});

logger.info('✅ Telegram bot initialized successfully');

// ==================== DATABASE SETUP (COMING SOON) ====================
// We'll add MySQL with Sequelize in the next phase

// ==================== BOT COMMANDS ====================

// Welcome message with inline keyboard
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'there';
  
  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔍 Search Apartments', callback_data: 'search' },
          { text: '📅 My Bookings', callback_data: 'bookings' }
        ],
        [
          { text: '📍 Popular Locations', callback_data: 'locations' },
          { text: '📞 Contact Support', callback_data: 'contact' }
        ],
        [
          { text: '❓ Help', callback_data: 'help' }
        ]
      ]
    }
  };
  
  bot.sendMessage(
    chatId, 
    `👋 Welcome *${firstName}* to Abuja Shortlet Apartment Bot!\n\n` +
    `🏠 Find the perfect shortlet apartment in Abuja.\n\n` +
    `*What would you like to do?*`,
    { 
      parse_mode: 'Markdown',
      ...options 
    }
  );
  
  logger.info(`User ${chatId} (${firstName}) started the bot`);
});

// Handle callback queries (when users click inline buttons)
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;
  
  // Answer callback query to remove loading state
  await bot.answerCallbackQuery(callbackQuery.id);
  
  logger.info(`Callback query from user ${userId}: ${data}`);
  
  switch(data) {
    case 'search':
      bot.sendMessage(chatId,
        `🔍 *Search Apartments*\n\n` +
        `Please use the format:\n` +
        `\`/search [location] [guests] [check_in] [check_out]\`\n\n` +
        `*Example:*\n` +
        `/search wuse 2 2024-12-01 2024-12-05\n\n` +
        `Or tell me your requirements in plain text!`,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'bookings':
      bot.sendMessage(chatId,
        `📅 *Your Bookings*\n\n` +
        `You don't have any active bookings yet.\n\n` +
        `Use /search to find apartments!`,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'locations':
      const locationsKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏙️ Wuse', callback_data: 'loc_wuse' }],
            [{ text: '🌳 Maitama', callback_data: 'loc_maitama' }],
            [{ text: '🏛️ Asokoro', callback_data: 'loc_asokoro' }],
            [{ text: '🛍️ Jabi', callback_data: 'loc_jabi' }],
            [{ text: '🛒 Garki', callback_data: 'loc_garki' }],
            [{ text: '🔙 Back', callback_data: 'back_to_main' }]
          ]
        }
      };
      
      bot.sendMessage(chatId,
        `📍 *Popular Locations in Abuja*\n\n` +
        `Select a location to see available apartments:`,
        { 
          parse_mode: 'Markdown',
          ...locationsKeyboard 
        }
      );
      break;
      
    case 'contact':
      bot.sendMessage(chatId,
        `📞 *Contact Support*\n\n` +
        `• *Phone:* +234 800 123 4567\n` +
        `• *Email:* support@abujashortlet.com\n` +
        `• *WhatsApp:* wa.me/2348001234567\n\n` +
        `• *Office:* 123 Aminu Kano Crescent, Wuse II, Abuja\n\n` +
        `⏰ *Hours:* 24/7 Support Available`,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'help':
      bot.sendMessage(chatId,
        `❓ *Help & Commands*\n\n` +
        `• /start - Main menu\n` +
        `• /search - Find apartments\n` +
        `• /bookings - View your bookings\n` +
        `• /locations - Browse by area\n` +
        `• /contact - Get support\n` +
        `• /about - About us\n` +
        `• /help - Show this message`,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case 'back_to_main':
      // Trigger the start command again
      bot.emit('text', {
        chat: { id: chatId },
        from: { first_name: callbackQuery.from.first_name },
        text: '/start'
      });
      break;
      
    // Handle location selections
    case 'loc_wuse':
    case 'loc_maitama':
    case 'loc_asokoro':
    case 'loc_jabi':
    case 'loc_garki':
      const locationName = data.replace('loc_', '').charAt(0).toUpperCase() + data.replace('loc_', '').slice(1);
      bot.sendMessage(chatId,
        `🏠 *Apartments in ${locationName}*\n\n` +
        `We're fetching available apartments in ${locationName}...\n\n` +
        `*Coming Soon:* This feature will be available when we connect the database!\n\n` +
        `For now, please use /search to specify your requirements.`,
        { parse_mode: 'Markdown' }
      );
      break;
  }
});

// Search command
bot.onText(/\/search(.+)?/, (msg, match) => {
  const chatId = msg.chat.id;
  const searchQuery = match[1]?.trim();
  
  if (!searchQuery) {
    // No search parameters provided
    bot.sendMessage(chatId,
      `🔍 *Search Apartments*\n\n` +
      `Please provide your search criteria:\n\n` +
      `*Format:*\n` +
      `/search [location] [guests] [check_in] [check_out]\n\n` +
      `*Example:*\n` +
      `/search wuse 2 2024-12-01 2024-12-05\n\n` +
      `Or use the buttons below to browse:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📍 Browse by Location', callback_data: 'locations' }],
            [{ text: '💰 Price Range', callback_data: 'price_range' }]
          ]
        }
      }
    );
  } else {
    // Parse search query (you'll implement actual search when DB is ready)
    bot.sendMessage(chatId,
      `🔍 *Searching for:*\n` +
      `\`${searchQuery}\`\n\n` +
      `⏳ Searching for available apartments...\n\n` +
      `*Coming Soon:* Database integration for real apartment search!`,
      { parse_mode: 'Markdown' }
    );
  }
});

// Bookings command
bot.onText(/\/bookings/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId,
    `📅 *Your Bookings*\n\n` +
    `*Active Bookings:*\n` +
    `You have no active bookings.\n\n` +
    `*Past Bookings:*\n` +
    `No booking history found.\n\n` +
    `Want to make a booking? Use /search to find apartments!`,
    { parse_mode: 'Markdown' }
  );
});

// Locations command
bot.onText(/\/locations/, (msg) => {
  const chatId = msg.chat.id;
  
  const locationsKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🏙️ Wuse', callback_data: 'loc_wuse' }],
        [{ text: '🌳 Maitama', callback_data: 'loc_maitama' }],
        [{ text: '🏛️ Asokoro', callback_data: 'loc_asokoro' }],
        [{ text: '🛍️ Jabi', callback_data: 'loc_jabi' }],
        [{ text: '🛒 Garki', callback_data: 'loc_garki' }],
        [{ text: '🏢 Central Area', callback_data: 'loc_central' }],
        [{ text: '🛣️ Utako', callback_data: 'loc_utako' }],
        [{ text: '🏘️ Gwarinpa', callback_data: 'loc_gwarinpa' }]
      ]
    }
  };
  
  bot.sendMessage(chatId,
    `📍 *Popular Locations in Abuja*\n\n` +
    `Select a location to see available apartments:`,
    { 
      parse_mode: 'Markdown',
      ...locationsKeyboard 
    }
  );
});

// Contact command
bot.onText(/\/contact/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId,
    `📞 *Contact Support*\n\n` +
    `• *Phone:* +234 800 123 4567\n` +
    `• *Email:* support@abujashortlet.com\n` +
    `• *WhatsApp:* wa.me/2348001234567\n\n` +
    `• *Office Hours:* Mon-Fri 9am-6pm\n` +
    `• *Emergency Support:* 24/7`,
    { parse_mode: 'Markdown' }
  );
});

// About command
bot.onText(/\/about/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId,
    `🏠 *About Abuja Shortlet Apartments*\n\n` +
    `We provide premium short-term apartment rentals in Abuja since 2020.\n\n` +
    `*Why choose us?*\n` +
    `✓ 500+ Verified Properties\n` +
    `✓ Secure Online Booking\n` +
    `✓ 24/7 Customer Support\n` +
    `✓ Best Price Guarantee\n` +
    `✓ Flexible Check-in/out\n\n` +
    `*📍 Coverage Areas:*\n` +
    `Wuse, Maitama, Asokoro, Jabi, Garki, and more...`,
    { parse_mode: 'Markdown' }
  );
});

// Help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId,
    `❓ *Available Commands*\n\n` +
    `• /start - Main menu\n` +
    `• /search - Find apartments\n` +
    `• /bookings - View your bookings\n` +
    `• /locations - Browse by area\n` +
    `• /contact - Get support\n` +
    `• /about - About us\n` +
    `• /help - Show this help\n\n` +
    `*Need assistance?*\n` +
    `Contact support using /contact`,
    { parse_mode: 'Markdown' }
  );
});

// Handle regular messages (non-commands)
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Ignore commands
  if (text && text.startsWith('/')) return;
  
  // Check if message is about booking/search
  const lowerText = text?.toLowerCase() || '';
  
  if (lowerText.includes('book') || lowerText.includes('apartment') || lowerText.includes('rent')) {
    bot.sendMessage(chatId,
      `I can help you find an apartment! 🏠\n\n` +
      `Use /search to start your search, or tell me:\n` +
      `• Location (e.g., Wuse, Maitama)\n` +
      `• Number of guests\n` +
      `• Check-in and check-out dates`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Start Search', callback_data: 'search' }]
          ]
        }
      }
    );
  } else {
    // Generic response
    bot.sendMessage(chatId,
      `I received your message: "${text}"\n\n` +
      `Type /help to see what I can do!`
    );
  }
  
  logger.info(`Message from ${chatId}: ${text}`);
});

// Error handlers
bot.on('polling_error', (error) => {
  logger.error('Polling error:', error);
});

bot.on('webhook_error', (error) => {
  logger.error('Webhook error:', error);
});

bot.on('error', (error) => {
  logger.error('Bot error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  
  // Stop bot polling
  bot.stopPolling().then(() => {
    logger.info('Bot polling stopped');
    
    // Close health server
    server.close(() => {
      logger.info('Health server closed');
      process.exit(0);
    });
  }).catch((error) => {
    logger.error('Error stopping bot:', error);
    process.exit(1);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  process.exit(0);
});

// Start message
logger.info('🚀 Abuja Shortlet Apartment Bot is running!');
logger.info(`📊 Health check available at http://localhost:${PORT}/health`);

// src/index.js
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const winston = require('winston');

// Load environment variables
dotenv.config();

// ==================== LOGGER ====================
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// ==================== HEALTH SERVER ====================
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.listen(PORT, () => {
  logger.info(`Health server running on port ${PORT}`);
});

// ==================== DATABASE CONNECTION ====================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

// ==================== TELEGRAM BOT ====================
const token = process.env.BOT_TOKEN;
if (!token) {
  logger.error('BOT_TOKEN not set');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
logger.info('Bot started');

// Temporary storage
const userSessions = {};

// ==================== USER REGISTRATION ====================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  try {
    // Check if user exists
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE telegram_id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      // New user - ask for phone
      bot.sendMessage(chatId, 
        `👋 Welcome to Abuja Shortlet Apartment Bot!\n\n` +
        `To help you find apartments, I need your phone number so owners can contact you.`,
        {
          reply_markup: {
            keyboard: [[{
              text: "📱 Share Phone Number",
              request_contact: true
            }]],
            resize_keyboard: true,
            one_time_keyboard: true
          }
        }
      );
    } else {
      // Existing user - show menu
      showMainMenu(chatId, users[0].name);
    }
  } catch (error) {
    logger.error('Start error:', error);
    bot.sendMessage(chatId, 'Something went wrong. Please try again.');
  }
});

// Handle phone number
bot.on('contact', async (msg) => {
  const chatId = msg.chat.id;
  const phone = msg.contact.phone_number;
  const userId = msg.from.id.toString();
  const name = msg.from.first_name || 'User';
  
  try {
    await pool.execute(
      'INSERT INTO users (telegram_id, name, phone) VALUES (?, ?, ?)',
      [userId, name, phone]
    );
    
    bot.sendMessage(chatId, 
      `✅ Registration complete!\n\nWelcome ${name}!`,
      {
        reply_markup: { remove_keyboard: true }
      }
    );
    
    showMainMenu(chatId, name);
  } catch (error) {
    logger.error('Contact error:', error);
    bot.sendMessage(chatId, 'Registration failed. Try /start again.');
  }
});

// Main menu
function showMainMenu(chatId, name) {
  bot.sendMessage(chatId,
    `🏠 *Main Menu*\n\n` +
    `Welcome back, ${name}!\n\n` +
    `What would you like to do?`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔍 Search Apartments', callback_data: 'search' }],
          [{ text: '📍 Browse by Location', callback_data: 'locations' }],
          [{ text: '📅 My Bookings', callback_data: 'my_bookings' }],
          [{ text: '❓ Help', callback_data: 'help' }]
        ]
      }
    }
  );
}

// ==================== CALLBACK HANDLER ====================
bot.on('callback_query', async (callbackQuery) => {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  
  await bot.answerCallbackQuery(callbackQuery.id);
  
  if (data === 'search') {
    bot.sendMessage(chatId,
      `🔍 *Search Apartments*\n\n` +
      `Enter location (e.g., Wuse, Maitama, Asokoro):`,
      {
        parse_mode: 'Markdown',
        reply_markup: { force_reply: true }
      }
    );
  }
  
  else if (data === 'locations') {
    bot.sendMessage(chatId,
      `📍 *Popular Locations*\n\n` +
      `Wuse\nMaitama\nAsokoro\nJabi\nGarki\nUtako\nGwarinpa`,
      { parse_mode: 'Markdown' }
    );
  }
  
  else if (data === 'help') {
    bot.sendMessage(chatId,
      `❓ *Help*\n\n` +
      `/start - Main menu\n` +
      `Search apartments by location\n` +
      `Contact owner after booking\n` +
      `Need more help? Contact support.`,
      { parse_mode: 'Markdown' }
    );
  }
  
  else if (data.startsWith('book_')) {
    const aptId = data.split('_')[1];
    
    // Get apartment details
    try {
      const [apartments] = await pool.execute(
        'SELECT * FROM apartments WHERE id = ?',
        [aptId]
      );
      
      if (apartments.length > 0) {
        const apt = apartments[0];
        
        // Create booking
        const bookingId = 'BK' + Date.now();
        const [user] = await pool.execute(
          'SELECT * FROM users WHERE telegram_id = ?',
          [chatId.toString()]
        );
        
        if (user.length > 0) {
          await pool.execute(
            `INSERT INTO bookings 
            (id, user_id, user_name, user_phone, apartment_id, apartment_name, 
             owner_id, owner_name, price, commission, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
              bookingId, chatId.toString(), user[0].name, user[0].phone,
              apt.id, apt.title, apt.owner_id, apt.owner_name,
              apt.price, apt.price * 0.1
            ]
          );
          
          bot.sendMessage(chatId,
            `✅ *Booking Request Sent!*\n\n` +
            `Apartment: ${apt.title}\n` +
            `Booking ID: \`${bookingId}\`\n\n` +
            `The owner will contact you soon.`,
            { parse_mode: 'Markdown' }
          );
        }
      }
    } catch (error) {
      logger.error('Booking error:', error);
      bot.sendMessage(chatId, 'Booking failed. Try again.');
    }
  }
});

// ==================== MESSAGE HANDLER ====================
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Skip commands
  if (text.startsWith('/')) return;
  
  // If this is a reply to location question
  if (msg.reply_to_message && msg.reply_to_message.text.includes('Enter location')) {
    userSessions[chatId] = { location: text };
    
    bot.sendMessage(chatId,
      `📅 *When do you want to check in?*\n\n` +
      `Format: YYYY-MM-DD to YYYY-MM-DD\n` +
      `Example: 2024-12-01 to 2024-12-05`,
      {
        parse_mode: 'Markdown',
        reply_markup: { force_reply: true }
      }
    );
  }
  
  // If this is a reply to dates
  else if (msg.reply_to_message && msg.reply_to_message.text.includes('check in')) {
    const dates = text.split(' to ');
    if (dates.length === 2) {
      userSessions[chatId].checkIn = dates[0];
      userSessions[chatId].checkOut = dates[1];
      
      bot.sendMessage(chatId,
        `👥 *How many guests?*`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '1 Guest', callback_data: 'guests_1' }],
              [{ text: '2 Guests', callback_data: 'guests_2' }],
              [{ text: '3 Guests', callback_data: 'guests_3' }],
              [{ text: '4+ Guests', callback_data: 'guests_4' }]
            ]
          }
        }
      );
    }
  }
});

// Handle guest selection
bot.on('callback_query', async (callbackQuery) => {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  
  if (data.startsWith('guests_')) {
    await bot.answerCallbackQuery(callbackQuery.id);
    
    const guests = data.replace('guests_', '');
    const session = userSessions[chatId];
    
    if (session) {
      // Search apartments
      try {
        const [apartments] = await pool.execute(
          `SELECT * FROM apartments 
           WHERE location LIKE ? AND max_guests >= ? AND is_active = 1 
           LIMIT 5`,
          [`%${session.location}%`, guests]
        );
        
        if (apartments.length === 0) {
          bot.sendMessage(chatId,
            `No apartments found in ${session.location} for ${guests} guests.`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔍 New Search', callback_data: 'search' }]
                ]
              }
            }
          );
          return;
        }
        
        let message = `🔍 *Search Results*\n\n`;
        
        for (const apt of apartments) {
          message += `🏠 *${apt.title}*\n`;
          message += `📍 ${apt.location}\n`;
          message += `💰 ₦${apt.price}/night\n`;
          message += `👥 Max ${apt.max_guests} guests\n`;
          message += `[Book Now](/book_${apt.id})\n\n`;
        }
        
        bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔍 New Search', callback_data: 'search' }]
            ]
          }
        });
        
      } catch (error) {
        logger.error('Search error:', error);
        bot.sendMessage(chatId, 'Search failed. Try again.');
      }
    }
  }
});

logger.info('🚀 Abuja Shortlet Bot is running');

// src/index.js
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const winston = require('winston');
const cron = require('node-cron');

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

const ADMIN_ID = process.env.ADMIN_ID;
if (!ADMIN_ID) {
  logger.error('ADMIN_ID not set');
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
  const messageId = callbackQuery.message.message_id;
  const ownerId = chatId.toString();
  
  await bot.answerCallbackQuery(callbackQuery.id);
  
  // ========== MAIN MENU OPTIONS ==========
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
  
  // ========== MY BOOKINGS FEATURE ==========
  else if (data === 'my_bookings') {
    try {
      const [bookings] = await pool.execute(
        `SELECT * FROM bookings 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT 5`,
        [chatId.toString()]
      );
      
      if (bookings.length === 0) {
        return bot.sendMessage(chatId, 
          'You have no bookings yet.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔍 Search Apartments', callback_data: 'search' }]
              ]
            }
          }
        );
      }
      
      let message = '*Your Recent Bookings:*\n\n';
      bookings.forEach(b => {
        const statusEmoji = {
          'pending': '⏳',
          'confirmed': '✅',
          'rejected': '❌',
          'cancelled': '⚠️'
        }[b.status] || '📅';
        
        message += `${statusEmoji} *${b.apartment_name}*\n`;
        message += `ID: \`${b.id}\`\n`;
        message += `Status: ${b.status}\n`;
        message += `Price: ₦${b.price}\n`;
        message += `Date: ${new Date(b.created_at).toLocaleDateString()}\n\n`;
      });
      
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      
    } catch (error) {
      logger.error('My bookings error:', error);
      bot.sendMessage(chatId, 'Error fetching your bookings');
    }
  }
  
  // ========== GUEST SELECTION HANDLER ==========
  else if (data.startsWith('guests_')) {
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
  
  // ========== BOOKING FROM SEARCH RESULTS ==========
  else if (data.startsWith('book_')) {
    const aptId = data.split('_')[1];
    
    try {
      const [apartments] = await pool.execute(
        'SELECT * FROM apartments WHERE id = ?',
        [aptId]
      );
      
      if (apartments.length > 0) {
        const apt = apartments[0];
        
        // Get user details
        const [user] = await pool.execute(
          'SELECT * FROM users WHERE telegram_id = ?',
          [chatId.toString()]
        );
        
        if (user.length === 0) {
          return bot.sendMessage(chatId, 'Please /start first to register');
        }
        
        // Create booking
        const bookingId = 'BK' + Date.now();
        const commission = apt.price * 0.1;
        
        await pool.execute(
          `INSERT INTO bookings 
          (id, user_id, user_name, user_phone, apartment_id, apartment_name, 
           owner_id, owner_name, price, commission, status) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [
            bookingId, chatId.toString(), user[0].name, user[0].phone,
            apt.id, apt.title, apt.owner_id, apt.owner_name,
            apt.price, commission
          ]
        );
        
        // ========== WEEK 2: OWNER NOTIFICATION ==========
        const ownerButtons = {
          inline_keyboard: [
            [
              { text: '✅ Confirm Payment', callback_data: `owner_confirm_${bookingId}` },
              { text: '❌ Reject', callback_data: `owner_reject_${bookingId}` }
            ]
          ]
        };

        await bot.sendMessage(
          apt.owner_id,
          `🏠 *New Booking Request!*\n\n` +
          `*Booking ID:* \`${bookingId}\`\n` +
          `*Apartment:* ${apt.title}\n` +
          `*Guest:* ${user[0].name}\n` +
          `*Phone:* ${user[0].phone}\n` +
          `*Price:* ₦${apt.price}\n` +
          `*Your Commission:* ₦${commission}\n\n` +
          `Please confirm once payment is received:`,
          {
            parse_mode: 'Markdown',
            reply_markup: ownerButtons
          }
        );

        // ========== WEEK 2: ADMIN NOTIFICATION ==========
        await bot.sendMessage(
          ADMIN_ID,
          `👑 *ADMIN NOTIFICATION*\n\n` +
          `*New Booking:* \`${bookingId}\`\n` +
          `*Apartment:* ${apt.title}\n` +
          `*Guest:* ${user[0].name} (${user[0].phone})\n` +
          `*Owner:* ${apt.owner_name}\n` +
          `*Price:* ₦${apt.price}\n` +
          `*Commission:* ₦${commission}`,
          { parse_mode: 'Markdown' }
        );

        // ========== WEEK 2: CONFIRM TO USER ==========
        bot.sendMessage(chatId,
          `✅ *Booking Request Sent!*\n\n` +
          `*Apartment:* ${apt.title}\n` +
          `*Booking ID:* \`${bookingId}\`\n` +
          `*Price:* ₦${apt.price}\n\n` +
          `The owner will review your request. You'll be notified once they respond.`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      logger.error('Booking error:', error);
      bot.sendMessage(chatId, 'Booking failed. Try again.');
    }
  }
  
  // ========== WEEK 2: OWNER CONFIRMATION HANDLER ==========
  else if (data.startsWith('owner_confirm_')) {
    const bookingId = data.replace('owner_confirm_', '');
    
    try {
      // Get booking details
      const [bookings] = await pool.execute(
        'SELECT * FROM bookings WHERE id = ?',
        [bookingId]
      );
      
      if (bookings.length === 0) {
        return bot.sendMessage(chatId, 'Booking not found');
      }
      
      const booking = bookings[0];
      
      // Verify owner owns this apartment
      if (booking.owner_id !== ownerId) {
        return bot.sendMessage(chatId, 'You are not authorized to confirm this booking');
      }
      
      // Check if already processed
      if (booking.status !== 'pending') {
        return bot.sendMessage(chatId, `This booking is already ${booking.status}`);
      }
      
      // Update booking status
      await pool.execute(
        'UPDATE bookings SET status = ?, confirmed_at = NOW() WHERE id = ?',
        ['confirmed', bookingId]
      );
      
      // Notify guest
      await bot.sendMessage(
        booking.user_id,
        `✅ *Booking Confirmed!*\n\n` +
        `Good news! Your booking for *${booking.apartment_name}* has been confirmed.\n` +
        `*Booking ID:* \`${bookingId}\`\n` +
        `*Price:* ₦${booking.price}\n\n` +
        `*Owner Contact:* ${booking.owner_name}\n` +
        `Please coordinate check-in details with the owner.`,
        { parse_mode: 'Markdown' }
      );
      
      // Notify admin
      await bot.sendMessage(
        ADMIN_ID,
        `💰 *Commission Update*\n\n` +
        `*Booking:* \`${bookingId}\`\n` +
        `*Status:* Confirmed by owner\n` +
        `*Commission:* ₦${booking.commission} is now owed\n` +
        `*Owner:* ${booking.owner_name}`,
        { parse_mode: 'Markdown' }
      );
      
      // Update owner's message
      await bot.editMessageText(
        `✅ *Booking Confirmed*\n\n` +
        `You confirmed booking \`${bookingId}\`\n` +
        `Guest has been notified.\n\n` +
        `*Guest:* ${booking.user_name}\n` +
        `*Phone:* ${booking.user_phone}`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [] }
        }
      );
      
      logger.info(`Booking ${bookingId} confirmed by owner ${ownerId}`);
      
    } catch (error) {
      logger.error('Owner confirmation error:', error);
      bot.sendMessage(chatId, 'Error confirming booking. Please try again.');
    }
  }
  
  // ========== WEEK 2: OWNER REJECTION HANDLER ==========
  else if (data.startsWith('owner_reject_')) {
    const bookingId = data.replace('owner_reject_', '');
    
    try {
      const [bookings] = await pool.execute(
        'SELECT * FROM bookings WHERE id = ?',
        [bookingId]
      );
      
      if (bookings.length === 0) {
        return bot.sendMessage(chatId, 'Booking not found');
      }
      
      const booking = bookings[0];
      
      // Verify ownership
      if (booking.owner_id !== ownerId) {
        return bot.sendMessage(chatId, 'You are not authorized to reject this booking');
      }
      
      // Check if already processed
      if (booking.status !== 'pending') {
        return bot.sendMessage(chatId, `This booking is already ${booking.status}`);
      }
      
      // Update booking status
      await pool.execute(
        'UPDATE bookings SET status = ? WHERE id = ?',
        ['rejected', bookingId]
      );
      
      // Notify guest
      await bot.sendMessage(
        booking.user_id,
        `❌ *Booking Update*\n\n` +
        `Unfortunately, your booking for *${booking.apartment_name}* was not accepted.\n` +
        `*Booking ID:* \`${bookingId}\`\n\n` +
        `Please use /search to find other available apartments.`,
        { parse_mode: 'Markdown' }
      );
      
      // Notify admin
      await bot.sendMessage(
        ADMIN_ID,
        `❌ *Booking Rejected*\n\n` +
        `*Booking:* \`${bookingId}\`\n` +
        `*Status:* Rejected by owner\n` +
        `*Owner:* ${booking.owner_name}\n` +
        `*Guest:* ${booking.user_name}`,
        { parse_mode: 'Markdown' }
      );
      
      // Update owner's message
      await bot.editMessageText(
        `❌ *Booking Rejected*\n\n` +
        `You rejected booking \`${bookingId}\`\n` +
        `Guest has been notified.`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: [] }
        }
      );
      
      logger.info(`Booking ${bookingId} rejected by owner ${ownerId}`);
      
    } catch (error) {
      logger.error('Owner rejection error:', error);
      bot.sendMessage(chatId, 'Error rejecting booking. Please try again.');
    }
  }
});

// ==================== MESSAGE HANDLER ====================
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  // Skip commands
  if (!text || text.startsWith('/')) return;
  
  // If this is a reply to location question
  if (msg.reply_to_message && msg.reply_to_message.text && 
      msg.reply_to_message.text.includes('Enter location')) {
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
  else if (msg.reply_to_message && msg.reply_to_message.text && 
           msg.reply_to_message.text.includes('check in')) {
    const dates = text.split(' to ');
    if (dates.length === 2) {
      if (!userSessions[chatId]) userSessions[chatId] = {};
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
    } else {
      bot.sendMessage(chatId, 'Please use the correct format: YYYY-MM-DD to YYYY-MM-DD');
    }
  }
});

// ==================== WEEK 2: CRON JOB FOR STALE BOOKINGS ====================
// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  logger.info('Running daily check for stale bookings');
  
  try {
    // Find pending bookings older than 48 hours
    const [staleBookings] = await pool.execute(
      `SELECT * FROM bookings 
       WHERE status = 'pending' 
       AND created_at < NOW() - INTERVAL 48 HOUR`
    );
    
    for (const booking of staleBookings) {
      // Auto-cancel
      await pool.execute(
        'UPDATE bookings SET status = ? WHERE id = ?',
        ['cancelled', booking.id]
      );
      
      // Notify guest
      await bot.sendMessage(
        booking.user_id,
        `⏰ *Booking Expired*\n\n` +
        `Your booking for *${booking.apartment_name}* has been automatically cancelled because the owner didn't respond within 48 hours.\n\n` +
        `Please search for other apartments using /search.`,
        { parse_mode: 'Markdown' }
      );
      
      // Notify owner that booking was auto-cancelled
      await bot.sendMessage(
        booking.owner_id,
        `⚠️ *Booking Auto-Cancelled*\n\n` +
        `Booking \`${booking.id}\` for *${booking.apartment_name}* has been automatically cancelled because you didn't respond within 48 hours.\n\n` +
        `Please respond to future booking requests promptly to avoid cancellations.`,
        { parse_mode: 'Markdown' }
      );
      
      // Notify admin
      await bot.sendMessage(
        ADMIN_ID,
        `⚠️ *Auto-Cancelled Booking*\n\n` +
        `*Booking:* \`${booking.id}\`\n` +
        `*Owner:* ${booking.owner_name} didn't respond within 48 hours\n` +
        `*Guest:* ${booking.user_name}\n` +
        `*Apartment:* ${booking.apartment_name}`,
        { parse_mode: 'Markdown' }
      );
      
      logger.info(`Auto-cancelled booking ${booking.id}`);
    }
    
    logger.info(`Daily check complete: ${staleBookings.length} bookings auto-cancelled`);
  } catch (error) {
    logger.error('Daily check error:', error);
  }
});

// ==================== ERROR HANDLER ====================
bot.on('polling_error', (error) => {
  logger.error('Polling error:', error);
});

// ==================== START BOT ====================
logger.info('🚀 Abuja Shortlet Bot is running with all Week 2 features');

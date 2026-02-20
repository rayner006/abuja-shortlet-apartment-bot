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

const ADMIN_ID = process.env.ADMIN_ID;
if (!ADMIN_ID) {
  logger.error('ADMIN_ID not set');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
logger.info('Bot started');

// Temporary storage
const userSessions = {};

// Abuja locations list
const ABUJA_LOCATIONS = [
  'Asokoro',
  'Maitama',
  'Wuse',
  'Central Area (CBD)',
  'Guzape',
  'Garki',
  'Utako',
  'Jabi',
  'Gwarinpa',
  'Wuye',
  'Kubwa',
  'Lokogoma',
  'Apo',
  'Lugbe',
  'Galadima',
  'Dutse'
];

// ==================== SIMPLIFIED USER REGISTRATION ====================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const name = msg.from.first_name || 'User';
  
  try {
    // Check if user exists in database
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE telegram_id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      // Store user with Telegram name (will update during booking if needed)
      await pool.execute(
        'INSERT INTO users (telegram_id, name, phone) VALUES (?, ?, ?)',
        [userId, name, 'pending']
      );
      logger.info(`New user registered: ${name} (${userId})`);
    } else {
      // Update last active
      await pool.execute(
        'UPDATE users SET last_active = NOW() WHERE telegram_id = ?',
        [userId]
      );
    }
    
    // Show main menu immediately
    showMainMenu(chatId, name);
    
  } catch (error) {
    logger.error('Start error:', error);
    bot.sendMessage(chatId, 'Something went wrong. Please try again.');
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
          [{ text: '💰 Browse By Budget', callback_data: 'budget' }],
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
    // Create location buttons in rows of 2
    const locationButtons = [];
    for (let i = 0; i < ABUJA_LOCATIONS.length; i += 2) {
      const row = [];
      row.push({ text: `📍 ${ABUJA_LOCATIONS[i]}`, callback_data: `loc_${ABUJA_LOCATIONS[i]}` });
      if (i + 1 < ABUJA_LOCATIONS.length) {
        row.push({ text: `📍 ${ABUJA_LOCATIONS[i + 1]}`, callback_data: `loc_${ABUJA_LOCATIONS[i + 1]}` });
      }
      locationButtons.push(row);
    }
    
    // Add Other and Back buttons
    locationButtons.push([{ text: '📍 Other (type manually)', callback_data: 'loc_other' }]);
    locationButtons.push([{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]);
    
    bot.sendMessage(chatId,
      `🔍 *Search Apartments*\n\n` +
      `Please select a location from the list below:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: locationButtons
        }
      }
    );
  }
  
  // ========== BUDGET HANDLER (placeholder) ==========
  else if (data === 'budget') {
    bot.sendMessage(chatId,
      `💰 *Browse By Budget*\n\n` +
      `This feature is coming soon!\n\n` +
      `For now, please use 🔍 Search Apartments to find properties by location.`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Search Apartments', callback_data: 'search' }],
            [{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]
          ]
        }
      }
    );
  }
  
  else if (data === 'help') {
    bot.sendMessage(chatId,
      `❓ *Help*\n\n` +
      `/start - Main menu\n` +
      `🔍 Search Apartments - Find by location\n` +
      `💰 Browse By Budget - Coming soon\n` +
      `📅 My Bookings - View your bookings\n\n` +
      `Need more help? Contact support.`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]
          ]
        }
      }
    );
  }
  
  else if (data === 'back_to_menu') {
    // Get user name and show main menu
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE telegram_id = ?',
      [chatId.toString()]
    );
    showMainMenu(chatId, users[0]?.name || 'User');
  }
  
  // ========== LOCATION SELECTION HANDLER ==========
  else if (data.startsWith('loc_')) {
    const location = data.replace('loc_', '');
    
    if (location === 'other') {
      // Ask user to type location manually
      return bot.sendMessage(chatId,
        `📍 *Enter Location*\n\n` +
        `Please type the location you want to search in:`,
        {
          parse_mode: 'Markdown',
          reply_markup: { 
            force_reply: true,
            inline_keyboard: [
              [{ text: '🔙 Back to Locations', callback_data: 'search' }]
            ]
          }
        }
      );
    }
    
    // Store location in session and ask for guests
    userSessions[chatId] = { location: location };
    
    // Ask for number of guests (BUTTONS)
    bot.sendMessage(chatId,
      `👥 *How many guests?*\n\n` +
      `*Selected Location:* ${location}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '1 Guest', callback_data: `guests_1_${location}` }],
            [{ text: '2 Guests', callback_data: `guests_2_${location}` }],
            [{ text: '3 Guests', callback_data: `guests_3_${location}` }],
            [{ text: '4+ Guests', callback_data: `guests_4_${location}` }],
            [{ text: '🔙 Change Location', callback_data: 'search' }]
          ]
        }
      }
    );
  }
  
  // ========== GUEST SELECTION HANDLER ==========
  else if (data.startsWith('guests_')) {
    const parts = data.split('_');
    const guests = parts[1];
    const location = parts.slice(2).join('_'); // Rejoin in case location has spaces
    
    // Store guests in session
    userSessions[chatId] = { 
      location: location,
      guests: guests 
    };
    
    // ========== APARTMENT TYPE BUTTONS ==========
    bot.sendMessage(chatId,
      `🏠 *Apartment Type*\n\n` +
      `What type of apartment are you looking for?\n\n` +
      `*Location:* ${location}\n` +
      `*Guests:* ${guests}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🛋️ Studio Apt.', callback_data: `type_Studio_${location}_${guests}` },
              { text: '🛏️ 1-Bedroom', callback_data: `type_1-Bedroom_${location}_${guests}` }
            ],
            [
              { text: '🛏️🛏️ 2-Bedroom', callback_data: `type_2-Bedroom_${location}_${guests}` },
              { text: '🛏️🛏️🛏️ 3-Bedroom', callback_data: `type_3-Bedroom_${location}_${guests}` }
            ],
            [{ text: '🔙 Back to Guests', callback_data: `loc_${location}` }],
            [{ text: '🔙 Change Location', callback_data: 'search' }]
          ]
        }
      }
    );
  }
  
  // ========== APARTMENT TYPE HANDLER - FIXED WITH SEPARATE MESSAGES ==========
  else if (data.startsWith('type_')) {
    const parts = data.split('_');
    const aptType = parts[1];
    const location = parts[2];
    const guests = parts[3];
    
    // Store apartment type in session
    userSessions[chatId] = {
      ...userSessions[chatId],
      apartmentType: aptType
    };
    
    // Search apartments with location AND type
    try {
      // Convert button text to search format
      let searchType = aptType;
      if (aptType === 'Studio') searchType = 'Studio';
      if (aptType === '1-Bedroom') searchType = '1-Bedroom';
      if (aptType === '2-Bedroom') searchType = '2-Bedroom';
      if (aptType === '3-Bedroom') searchType = '3-Bedroom';
      
      const [apartments] = await pool.execute(
        `SELECT * FROM apartments 
         WHERE location LIKE ? 
         AND title LIKE ? 
         AND max_guests >= ? 
         AND is_active = 1 
         LIMIT 5`,
        [`%${location}%`, `%${searchType}%`, guests]
      );
      
      if (apartments.length === 0) {
        bot.sendMessage(chatId,
          `No ${aptType} apartments found in ${location} for ${guests} guests.`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Try Different Type', callback_data: `guests_${guests}_${location}` }],
                [{ text: '🔍 New Search', callback_data: 'search' }],
                [{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]
              ]
            }
          }
        );
        return;
      }
      
      // Send header first
      await bot.sendMessage(
        chatId,
        `🔍 *${aptType} Results in ${location}*`,
        { parse_mode: 'Markdown' }
      );
      
      // Send each apartment as its own card with individual Book Now button
      for (let i = 0; i < apartments.length; i++) {
        const apt = apartments[i];
        const formattedPrice = new Intl.NumberFormat('en-NG').format(apt.price);
        
        await bot.sendMessage(
          chatId,
          `🏠 *${apt.title}*\n` +
          `📍 ${apt.location}\n` +
          `💰 ₦${formattedPrice}/night\n` +
          `👥 Max ${apt.max_guests} guests`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📅 Book Now', callback_data: `book_${apt.id}` }]
              ]
            }
          }
        );
      }
      
      // Navigation buttons at the end
      await bot.sendMessage(chatId, 'What would you like to do next?', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔄 Different Type', callback_data: `guests_${guests}_${location}` },
              { text: '🔍 New Search', callback_data: 'search' }
            ],
            [
              { text: '🔙 Back to Menu', callback_data: 'back_to_menu' }
            ]
          ]
        }
      });
      
    } catch (error) {
      logger.error('Apartment type search error:', error);
      bot.sendMessage(chatId, 'Search failed. Try again.');
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
        
        // Store apartment in session for booking
        userSessions[chatId] = {
          ...userSessions[chatId],
          pendingBooking: apt
        };
        
        // Get user details
        const [user] = await pool.execute(
          'SELECT * FROM users WHERE telegram_id = ?',
          [chatId.toString()]
        );
        
        if (user.length === 0) {
          return bot.sendMessage(chatId, 'Please /start first to register');
        }
        
        // Check if user needs to provide name
        if (user[0].name === 'User' || user[0].name === 'pending') {
          userSessions[chatId].awaitingName = true;
          return bot.sendMessage(chatId,
            `📝 *Your Name*\n\n` +
            `Your Telegram name is *${user[0].name}*.\n` +
            `If you want to use a different name for this booking, please enter it now.\n\n` +
            `Or type *skip* to use your Telegram name:`,
            {
              parse_mode: 'Markdown',
              reply_markup: { 
                force_reply: true,
                inline_keyboard: [
                  [{ text: '🔙 Cancel', callback_data: 'search' }]
                ]
              }
            }
          );
        }
        
        // Check if user needs to provide phone number
        if (user[0].phone === 'pending') {
          userSessions[chatId].awaitingPhone = true;
          return bot.sendMessage(chatId,
            `📱 *Your Phone Number*\n\n` +
            `Please enter your phone number so the owner can contact you👇:`,
            {
              parse_mode: 'Markdown',
              reply_markup: { 
                force_reply: true,
                inline_keyboard: [
                  [{ text: '🔙 Cancel', callback_data: 'search' }]
                ]
              }
            }
          );
        }
        
        // Ask for dates
        askForDates(chatId, apt);
      }
    } catch (error) {
      logger.error('Booking error:', error);
      bot.sendMessage(chatId, 'Booking failed. Try again.');
    }
  }
  
  // ========== OWNER CONFIRMATION HANDLER ==========
  else if (data.startsWith('owner_confirm_')) {
    const bookingId = data.replace('owner_confirm_', '');
    
    try {
      const [bookings] = await pool.execute(
        'SELECT * FROM bookings WHERE id = ?',
        [bookingId]
      );
      
      if (bookings.length === 0) {
        return bot.sendMessage(chatId, 'Booking not found');
      }
      
      const booking = bookings[0];
      
      if (booking.owner_id !== ownerId) {
        return bot.sendMessage(chatId, 'You are not authorized to confirm this booking');
      }
      
      if (booking.status !== 'pending') {
        return bot.sendMessage(chatId, `This booking is already ${booking.status}`);
      }
      
      await pool.execute(
        'UPDATE bookings SET status = ?, confirmed_at = NOW() WHERE id = ?',
        ['confirmed', bookingId]
      );
      
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
      
      await bot.sendMessage(
        ADMIN_ID,
        `💰 *Commission Update*\n\n` +
        `*Booking:* \`${bookingId}\`\n` +
        `*Status:* Confirmed by owner\n` +
        `*Commission:* ₦${booking.commission} is now owed\n` +
        `*Owner:* ${booking.owner_name}`,
        { parse_mode: 'Markdown' }
      );
      
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
  
  // ========== OWNER REJECTION HANDLER ==========
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
      
      if (booking.owner_id !== ownerId) {
        return bot.sendMessage(chatId, 'You are not authorized to reject this booking');
      }
      
      if (booking.status !== 'pending') {
        return bot.sendMessage(chatId, `This booking is already ${booking.status}`);
      }
      
      await pool.execute(
        'UPDATE bookings SET status = ? WHERE id = ?',
        ['rejected', bookingId]
      );
      
      await bot.sendMessage(
        booking.user_id,
        `❌ *Booking Update*\n\n` +
        `Unfortunately, your booking for *${booking.apartment_name}* was not accepted.\n` +
        `*Booking ID:* \`${bookingId}\`\n\n` +
        `Please use /search to find other available apartments.`,
        { parse_mode: 'Markdown' }
      );
      
      await bot.sendMessage(
        ADMIN_ID,
        `❌ *Booking Rejected*\n\n` +
        `*Booking:* \`${bookingId}\`\n` +
        `*Status:* Rejected by owner\n` +
        `*Owner:* ${booking.owner_name}\n` +
        `*Guest:* ${booking.user_name}`,
        { parse_mode: 'Markdown' }
      );
      
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
                [{ text: '🔍 Search Apartments', callback_data: 'search' }],
                [{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]
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
      
      bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 New Search', callback_data: 'search' }],
            [{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]
          ]
        }
      });
      
    } catch (error) {
      logger.error('My bookings error:', error);
      bot.sendMessage(chatId, 'Error fetching your bookings');
    }
  }
});

// ==================== HELPER FUNCTION TO ASK FOR DATES ====================
function askForDates(chatId, apt) {
  bot.sendMessage(chatId,
    `📅 *When do you want to check in?*\n\n` +
    `*Apartment:* ${apt.title}\n` +
    `*Price:* ₦${apt.price}/night\n\n` +
    `Please enter dates in this format:\n` +
    `\`YYYY-MM-DD to YYYY-MM-DD\`\n\n` +
    `Example: \`2024-12-01 to 2024-12-05\``,
    {
      parse_mode: 'Markdown',
      reply_markup: { 
        force_reply: true,
        inline_keyboard: [
          [{ text: '🔙 Cancel', callback_data: 'search' }]
        ]
      }
    }
  );
}

// ==================== MESSAGE HANDLER ====================
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (!text || text.startsWith('/')) return;
  
  // Awaiting name
  if (userSessions[chatId] && userSessions[chatId].awaitingName) {
    const apt = userSessions[chatId].pendingBooking;
    let name = text.trim();
    
    if (name.toLowerCase() === 'skip') {
      const [user] = await pool.execute(
        'SELECT * FROM users WHERE telegram_id = ?',
        [chatId.toString()]
      );
      name = user[0].name;
    } else if (name.length < 2) {
      return bot.sendMessage(chatId,
        `❌ Please enter a valid name (at least 2 characters) or type *skip*:`,
        { 
          reply_markup: { 
            force_reply: true,
            inline_keyboard: [
              [{ text: '🔙 Cancel', callback_data: 'search' }]
            ]
          } 
        }
      );
    } else {
      await pool.execute(
        'UPDATE users SET name = ? WHERE telegram_id = ?',
        [name, chatId.toString()]
      );
    }
    
    delete userSessions[chatId].awaitingName;
    
    const [user] = await pool.execute(
      'SELECT * FROM users WHERE telegram_id = ?',
      [chatId.toString()]
    );
    
    if (user[0].phone === 'pending') {
      userSessions[chatId].awaitingPhone = true;
      return bot.sendMessage(chatId,
        `📱 *Your Phone Number*\n\n` +
        `Please enter your phone number so the owner can contact you:`,
        {
          parse_mode: 'Markdown',
          reply_markup: { 
            force_reply: true,
            inline_keyboard: [
              [{ text: '🔙 Cancel', callback_data: 'search' }]
            ]
          }
        }
      );
    }
    
    askForDates(chatId, apt);
    return;
  }
  
  // Awaiting phone
  if (userSessions[chatId] && userSessions[chatId].awaitingPhone) {
    const phone = text.trim();
    const apt = userSessions[chatId].pendingBooking;
    
    if (phone.length < 10) {
      return bot.sendMessage(chatId,
        `❌ Please enter a valid phone number (at least 10 digits):`,
        { 
          reply_markup: { 
            force_reply: true,
            inline_keyboard: [
              [{ text: '🔙 Cancel', callback_data: 'search' }]
            ]
          } 
        }
      );
    }
    
    try {
      await pool.execute(
        'UPDATE users SET phone = ? WHERE telegram_id = ?',
        [phone, chatId.toString()]
      );
      
      delete userSessions[chatId].awaitingPhone;
      askForDates(chatId, apt);
      
    } catch (error) {
      logger.error('Phone update error:', error);
      bot.sendMessage(chatId, 'Error saving phone number. Please try again.');
    }
    
    return;
  }
  
  // Awaiting dates
  if (userSessions[chatId] && userSessions[chatId].pendingBooking) {
    const apt = userSessions[chatId].pendingBooking;
    const dates = text.split(' to ');
    
    if (dates.length === 2) {
      const checkIn = dates[0].trim();
      const checkOut = dates[1].trim();
      
      if (checkIn.length === 10 && checkOut.length === 10) {
        const [user] = await pool.execute(
          'SELECT * FROM users WHERE telegram_id = ?',
          [chatId.toString()]
        );
        
        await processBooking(chatId, user[0], apt, checkIn, checkOut);
        return;
      }
    }
    
    bot.sendMessage(chatId,
      `❌ Invalid date format.\n\n` +
      `Please use: YYYY-MM-DD to YYYY-MM-DD\n` +
      `Example: 2024-12-01 to 2024-12-05`,
      { 
        reply_markup: { 
          force_reply: true,
          inline_keyboard: [
            [{ text: '🔙 Cancel', callback_data: 'search' }]
          ]
        } 
      }
    );
    return;
  }
  
  // Other location
  if (msg.reply_to_message && msg.reply_to_message.text && 
      msg.reply_to_message.text.includes('Enter Location')) {
    userSessions[chatId] = { location: text };
    
    bot.sendMessage(chatId,
      `👥 *How many guests?*\n\n` +
      `*Selected Location:* ${text}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '1 Guest', callback_data: `guests_1_${text}` }],
            [{ text: '2 Guests', callback_data: `guests_2_${text}` }],
            [{ text: '3 Guests', callback_data: `guests_3_${text}` }],
            [{ text: '4+ Guests', callback_data: `guests_4_${text}` }],
            [{ text: '🔙 Change Location', callback_data: 'search' }]
          ]
        }
      }
    );
  }
});

// ==================== PROCESS BOOKING ====================
async function processBooking(chatId, user, apt, checkIn, checkOut) {
  try {
    const bookingId = 'BK' + Date.now();
    const commission = apt.price * 0.1;
    
    await pool.execute(
      `INSERT INTO bookings 
      (id, user_id, user_name, user_phone, apartment_id, apartment_name, 
       owner_id, owner_name, price, commission, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        bookingId, chatId.toString(), user.name, user.phone,
        apt.id, apt.title, apt.owner_id, apt.owner_name,
        apt.price, commission
      ]
    );
    
    delete userSessions[chatId];
    
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
      `*Guest:* ${user.name}\n` +
      `*Phone:* ${user.phone}\n` +
      `*Check-in:* ${checkIn}\n` +
      `*Check-out:* ${checkOut}\n` +
      `*Price:* ₦${apt.price}/night\n` +
      `*Your Commission:* ₦${commission}\n\n` +
      `Please confirm once payment is received:`,
      {
        parse_mode: 'Markdown',
        reply_markup: ownerButtons
      }
    );

    await bot.sendMessage(
      ADMIN_ID,
      `👑 *ADMIN NOTIFICATION*\n\n` +
      `*New Booking:* \`${bookingId}\`\n` +
      `*Apartment:* ${apt.title}\n` +
      `*Guest:* ${user.name} (${user.phone})\n` +
      `*Owner:* ${apt.owner_name}\n` +
      `*Check-in:* ${checkIn}\n` +
      `*Check-out:* ${checkOut}\n` +
      `*Price:* ₦${apt.price}/night\n` +
      `*Commission:* ₦${commission}`,
      { parse_mode: 'Markdown' }
    );

    bot.sendMessage(chatId,
      `✅ *Booking Request Sent!*\n\n` +
      `*Apartment:* ${apt.title}\n` +
      `*Booking ID:* \`${bookingId}\`\n` +
      `*Check-in:* ${checkIn}\n` +
      `*Check-out:* ${checkOut}\n` +
      `*Price:* ₦${apt.price}/night\n\n` +
      `The owner will review your request. You'll be notified once they respond.`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Menu', callback_data: 'back_to_menu' }]
          ]
        }
      }
    );
    
  } catch (error) {
    logger.error('Process booking error:', error);
    bot.sendMessage(chatId, 'Booking failed. Try again.');
  }
}

// ==================== ERROR HANDLER ====================
bot.on('polling_error', (error) => {
  logger.error('Polling error:', error);
});

// ==================== START BOT ====================
logger.info('🚀 Abuja Shortlet Bot is running - Each apartment has its own message with Book Now button!');

require('dotenv').config();

// Error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('💥 Reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
});

/* ================= KEEP ALIVE SERVER ================= */
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Abuja Shortlet Bot Running 🚀');
});

app.listen(PORT, () => {
  console.log(`🌍 Web server running on port ${PORT}`);
});

/* ================= TELEGRAM BOT ================= */
const TelegramBot = require('node-telegram-bot-api');
const db = require('./config/db');
const { generateaccesspin } = require('./utils/pingenerator');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { 
  polling: {
    params: {
      timeout: 30,
      limit: 100,
      allowed_updates: ['message', 'callback_query']
    }
  }
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, stopping bot...');
  bot.stopPolling().then(() => {
    console.log('✅ Polling stopped');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, stopping bot...');
  bot.stopPolling().then(() => {
    console.log('✅ Polling stopped');
    process.exit(0);
  });
});

/* ================= TEMP STORAGE ================= */
const awaitingPin = {};
const userSessions = {}; // Store user booking data

/* ================= ERROR HANDLING ================= */
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log(`${process.env.BOT_NAME || 'Abuja Shortlet Bot'} is running...`);

/* ================= MAIN MENU ================= */
function showMainMenu(chatId, text = 'Welcome To Abuja Shortlet Apartments 🏠, Click On Any Menu Below To Continue 👇👇👇') {
  bot.sendMessage(chatId, text, {
    reply_markup: {
      keyboard: [
        ['🏠 View Apartments'],
        ['📞 Contact Admin'],
        ['ℹ️ About Us']
      ],
      resize_keyboard: true
    }
  });
}

/* ================= SHOW LOCATIONS ================= */
function showLocations(chatId) {
  bot.sendMessage(chatId, '📍 *Select a location:*', {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [
        ['🏛️ Maitama', '🏛️ Asokoro'],
        ['🏢 Wuse', '🏢 Jabi'],
        ['🏘️ Garki', '🏘️ Utako'],
        ['⬅️ Back to Main Menu']
      ],
      resize_keyboard: true
    }
  });
}

/* ================= FETCH APARTMENTS BY LOCATION ================= */
function showApartmentsByLocation(chatId, location) {
  // Remove emoji and trim
  const cleanLocation = location.replace(/[🏛️🏢🏘️]/g, '').trim();
  
  db.query(
    'SELECT * FROM apartments WHERE location = ? AND is_available = true',
    [cleanLocation],
    (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return bot.sendMessage(chatId, '❌ Error fetching apartments');
      }
      
      if (results.length === 0) {
        return bot.sendMessage(chatId, `😔 No apartments available in ${cleanLocation} right now.`, {
          reply_markup: {
            keyboard: [
              ['🔍 Try Another Location'],
              ['⬅️ Back to Main Menu']
            ],
            resize_keyboard: true
          }
        });
      }
      
      // Send each apartment as a separate message with inline buttons
      results.forEach(apt => {
        const message = `
🏠 *${apt.name}*
📍 *Location:* ${apt.location}
💰 *Price:* ₦${apt.price_per_night}/night
🛏️ *Bedrooms:* ${apt.bedrooms}
🚿 *Bathrooms:* ${apt.bathrooms}
📝 *Description:* ${apt.description}
        `;
        
        bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📅 Book Now', callback_data: `book_${apt.id}` }],
              [{ text: '📸 View Photos', callback_data: `photos_${apt.id}` }]
            ]
          }
        });
      });
      
      // Show options after apartments
      bot.sendMessage(chatId, '✨ *What would you like to do next?* ✨', {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            ['🔍 Search Again'],
            ['⬅️ Back to Main Menu']
          ],
          resize_keyboard: true
        }
      });
    }
  );
}

/* ================= START BOOKING PROCESS ================= */
function startBooking(chatId, apartmentId) {
  // Store apartment ID in session
  userSessions[chatId] = { apartmentId, step: 'awaiting_checkin' };
  
  bot.sendMessage(chatId, '📅 Please enter your *check-in date* (DD/MM/YYYY):', {
    parse_mode: 'Markdown',
    reply_markup: {
      force_reply: true,
      selective: true
    }
  });
}

/* ================= GENERATE PIN FOR BOOKING ================= */
function generatePinForBooking(chatId, checkin, checkout) {
  const bookingCode = 'BOOK' + Date.now().toString().slice(-8);
  const pin = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit PIN
  
  const session = userSessions[chatId];
  
  db.query(
    `INSERT INTO bookings (booking_code, apartment_id, user_id, check_in, check_out, access_pin, pin_used) 
     VALUES (?, ?, ?, ?, ?, ?, false)`,
    [bookingCode, session.apartmentId, chatId, checkin, checkout, pin],
    (err) => {
      if (err) {
        console.error('Error creating booking:', err);
        return bot.sendMessage(chatId, '❌ Error creating booking');
      }
      
      // Store PIN temporarily for verification
      awaitingPin[chatId] = bookingCode;
      
      const message = `
✅ *Booking Initiated!*

🔑 *Your Booking Code:* \`${bookingCode}\`
🔐 *Your Payment PIN:* \`${pin}\`

💰 *Amount to pay:* ₦${session.price || 'To be calculated'}

🏦 *Bank Details:*
Bank: Access Bank
Account: 1234567890
Name: Abuja Shortlet Ltd

📌 *Next Step:*
After making payment, simply send the PIN to confirm your booking.
      `;
      
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      
      // Clear session
      delete userSessions[chatId];
    }
  );
}

/* ================= CONTACT ADMIN ================= */
function contactAdmin(chatId) {
  const message = `
📞 *Contact Admin*

For inquiries and bookings:
📱 *Phone:* +234 800 000 0000
📧 *Email:* admin@abujashortlet.com
💬 *WhatsApp:* +234 800 000 0000

🌟 Our team is available 24/7 to assist you!
  `;
  
  bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [
        ['⬅️ Back to Main Menu']
      ],
      resize_keyboard: true
    }
  });
}

/* ================= ABOUT US ================= */
function aboutUs(chatId) {
  const message = `
ℹ️ *About Abuja Shortlet Apartments*

We provide premium short-let apartments across Abuja's finest districts:
✅ Maitama
✅ Asokoro
✅ Wuse
✅ Jabi
✅ Garki
✅ Utako

✨ *Why choose us?*
• Verified properties ✅
• Secure payments 🔒
• 24/7 customer support 🎧
• Best price guarantee 💰

Book your stay today! 🏠
  `;
  
  bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [
        ['🏠 View Apartments'],
        ['⬅️ Back to Main Menu']
      ],
      resize_keyboard: true
    }
  });
}

/* ================= MESSAGE HANDLER ================= */
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  // Check if user is in booking flow
  if (userSessions[chatId]) {
    const session = userSessions[chatId];
    
    if (session.step === 'awaiting_checkin') {
      // Validate date format
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
        return bot.sendMessage(chatId, '❌ Invalid format. Please use DD/MM/YYYY');
      }
      session.checkin = text;
      session.step = 'awaiting_checkout';
      return bot.sendMessage(chatId, '📅 Please enter your *check-out date* (DD/MM/YYYY):', {
        parse_mode: 'Markdown'
      });
    }
    
    if (session.step === 'awaiting_checkout') {
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
        return bot.sendMessage(chatId, '❌ Invalid format. Please use DD/MM/YYYY');
      }
      // Calculate price (simplified - you'd want actual logic)
      session.price = '150,000'; // Placeholder
      return generatePinForBooking(chatId, session.checkin, text);
    }
  }

  // Check for PIN verification
  if (awaitingPin[chatId]) {
    const bookingCode = awaitingPin[chatId];
    delete awaitingPin[chatId];
    return verifyPin(chatId, bookingCode, text.trim());
  }

  // Handle menu navigation
  switch(text) {
    case '/start':
      // 👌 DIRECTLY SHOW MAIN MENU - NO EXTRA MESSAGE
      showMainMenu(chatId);
      break;
      
    case '⬅️ Back to Main Menu':
      showMainMenu(chatId);
      break;
      
    case '🏠 View Apartments':
    case '🔍 Search Again':
    case '🔍 Try Another Location':
      showLocations(chatId);
      break;
      
    case '📞 Contact Admin':
      contactAdmin(chatId);
      break;
      
    case 'ℹ️ About Us':
      aboutUs(chatId);
      break;
      
    // Location selections
    case '🏛️ Maitama':
    case '🏛️ Asokoro':
    case '🏢 Wuse':
    case '🏢 Jabi':
    case '🏘️ Garki':
    case '🏘️ Utako':
      showApartmentsByLocation(chatId, text);
      break;
      
    default:
      // 👇 FIX #2: ANY message from user who deleted chat goes to main menu
      // This handles when user types anything after deleting chat history
      showMainMenu(chatId, 'Welcome Back! 👋\n\nAbuja Shortlet Apartments 🏠, Click On Any Menu Below To Continue 👇👇👇');
      break;
  }
});

/* ================= CALLBACK QUERY HANDLER ================= */
bot.on('callback_query', (cb) => {
  const chatId = cb.message.chat.id;
  const data = cb.data;
  const messageId = cb.message.message_id;

  bot.answerCallbackQuery(cb.id);

  if (data.startsWith('book_')) {
    const apartmentId = data.replace('book_', '');
    startBooking(chatId, apartmentId);
  }
  
  if (data.startsWith('photos_')) {
    const apartmentId = data.replace('photos_', '');
    // For now, send a placeholder
    bot.sendMessage(chatId, '📸 *Photos Feature Coming Soon!* \n\nWe\'re working on adding beautiful photos of our apartments. Check back soon! 🚧', {
      parse_mode: 'Markdown'
    });
  }

  if (data.startsWith('confirm_property_owner_')) {
    const bookingCode = data.replace('confirm_property_owner_', '');
    awaitingPin[chatId] = bookingCode;
    return bot.sendMessage(chatId, '🔐 *Enter tenant PIN:*', {
      parse_mode: 'Markdown'
    });
  }
});

/* ================= VERIFY PIN ================= */
function verifyPin(chatId, bookingCode, pin) {
  db.query(
    `SELECT * FROM bookings 
     WHERE booking_code=? AND access_pin=? AND pin_used=false`,
    [bookingCode, pin],
    (err, rows) => {
      if (err) {
        console.error('Database error in verifyPin:', err);
        return bot.sendMessage(chatId, '❌ *Database Error* \nPlease try again later.', {
          parse_mode: 'Markdown'
        });
      }

      if (rows.length === 0) {
        return bot.sendMessage(chatId, '❌ *Invalid or Used PIN* \nPlease check and try again.', {
          parse_mode: 'Markdown'
        });
      }

      db.query(
        `UPDATE bookings SET pin_used=true, confirmed_at=NOW() WHERE booking_code=?`,
        [bookingCode],
        (updateErr) => {
          if (updateErr) {
            console.error('Error updating PIN status:', updateErr);
            return bot.sendMessage(chatId, '❌ *Error Confirming PIN* \nPlease contact admin.', {
              parse_mode: 'Markdown'
            });
          }
          
          bot.sendMessage(chatId, '✅ *Payment Confirmed!* 🎉\n\nYour booking is complete. Thank you for choosing Abuja Shortlet Apartments! 🏠', {
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [
                ['🏠 View Apartments'],
                ['📞 Contact Admin']
              ],
              resize_keyboard: true
            }
          });
          
          // Notify admin (you'd implement this)
          notifyAdminOfConfirmedBooking(bookingCode);
        }
      );
    }
  );
}

/* ================= NOTIFY ADMIN ================= */
function notifyAdminOfConfirmedBooking(bookingCode) {
  // You can implement this to send a message to an admin group or channel
  console.log(`📢 Booking ${bookingCode} confirmed - would notify admin here`);
}

console.log('✅ Bot Ready - Fixed welcome message and chat history handling');


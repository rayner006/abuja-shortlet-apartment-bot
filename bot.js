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
const path = require('path');

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

// Store owner chat IDs
const ownerChatIds = {};

// Store owner info from database
let ownerInfo = {};

// Load owner info from database on startup
function loadOwnerInfo() {
  db.query('SELECT id, name, telegram_chat_id FROM property_owners', (err, results) => {
    if (err) {
      console.error('Error loading owner info:', err);
    } else {
      results.forEach(owner => {
        if (owner.telegram_chat_id) {
          ownerChatIds[owner.id] = owner.telegram_chat_id;
        }
        ownerInfo[owner.id] = owner;
      });
      console.log('✅ Owner info loaded:', Object.keys(ownerInfo).length, 'owners');
    }
  });
}

// Call this when bot starts
loadOwnerInfo();

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
const selectedLocation = {}; // Store selected location for filtering

/* ================= ERROR HANDLING ================= */
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log(`${process.env.BOT_NAME || 'Abuja Shortlet Bot'} is running...`);

/* ================= MAIN MENU ================= */
function showMainMenu(chatId, text = 'Welcome To\nAbuja Shortlet Apartments 🏠,\nClick On Any Menu Below 👇👇👇') {
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
        ['🏛️ Wuse', '🏛️ Jabi'],
        ['🏛️ Garki', '🏘️ Gwarinpa'],
        ['🏛️ Guzape', '🏛️ Katampe'],
        ['🏘️ Jahi', '💰 Utako'],
        ['🏘️ Wuye', '🏘️ Life Camp'],
        ['🏘️ Apo', '🏘️ Lokogoma'],
        ['🏘️ Kubwa', '🏘️ Lugbe'],
        ['🏘️ Durumi', '🏭 Gwagwalada'],
        ['⬅️ Back to Main Menu']
      ],
      resize_keyboard: true
    }
  });
}

/* ================= SHOW APARTMENT TYPES ================= */
function showApartmentTypes(chatId, location) {
  selectedLocation[chatId] = location;
  
  bot.sendMessage(chatId, `📍 *Location:* ${location.replace(/[🏛️🏘️💰🏭]/g, '').trim()}\n\n🏠 *Select Apartment Type:*`, {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [
        ['🛏️ Self Contain', '🛏️ 1-Bedroom'],
        ['🛏️ 2-Bedroom', '🛏️ 3-Bedroom'],
        ['🔍 Search Again', '⬅️ Back to Main Menu']
      ],
      resize_keyboard: true
    }
  });
}

/* ================= FETCH APARTMENTS BY LOCATION AND TYPE ================= */
function showApartmentsByLocationAndType(chatId, apartmentType) {
  const location = selectedLocation[chatId];
  if (!location) {
    return showLocations(chatId);
  }
  
  const cleanLocation = location.replace(/[🏛️🏘️💰🏭]/g, '').trim();
  let cleanType = apartmentType.replace('🛏️ ', '').trim();
  
  db.query(
    'SELECT * FROM apartments WHERE location = ? AND type = ? AND verified = 1 ORDER BY price',
    [cleanLocation, cleanType],
    (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return bot.sendMessage(chatId, '❌ Error fetching apartments');
      }
      
      if (results.length === 0) {
        return bot.sendMessage(chatId, `😔 No ${cleanType} apartments available in ${cleanLocation} right now.\nTry another apartment type or location!`, {
          reply_markup: {
            keyboard: [
              ['🔍 Search Again'],
              ['⬅️ Back to Main Menu']
            ],
            resize_keyboard: true
          }
        });
      }
      
      results.forEach(apt => {
        let photoPaths = [];
        try {
          if (apt.photo_paths) {
            photoPaths = JSON.parse(apt.photo_paths);
          } else if (apt.photos) {
            photoPaths = apt.photos.split(',').map(p => p.trim());
          }
        } catch (e) {
          console.error('Error parsing photos:', e);
          photoPaths = [];
        }
        
        let typeFolder = '';
        if (apt.type === 'Self Contain') {
          typeFolder = 'self-contain';
        } else if (apt.type === '1-Bedroom') {
          typeFolder = '1-bedroom';
        } else if (apt.type === '2-Bedroom') {
          typeFolder = '2-bedroom';
        } else if (apt.type === '3-Bedroom') {
          typeFolder = '3-bedroom';
        } else {
          typeFolder = apt.type.toLowerCase().replace(' ', '-');
        }
        
        if (photoPaths.length > 0) {
          const mediaGroup = [];
          const photosToSend = photoPaths.slice(0, 10);
          
          photosToSend.forEach((photoPath) => {
            const fullPath = photoPath.startsWith('/') 
              ? photoPath 
              : `/uploads/${apt.location.toLowerCase()}/rayner_apt/${typeFolder}/${photoPath}`;
            
            mediaGroup.push({
              type: 'photo',
              media: path.join(__dirname, fullPath)
            });
          });
          
          bot.sendMediaGroup(chatId, mediaGroup).catch(err => {
            console.error('Error sending media group:', err);
          });
        }
        
        setTimeout(() => {
          const message = `
🏠 *Name:* ${apt.name}
📍 *Location:* ${apt.location}
📌 *Address:* ${apt.address || 'Contact admin for address'}
🏷️ *Type:* ${apt.type}
💰 *Price:* ₦${apt.price}/night
🛏️ *Bedrooms:* ${apt.bedrooms || 0}
🚿 *Bathrooms:* ${apt.bathrooms || 1}
📝 *Description:* ${apt.description}
          `;
          
          bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📅 Book Now', callback_data: `book_${apt.id}` }]
              ]
            }
          });
        }, 1000);
      });
      
      setTimeout(() => {
        bot.sendMessage(chatId, '🔍 *What would you like to do next?*', {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              ['🔍 Search Again'],
              ['⬅️ Back to Main Menu']
            ],
            resize_keyboard: true
          }
        });
      }, 2000);
      
      delete selectedLocation[chatId];
    }
  );
}

/* ================= SEND NOTIFICATION TO OWNER ================= */
function notifyOwner(ownerId, bookingInfo) {
  const ownerChatId = ownerChatIds[ownerId];
  if (!ownerChatId) {
    console.log(`Owner ${ownerId} has no chat ID registered`);
    return;
  }
  
  const message = `
🏠 *NEW BOOKING REQUEST!* 🏠

🔑 *Booking Code:* \`${bookingInfo.bookingCode}\`
🆔 *Booking ID:* ${bookingInfo.bookingId}

👤 *Guest Details:*
• Name: ${bookingInfo.guestName}
• Username: @${bookingInfo.guestUsername}
• Phone: ${bookingInfo.guestPhone}

🏠 *Apartment Details:*
• Name: ${bookingInfo.apartmentName}
• Location: ${bookingInfo.location}
• Type: ${bookingInfo.type}
• Price: ₦${bookingInfo.price}/night

📅 *Booking Date:* ${new Date().toLocaleString()}
💰 *Commission:* ₦${bookingInfo.price * 0.1}

Please contact the guest to confirm their booking.
  `;
  
  bot.sendMessage(ownerChatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Confirm Booking', callback_data: `confirm_owner_${bookingInfo.bookingCode}` }],
        [{ text: '📞 Guest Contacted', callback_data: `contacted_${bookingInfo.bookingCode}` }]
      ]
    }
  }).catch(err => {
    console.error('Error notifying owner:', err);
  });
}

/* ================= START BOOKING PROCESS ================= */
function startBooking(chatId, apartmentId) {
  db.query(
    'SELECT * FROM apartments WHERE id = ?',
    [apartmentId],
    (err, results) => {
      if (err || results.length === 0) {
        return bot.sendMessage(chatId, '❌ Apartment not found');
      }
      
      const apt = results[0];
      
      userSessions[chatId] = { 
        apartmentId, 
        apartmentName: apt.name,
        apartmentPrice: apt.price,
        apartmentLocation: apt.location,
        apartmentType: apt.type,
        ownerId: apt.owner_id,
        step: 'awaiting_phone'
      };
      
      bot.sendMessage(chatId, '📱 *Please enter your phone number:*\n\nWe will contact you shortly to confirm your booking.', {
        parse_mode: 'Markdown',
        reply_markup: {
          force_reply: true,
          selective: true
        }
      });
    }
  );
}

/* ================= PROCESS BOOKING WITH USER INFO ================= */
function processBookingWithUserInfo(chatId, phoneNumber, msg) {
  const session = userSessions[chatId];
  if (!session) {
    return showMainMenu(chatId);
  }
  
  const userId = msg.from.id;
  const firstName = msg.from.first_name || '';
  const lastName = msg.from.last_name || '';
  const username = msg.from.username || 'No username';
  const fullName = `${firstName} ${lastName}`.trim();
  
  const bookingCode = 'BOOK' + Date.now().toString().slice(-8);
  const amount = session.apartmentPrice;
  const commission = amount * 0.1; // 10% commission
  
  const query = `
    INSERT INTO bookings (
      apartment_id,
      user_id,
      user_name,
      username,
      phone,
      amount,
      commission,
      booking_code,
      status,
      pin_used,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;
  
  const values = [
    session.apartmentId,
    userId,
    fullName,
    username,
    phoneNumber,
    amount,
    commission,
    bookingCode,
    'pending',
    false
  ];
  
  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Error creating booking:', err);
      
      let errorMessage = '❌ Error creating booking. ';
      if (err.code === 'ER_NO_SUCH_TABLE') {
        errorMessage += 'Bookings table does not exist.';
      } else if (err.code === 'ER_BAD_NULL_ERROR') {
        errorMessage += 'Missing required field.';
      } else if (err.code === 'ER_DUP_ENTRY') {
        errorMessage += 'Duplicate booking code. Please try again.';
      } else {
        errorMessage += 'Please try again or contact admin.';
      }
      
      return bot.sendMessage(chatId, errorMessage);
    }
    
    const message = `
✅ *Booking Request Received!*

🔑 *Your Booking Code:* \`${bookingCode}\`

👤 *Your Details:*
• Name: ${fullName}
• Username: @${username}
• Phone: ${phoneNumber}
• Apartment: ${session.apartmentName}
• Amount: ₦${amount}

📌 *Next Steps:*
Our team will contact you shortly via phone or Telegram to confirm your booking and provide payment details.

Thank you for choosing Abuja Shortlet Apartments! 🏠
    `;
    
    bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          ['🏠 View Apartments'],
          ['📞 Contact Admin']
        ],
        resize_keyboard: true
      }
    });
    
    const bookingInfo = {
      bookingCode: bookingCode,
      guestName: fullName,
      guestUsername: username,
      guestPhone: phoneNumber,
      apartmentName: session.apartmentName,
      location: session.apartmentLocation,
      type: session.apartmentType,
      price: amount,
      bookingId: result.insertId
    };
    
    if (session.ownerId) {
      notifyOwner(session.ownerId, bookingInfo);
    }
    
    console.log(`📢 NEW BOOKING: ${bookingCode} - ${fullName} (@${username}) - ${phoneNumber} - ${session.apartmentName}`);
    
    delete userSessions[chatId];
  });
}

/* ================= OWNER REGISTRATION ================= */
bot.onText(/\/register_owner (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const ownerId = parseInt(match[1]);
  
  db.query(
    'UPDATE property_owners SET telegram_chat_id = ? WHERE id = ?',
    [chatId, ownerId],
    (err) => {
      if (err) {
        console.error('Error registering owner:', err);
        return bot.sendMessage(chatId, '❌ Error registering. Please check owner ID.');
      }
      
      bot.sendMessage(chatId, `✅ Successfully registered as owner ID: ${ownerId}\nYou will now receive booking notifications.`);
      
      ownerChatIds[ownerId] = chatId;
    }
  );
});

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

We provide premium short-let apartments across Abuja's finest locations:

🏛️ *Our Locations:*
Maitama • Asokoro • Wuse • Jabi • Garki • Gwarinpa
Guzape • Katampe • Jahi • Utako • Wuye • Life Camp
Apo • Lokogoma • Kubwa • Lugbe • Durumi • Gwagwalada

🏠 *Apartment Types:*
Self Contain • 1-Bedroom • 2-Bedroom • 3-Bedroom

👤 *Featured Owners:*
Rayner in Kubwa • More owners coming soon!

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

  if (userSessions[chatId] && userSessions[chatId].step === 'awaiting_phone') {
    if (text.length < 10) {
      return bot.sendMessage(chatId, '❌ Please enter a valid phone number (at least 10 digits)');
    }
    return processBookingWithUserInfo(chatId, text, msg);
  }

  if (awaitingPin[chatId]) {
    const bookingCode = awaitingPin[chatId];
    delete awaitingPin[chatId];
    return verifyPin(chatId, bookingCode, text.trim());
  }

  switch(text) {
    case '/start':
      showMainMenu(chatId);
      break;
      
    case '⬅️ Back to Main Menu':
      showMainMenu(chatId);
      break;
      
    case '🏠 View Apartments':
    case '🔍 Search Again':
      showLocations(chatId);
      break;
      
    case '📞 Contact Admin':
      contactAdmin(chatId);
      break;
      
    case 'ℹ️ About Us':
      aboutUs(chatId);
      break;
      
    case '🛏️ Self Contain':
    case '🛏️ 1-Bedroom':
    case '🛏️ 2-Bedroom':
    case '🛏️ 3-Bedroom':
      showApartmentsByLocationAndType(chatId, text);
      break;
      
    case '🏛️ Maitama':
    case '🏛️ Asokoro':
    case '🏛️ Wuse':
    case '🏛️ Jabi':
    case '🏛️ Garki':
    case '🏘️ Gwarinpa':
    case '🏛️ Guzape':
    case '🏛️ Katampe':
    case '🏘️ Jahi':
    case '💰 Utako':
    case '🏘️ Wuye':
    case '🏘️ Life Camp':
    case '🏘️ Apo':
    case '🏘️ Lokogoma':
    case '🏘️ Kubwa':
    case '🏘️ Lugbe':
    case '🏘️ Durumi':
    case '🏭 Gwagwalada':
      showApartmentTypes(chatId, text);
      break;
      
    default:
      showMainMenu(chatId, 'Welcome Back! 👋\n\nAbuja Shortlet Apartments 🏠,\nClick On Any Menu Below 👇👇👇');
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

  if (data.startsWith('confirm_owner_')) {
    const bookingCode = data.replace('confirm_owner_', '');
    
    db.query(
      'UPDATE bookings SET owner_confirmed = true, owner_confirmed_at = NOW(), status = ? WHERE booking_code = ?',
      ['confirmed', bookingCode],
      (err) => {
        if (err) {
          console.error('Error confirming booking:', err);
          return bot.sendMessage(chatId, '❌ Error confirming booking');
        }
        
        bot.sendMessage(chatId, `✅ Booking ${bookingCode} confirmed. Commission will be processed.`);
        
        bot.editMessageText(
          cb.message.text + '\n\n✅ *CONFIRMED BY OWNER*',
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
          }
        ).catch(e => console.log('Error editing message:', e));
      }
    );
  }

  if (data.startsWith('contacted_')) {
    const bookingCode = data.replace('contacted_', '');
    bot.sendMessage(chatId, `✅ Marked booking ${bookingCode} as contacted.`);
    
    bot.editMessageText(
      cb.message.text + '\n\n📞 *GUEST CONTACTED*',
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      }
    ).catch(e => console.log('Error editing message:', e));
  }

  if (data.startsWith('confirm_property_owner_')) {
    const bookingCode = data.replace('confirm_property_owner_', '');
    awaitingPin[chatId] = bookingCode;
    return bot.sendMessage(chatId, '🔐 *Enter tenant PIN:*', {
      parse_mode: 'Markdown'
    });
  }
  
  if (data === 'search_again') {
    showLocations(chatId);
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
        `UPDATE bookings SET pin_used=true, tenant_confirmed_at=NOW(), status=? WHERE booking_code=?`,
        ['completed', bookingCode],
        (updateErr) => {
          if (updateErr) {
            console.error('Error updating PIN status:', updateErr);
            return bot.sendMessage(chatId, '❌ *Error Confirming PIN* \nPlease contact admin.', {
              parse_mode: 'Markdown'
            });
          }
          
          bot.sendMessage(chatId, '✅ *Payment Confirmed!* 🎉\n\nYour booking is complete.\nThank you for choosing Abuja Shortlet Apartments! 🏠', {
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [
                ['🏠 View Apartments'],
                ['📞 Contact Admin']
              ],
              resize_keyboard: true
            }
          });
          
          console.log(`📢 Booking ${bookingCode} confirmed by tenant`);
        }
      );
    }
  );
}

console.log('✅ Bot Ready - Fully matched with your database structure! 🏠');

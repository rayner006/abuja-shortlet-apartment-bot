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

// Store owner chat IDs (you'll need to get these from owners)
// Format: { apartment_id: owner_chat_id }
const ownerChatIds = {
  // Add owner chat IDs here when they start the bot
  // Example: 1: 123456789, // Rayner's chat ID for apartment id 1
};

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
const awaitingPhone = {}; // Store users waiting to input phone number

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
  // Store the selected location
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
  
  // Clean up location and apartment type
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
      
      // Send each apartment with ALL photos in one media group
      results.forEach(apt => {
        // Get all photos for this apartment
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
        
        // Determine the folder path based on apartment type
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
        
        // Create ONE media group with ALL photos - NO CAPTION
        if (photoPaths.length > 0) {
          const mediaGroup = [];
          
          // Add up to 10 photos to media group (Telegram limit)
          const photosToSend = photoPaths.slice(0, 10);
          
          photosToSend.forEach((photoPath) => {
            const fullPath = photoPath.startsWith('/') 
              ? photoPath 
              : `/uploads/${apt.location.toLowerCase()}/rayner_apt/${typeFolder}/${photoPath}`;
            
            mediaGroup.push({
              type: 'photo',
              media: path.join(__dirname, fullPath)
              // NO CAPTION - removed completely
            });
          });
          
          // Send ALL photos in ONE album/box with no text
          bot.sendMediaGroup(chatId, mediaGroup).catch(err => {
            console.error('Error sending media group:', err);
          });
        }
        
        // Then send the apartment details with Book Now button
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
      
      // Show options after all apartments
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
      
      // Clear the selected location
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

Please contact the guest to confirm their booking.
  `;
  
  bot.sendMessage(ownerChatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Mark as Contacted', callback_data: `contacted_${bookingInfo.bookingCode}` }]
      ]
    }
  }).catch(err => {
    console.error('Error notifying owner:', err);
  });
}

/* ================= START BOOKING PROCESS ================= */
function startBooking(chatId, apartmentId) {
  // Get apartment details first
  db.query(
    'SELECT * FROM apartments WHERE id = ?',
    [apartmentId],
    (err, results) => {
      if (err || results.length === 0) {
        return bot.sendMessage(chatId, '❌ Apartment not found');
      }
      
      const apt = results[0];
      
      // Store apartment details in session
      userSessions[chatId] = { 
        apartmentId, 
        apartmentName: apt.name,
        apartmentPrice: apt.price,
        apartmentLocation: apt.location,
        apartmentType: apt.type,
        ownerId: apt.owner_id,
        step: 'awaiting_phone'
      };
      
      // Ask for phone number
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
  
  // Get user info from message
  const userId = msg.from.id;
  const firstName = msg.from.first_name || '';
  const lastName = msg.from.last_name || '';
  const username = msg.from.username || 'No username';
  const fullName = `${firstName} ${lastName}`.trim();
  
  // Generate booking code
  const bookingCode = 'BOOK' + Date.now().toString().slice(-8);
  const pin = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit PIN
  
  // First, let's check what columns exist
  db.query('DESCRIBE bookings', (err, columns) => {
    if (err) {
      console.error('Error describing table:', err);
      return bot.sendMessage(chatId, '❌ Database error. Please contact admin.');
    }
    
    // Log columns for debugging
    console.log('Bookings table columns:', columns.map(c => c.Field));
    
    // Build dynamic query based on existing columns
    let query = 'INSERT INTO bookings (';
    let values = [];
    let placeholders = [];
    
    // Common columns that might exist
    const possibleColumns = [
      { name: 'booking_code', value: bookingCode },
      { name: 'apartment_id', value: session.apartmentId },
      { name: 'user_id', value: userId },
      { name: 'user_name', value: fullName },
      { name: 'username', value: username },
      { name: 'phone', value: phoneNumber },
      { name: 'access_pin', value: pin },
      { name: 'pin_used', value: false },
      { name: 'created_at', value: new Date() }
    ];
    
    // Only include columns that exist in the table
    possibleColumns.forEach(col => {
      if (columns.some(c => c.Field === col.name)) {
        query += col.name + ',';
        placeholders.push('?');
        values.push(col.value);
      }
    });
    
    // Remove trailing comma and close parentheses
    query = query.slice(0, -1) + ') VALUES (' + placeholders.join(',') + ')';
    
    console.log('Executing query:', query);
    console.log('With values:', values);
    
    db.query(query, values, (err) => {
      if (err) {
        console.error('Error creating booking:', err);
        
        // Send more specific error message
        let errorMessage = '❌ Error creating booking. ';
        if (err.code === 'ER_NO_SUCH_TABLE') {
          errorMessage += 'Bookings table does not exist.';
        } else if (err.code === 'ER_BAD_NULL_ERROR') {
          errorMessage += 'Missing required field.';
        } else {
          errorMessage += 'Please try again or contact admin.';
        }
        
        return bot.sendMessage(chatId, errorMessage);
      }
      
      // Send confirmation to user
      const message = `
✅ *Booking Request Received!*

🔑 *Your Booking Code:* \`${bookingCode}\`

👤 *Your Details:*
• Name: ${fullName}
• Username: @${username}
• Phone: ${phoneNumber}
• Apartment: ${session.apartmentName}

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
      
      // Prepare booking info for owner notification
      const bookingInfo = {
        bookingCode: bookingCode,
        guestName: fullName,
        guestUsername: username,
        guestPhone: phoneNumber,
        apartmentName: session.apartmentName,
        location: session.apartmentLocation,
        type: session.apartmentType,
        price: session.apartmentPrice
      };
      
      // Notify the apartment owner
      if (session.ownerId) {
        notifyOwner(session.ownerId, bookingInfo);
      } else {
        console.log('No owner ID for this apartment');
      }
      
      // Notify admin about new booking
      notifyAdminOfNewBooking(bookingCode, fullName, username, phoneNumber, session.apartmentName);
      
      // Clear session
      delete userSessions[chatId];
    });
  });
}

/* ================= NOTIFY ADMIN ABOUT NEW BOOKING ================= */
function notifyAdminOfNewBooking(bookingCode, name, username, phone, apartmentName) {
  // You can implement this to send a message to an admin group or channel
  console.log(`📢 NEW BOOKING: ${bookingCode} - ${name} (@${username}) - ${phone} - ${apartmentName}`);
  
  // TODO: Send to admin Telegram chat
  // bot.sendMessage(ADMIN_CHAT_ID, `📢 New Booking!\n\nCode: ${bookingCode}\nName: ${name}\nUsername: @${username}\nPhone: ${phone}\nApartment: ${apartmentName}`);
}

/* ================= OWNER REGISTRATION ================= */
// Add this for owners to register their chat ID
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
      
      // Update in-memory cache
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

  // Check if user is in booking flow and waiting for phone number
  if (userSessions[chatId] && userSessions[chatId].step === 'awaiting_phone') {
    // Validate phone number (basic validation - can be improved)
    if (text.length < 10) {
      return bot.sendMessage(chatId, '❌ Please enter a valid phone number (at least 10 digits)');
    }
    return processBookingWithUserInfo(chatId, text, msg);
  }

  // Check if user is in PIN verification flow
  if (awaitingPin[chatId]) {
    const bookingCode = awaitingPin[chatId];
    delete awaitingPin[chatId];
    return verifyPin(chatId, bookingCode, text.trim());
  }

  // Handle menu navigation
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
      
    // Apartment type selections
    case '🛏️ Self Contain':
    case '🛏️ 1-Bedroom':
    case '🛏️ 2-Bedroom':
    case '🛏️ 3-Bedroom':
      showApartmentsByLocationAndType(chatId, text);
      break;
      
    // All locations
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

  bot.answerCallbackQuery(cb.id);

  if (data.startsWith('book_')) {
    const apartmentId = data.replace('book_', '');
    startBooking(chatId, apartmentId);
  }

  if (data.startsWith('contacted_')) {
    const bookingCode = data.replace('contacted_', '');
    bot.sendMessage(chatId, `✅ Marked booking ${bookingCode} as contacted.`);
    // You could update a database field here
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
        `UPDATE bookings SET pin_used=true, confirmed_at=NOW() WHERE booking_code=?`,
        [bookingCode],
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
          
          notifyAdminOfConfirmedBooking(bookingCode);
        }
      );
    }
  );
}

/* ================= NOTIFY ADMIN ================= */
function notifyAdminOfConfirmedBooking(bookingCode) {
  console.log(`📢 Booking ${bookingCode} confirmed - would notify admin here`);
}

console.log('✅ Bot Ready - Enhanced booking with owner notifications! 🏠');

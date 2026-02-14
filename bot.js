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
const path = require('path');
const fs = require('fs');

// Import from utils folder
const { generateaccesspin, validatePIN, generateBookingCode } = require('./utils/pingenerator');
const {
  getMainMenuKeyboard,
  getLocationsKeyboard,
  getApartmentTypesKeyboard,
  getApartmentActionsKeyboard,
  getOwnerActionsKeyboard,
  getAdminActionsKeyboard,
  getBackKeyboard,
  getSearchOptionsKeyboard
} = require('./utils/keyboard');

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

// Admin IDs
const ADMIN_IDS = [6947618479];

// Store owner chat IDs
const ownerChatIds = {};

// Store owner info from database
let ownerInfo = {};

// Log all incoming messages
bot.on('message', (msg) => {
  console.log('📨 Message received:', {
    chatId: msg.chat.id,
    from: msg.from.username || msg.from.first_name,
    text: msg.text,
    isAdmin: ADMIN_IDS.includes(msg.chat.id) ? '✅ ADMIN' : '❌ Not Admin'
  });
});

// ================= USER MANAGEMENT =================
function saveUserInfo(msg) {
  const telegramId = msg.from.id;
  const name = msg.from.first_name || '';
  const username = msg.from.username || '';
  const languageCode = msg.from.language_code || 'en';
  const isBot = msg.from.is_bot ? 1 : 0;
  
  let role = 'user';
  if (ADMIN_IDS.includes(telegramId)) {
    role = 'admin';
  }
  
  const query = `
    INSERT INTO users (telegram_id, name, username, language_code, is_bot, role, first_seen, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      username = VALUES(username),
      language_code = VALUES(language_code),
      is_bot = VALUES(is_bot),
      role = VALUES(role),
      last_seen = NOW()
  `;
  
  db.query(query, [telegramId, name, username, languageCode, isBot, role], (err) => {
    if (err) console.error('Error saving user:', err);
  });
}

// Load owner info
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

loadOwnerInfo();

// Graceful shutdown
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
const userSessions = {};
const selectedLocation = {};

/* ================= ERROR HANDLING ================= */
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log(`${process.env.BOT_NAME || 'Abuja Shortlet Bot'} is running...`);

/* ================= MAIN MENU ================= */
function showMainMenu(chatId, text = 'Welcome To\nAbuja Shortlet Apartments 🏠,\nClick On Any Menu Below 👇👇👇') {
  const keyboard = getMainMenuKeyboard();
  bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard.reply_markup
  });
}

/* ================= SHOW LOCATIONS ================= */
function showLocations(chatId) {
  const keyboard = getLocationsKeyboard();
  bot.sendMessage(chatId, '📍 *Select a location:*', {
    parse_mode: 'Markdown',
    reply_markup: keyboard.reply_markup
  });
}

/* ================= SHOW APARTMENT TYPES ================= */
function showApartmentTypes(chatId, location) {
  selectedLocation[chatId] = location;
  
  const keyboard = getApartmentTypesKeyboard(location);
  bot.sendMessage(chatId, `📍 *Location:* ${location.replace(/[🏛️🏘️💰🏭]/g, '').trim()}\n\n🏠 *Select Apartment Type:*`, {
    parse_mode: 'Markdown',
    reply_markup: keyboard.reply_markup
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
        const keyboard = getSearchOptionsKeyboard();
        return bot.sendMessage(chatId, `😔 No ${cleanType} apartments available in ${cleanLocation} right now.\nTry another apartment type or location!`, {
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup
        });
      }
      
      results.forEach(apt => {
        // Get photo paths from database
        let photoPaths = [];
        try {
          if (apt.photo_paths) {
            photoPaths = JSON.parse(apt.photo_paths);
            console.log(`📸 ${apt.type} - Raw photo_paths from DB:`, apt.photo_paths);
          } else if (apt.photos) {
            photoPaths = apt.photos.split(',').map(p => p.trim());
            console.log(`📸 ${apt.type} - Using photos field:`, apt.photos);
          }
        } catch (e) {
          console.error('Error parsing photos:', e);
          photoPaths = [];
        }
        
        console.log(`📸 ${apt.type} - Final photo paths:`, photoPaths);
        
        // FIXED: Don't add extra slash - use paths directly from database
        if (photoPaths.length > 0) {
          // Send photos one by one with proper path handling
          photoPaths.forEach((photoPath, index) => {
            // Use path.join which handles slashes correctly
            const fullPath = path.join(__dirname, photoPath);
            console.log(`📸 ${apt.type} - Photo ${index + 1} full path:`, fullPath);
            
            // Check if file exists
            if (fs.existsSync(fullPath)) {
              console.log(`✅ ${apt.type} - Photo ${index + 1} exists`);
            } else {
              console.log(`❌ ${apt.type} - Photo ${index + 1} NOT found at:`, fullPath);
            }
            
            // Add delay between photos to avoid flooding
            setTimeout(() => {
              bot.sendPhoto(chatId, fullPath, {
                caption: index === 0 ? `📸 *${apt.name}*` : undefined,
                parse_mode: 'Markdown'
              }).catch(err => {
                console.error(`Error sending photo ${index + 1} for ${apt.type}:`, err.message);
              });
            }, index * 500); // 500ms delay between each photo
          });
        } else {
          bot.sendMessage(chatId, `📸 No photos available for ${apt.name}`);
        }
        
        // Send apartment details with Book Now button after photos
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
          
          const keyboard = getApartmentActionsKeyboard(apt.id);
          
          bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          }).catch(err => {
            console.error('Error sending apartment details:', err);
          });
          
        }, photoPaths.length * 500 + 1000);
      });
      
      // Show search options after all apartments
      setTimeout(() => {
        const keyboard = getSearchOptionsKeyboard();
        bot.sendMessage(chatId, '🔍 *What would you like to do next?*', {
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup
        });
      }, 5000);
      
      delete selectedLocation[chatId];
    }
  );
}

// ... rest of your code remains exactly the same ...

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
  
  const keyboard = getOwnerActionsKeyboard(bookingInfo.bookingCode);
  bot.sendMessage(ownerChatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  }).catch(err => {
    console.error('Error notifying owner:', err);
  });
}

/* ================= NOTIFY ADMIN ABOUT NEW BOOKING ================= */
function notifyAdminNewBooking(bookingInfo) {
  console.log('📢 Attempting to notify admin with ID:', ADMIN_IDS[0]);
  
  ADMIN_IDS.forEach(adminId => {
    const message = `
🔔 *NEW BOOKING ALERT!* 🔔

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
• Owner ID: ${bookingInfo.ownerId || 'Not assigned'}

📅 *Booking Time:* ${new Date().toLocaleString()}
💰 *Your Commission (10%):* ₦${bookingInfo.price * 0.1}

━━━━━━━━━━━━━━━━
📊 *Quick Actions:*
• Check owner subscription: /check_subscription ${bookingInfo.ownerId || '?'}
• View all commissions: /commissions
• Dashboard: /dashboard
    `;
    
    const keyboard = getAdminActionsKeyboard(bookingInfo.bookingCode);
    bot.sendMessage(adminId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }).then(() => {
      console.log(`✅ Admin notification sent successfully to ${adminId}`);
    }).catch(err => {
      console.error(`❌ Error notifying admin ${adminId}:`, err.message);
    });
  });
}

/* ================= NOTIFY OWNER ABOUT COMMISSION ================= */
function notifyOwnerCommission(ownerId, bookingCode, amount) {
  const ownerChatId = ownerChatIds[ownerId];
  if (!ownerChatId) return;
  
  const commission = amount * 0.1;
  
  bot.sendMessage(ownerChatId, 
    `💰 *Commission Update*\n\nBooking ${bookingCode} is confirmed.\nYour commission: ₦${commission}\nThis will be settled according to your agreement.`,
    { parse_mode: 'Markdown' }
  ).catch(err => console.error('Error notifying owner:', err));
}

/* ================= TRACK COMMISSION ================= */
function trackCommission(bookingId, bookingCode, ownerId, apartmentId, amount) {
  const commission = amount * 0.1;
  
  db.query('SHOW TABLES LIKE "commission_tracking"', (err, tables) => {
    if (err || tables.length === 0) {
      console.log('Commission tracking table not yet created');
      return;
    }
    
    db.query(
      `INSERT INTO commission_tracking 
       (booking_id, owner_id, apartment_id, booking_code, guest_name, amount_paid, commission_amount, commission_status)
       SELECT ?, ?, ?, ?, user_name, ?, ?, 'pending'
       FROM bookings WHERE id = ?`,
      [bookingId, ownerId, apartmentId, bookingCode, amount, commission, bookingId],
      (err) => {
        if (err) {
          console.error('Error tracking commission:', err);
        } else {
          console.log(`✅ Commission tracked: ₦${commission} for booking ${bookingCode}`);
        }
      }
    );
  });
}

/* ================= TEST COMMANDS ================= */
bot.onText(/\/test_admin/, (msg) => {
  const chatId = msg.chat.id;
  
  if (ADMIN_IDS.includes(chatId)) {
    bot.sendMessage(chatId, '✅ *You are recognized as admin!*\n\nNotifications will work.', {
      parse_mode: 'Markdown'
    });
  } else {
    bot.sendMessage(chatId, '❌ *You are NOT in admin list*\n\nContact the bot owner.', {
      parse_mode: 'Markdown'
    });
  }
});

bot.onText(/\/test_pin/, (msg) => {
  const testPin = generateaccesspin();
  bot.sendMessage(msg.chat.id, `🔐 *Test PIN:* \`${testPin}\`\n📏 *Length:* ${testPin.length}`, {
    parse_mode: 'Markdown'
  });
});

bot.onText(/\/test_notify/, (msg) => {
  const chatId = msg.chat.id;
  if (ADMIN_IDS.includes(chatId)) {
    const testBooking = {
      bookingCode: 'TEST' + Date.now().toString().slice(-8),
      bookingId: 999,
      guestName: 'Test User',
      guestUsername: 'testuser',
      guestPhone: '08000000000',
      apartmentName: 'Test Apartment',
      location: 'Test Location',
      type: 'Test Type',
      price: 50000,
      ownerId: 1
    };
    notifyAdminNewBooking(testBooking);
    bot.sendMessage(chatId, '📨 *Test notification sent!*\nCheck if you received it.', {
      parse_mode: 'Markdown'
    });
  } else {
    bot.sendMessage(chatId, '❌ Only admin can use this command.');
  }
});

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
  const fullName = msg.from.first_name || '';
  const username = msg.from.username || 'No username';
  
  const bookingCode = generateBookingCode();
  const amount = session.apartmentPrice;
  const commission = amount * 0.1;
  const pin = generateaccesspin();
  
  if (!validatePIN(pin)) {
    return bot.sendMessage(chatId, '❌ Error generating valid PIN. Please try again.');
  }
  
  const query = `
    INSERT INTO bookings (
      apartment_id,
      user_id,
      amount,
      commission,
      booking_code,
      status,
      access_pin,
      pin_used,
      user_name,
      username,
      phone,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;
  
  const values = [
    session.apartmentId,
    userId,
    amount,
    commission,
    bookingCode,
    'pending',
    pin,
    0,
    fullName,
    username,
    phoneNumber
  ];
  
  db.query(query, values, (err, result) => {
    if (err) {
      console.error('❌ Error creating booking:', err);
      return bot.sendMessage(chatId, '❌ Error creating booking. Please try again.');
    }
    
    db.query(
      'UPDATE users SET total_bookings = total_bookings + 1 WHERE telegram_id = ?',
      [userId]
    );
    
    const message = `
✅ *Booking Request Received!*

🔑 *Your Booking Code:* \`${bookingCode}\`
🔐 *Your PIN:* \`${pin}\`

👤 *Your Details:*
• Name: ${fullName}
• Username: @${username}
• Phone: ${phoneNumber}
• Apartment: ${session.apartmentName}
• Amount: ₦${amount}

📌 *Next Steps:*
1. Our team will contact you shortly
2. Use the PIN above for verification
3. Send the PIN when asked to confirm

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
      bookingId: result.insertId,
      ownerId: session.ownerId
    };
    
    if (session.ownerId) {
      notifyOwner(session.ownerId, bookingInfo);
    }
    
    notifyAdminNewBooking(bookingInfo);
    
    delete userSessions[chatId];
  });
}

/* ================= ADMIN COMMANDS ================= */
function isAdmin(chatId) {
  return ADMIN_IDS.includes(chatId);
}

bot.onText(/\/add_subscription (\d+) (\d{4}-\d{2}-\d{2}) (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  
  if (!isAdmin(chatId)) {
    return bot.sendMessage(chatId, '❌ This command is for admins only.');
  }
  
  const ownerId = parseInt(match[1]);
  const endDate = match[2];
  const amount = parseFloat(match[3]);
  const startDate = new Date().toISOString().split('T')[0];
  
  db.query(
    `INSERT INTO owner_subscriptions 
     (owner_id, owner_name, subscription_start, subscription_end, amount, payment_status) 
     SELECT ?, name, ?, ?, ?, 'paid'
     FROM property_owners WHERE id = ?`,
    [ownerId, startDate, endDate, amount, ownerId],
    (err) => {
      if (err) {
        console.error('Error adding subscription:', err);
        return bot.sendMessage(chatId, '❌ Error adding subscription.');
      }
      
      db.query(
        `UPDATE property_owners 
         SET subscription_status = 'active', subscription_expiry = ? 
         WHERE id = ?`,
        [endDate, ownerId]
      );
      
      bot.sendMessage(chatId, `✅ Subscription added for owner ID ${ownerId}\n📅 Expires: ${endDate}\n💰 Amount: ₦${amount}`);
    }
  );
});

bot.onText(/\/check_subscription (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  
  if (!isAdmin(chatId)) {
    return bot.sendMessage(chatId, '❌ This command is for admins only.');
  }
  
  const ownerId = parseInt(match[1]);
  
  db.query(
    `SELECT o.name, o.subscription_status, o.subscription_expiry, 
            COUNT(s.id) as total_payments,
            SUM(s.amount) as total_paid
     FROM property_owners o
     LEFT JOIN owner_subscriptions s ON o.id = s.owner_id
     WHERE o.id = ?
     GROUP BY o.id`,
    [ownerId],
    (err, results) => {
      if (err || results.length === 0) {
        return bot.sendMessage(chatId, '❌ Owner not found.');
      }
      
      const owner = results[0];
      const today = new Date();
      const expiry = owner.subscription_expiry ? new Date(owner.subscription_expiry) : null;
      let statusEmoji = '✅';
      
      if (owner.subscription_status === 'expired') statusEmoji = '❌';
      else if (expiry && expiry < today) statusEmoji = '⚠️';
      
      const message = `
👤 *Owner:* ${owner.name}
🆔 *ID:* ${ownerId}
${statusEmoji} *Status:* ${owner.subscription_status || 'pending'}
📅 *Expiry:* ${owner.subscription_expiry || 'Not set'}
💰 *Total Paid:* ₦${owner.total_paid || 0}
📊 *Payments:* ${owner.total_payments || 0}

${expiry && expiry < today ? '⚠️ *SUBSCRIPTION EXPIRED*' : ''}
      `;
      
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
  );
});

bot.onText(/\/expired_subs/, (msg) => {
  const chatId = msg.chat.id;
  
  if (!isAdmin(chatId)) {
    return bot.sendMessage(chatId, '❌ This command is for admins only.');
  }
  
  const today = new Date().toISOString().split('T')[0];
  
  db.query(
    `SELECT id, name, subscription_expiry 
     FROM property_owners 
     WHERE subscription_expiry < ? OR subscription_status = 'expired'`,
    [today],
    (err, results) => {
      if (err) {
        console.error('Error fetching expired subs:', err);
        return bot.sendMessage(chatId, '❌ Error fetching data.');
      }
      
      if (results.length === 0) {
        return bot.sendMessage(chatId, '✅ All subscriptions are active!');
      }
      
      let message = '⚠️ *EXPIRED SUBSCRIPTIONS:*\n\n';
      results.forEach(owner => {
        message += `👤 ${owner.name} (ID: ${owner.id})\n`;
        message += `📅 Expired: ${owner.subscription_expiry}\n\n`;
      });
      
      bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }
  );
});

bot.onText(/\/commissions(?:\s+(\d+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  
  if (!isAdmin(chatId)) {
    return bot.sendMessage(chatId, '❌ This command is for admins only.');
  }
  
  const ownerId = match[1] ? parseInt(match[1]) : null;
  
  let query = `
    SELECT 
      o.name as owner_name,
      COUNT(c.id) as total_bookings,
      SUM(c.amount_paid) as total_revenue,
      SUM(c.commission_amount) as total_commission,
      SUM(CASE WHEN c.commission_status = 'paid' THEN c.commission_amount ELSE 0 END) as paid_commission,
      SUM(CASE WHEN c.commission_status = 'pending' THEN c.commission_amount ELSE 0 END) as pending_commission
    FROM commission_tracking c
    JOIN property_owners o ON c.owner_id = o.id
  `;
  
  const params = [];
  if (ownerId) {
    query += ' WHERE c.owner_id = ?';
    params.push(ownerId);
  }
  
  query += ' GROUP BY c.owner_id, o.name ORDER BY total_commission DESC';
  
  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error fetching commissions:', err);
      return bot.sendMessage(chatId, '❌ Error fetching data.');
    }
    
    if (results.length === 0) {
      return bot.sendMessage(chatId, '📊 No commission data found.');
    }
    
    let message = '💰 *COMMISSION REPORT*\n\n';
    let grandTotal = 0;
    let grandPaid = 0;
    let grandPending = 0;
    
    results.forEach(row => {
      message += `👤 *${row.owner_name}*\n`;
      message += `📊 Bookings: ${row.total_bookings}\n`;
      message += `💰 Revenue: ₦${parseFloat(row.total_revenue || 0).toLocaleString()}\n`;
      message += `💵 Commission (10%): ₦${parseFloat(row.total_commission || 0).toLocaleString()}\n`;
      message += `✅ Paid: ₦${parseFloat(row.paid_commission || 0).toLocaleString()}\n`;
      message += `⏳ Pending: ₦${parseFloat(row.pending_commission || 0).toLocaleString()}\n\n`;
      
      grandTotal += parseFloat(row.total_commission || 0);
      grandPaid += parseFloat(row.paid_commission || 0);
      grandPending += parseFloat(row.pending_commission || 0);
    });
    
    message += `━━━━━━━━━━━━━━━━\n`;
    message += `📊 *TOTALS:*\n`;
    message += `💰 Total Commission: ₦${grandTotal.toLocaleString()}\n`;
    message += `✅ Total Paid: ₦${grandPaid.toLocaleString()}\n`;
    message += `⏳ Total Pending: ₦${grandPending.toLocaleString()}`;
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  });
});

bot.onText(/\/pay_commission (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  
  if (!isAdmin(chatId)) {
    return bot.sendMessage(chatId, '❌ This command is for admins only.');
  }
  
  const commissionId = parseInt(match[1]);
  
  db.query(
    `UPDATE commission_tracking 
     SET commission_status = 'paid', commission_paid_date = NOW() 
     WHERE id = ?`,
    [commissionId],
    (err, result) => {
      if (err) {
        console.error('Error updating commission:', err);
        return bot.sendMessage(chatId, '❌ Error updating commission.');
      }
      
      if (result.affectedRows === 0) {
        return bot.sendMessage(chatId, '❌ Commission ID not found.');
      }
      
      bot.sendMessage(chatId, `✅ Commission ID ${commissionId} marked as paid.`);
    }
  );
});

bot.onText(/\/dashboard/, (msg) => {
  const chatId = msg.chat.id;
  
  if (!isAdmin(chatId)) {
    return bot.sendMessage(chatId, '❌ This command is for admins only.');
  }
  
  const queries = [
    `SELECT COUNT(*) as total FROM property_owners`,
    `SELECT COUNT(*) as expired FROM property_owners WHERE subscription_expiry < CURDATE() OR subscription_status = 'expired'`,
    `SELECT SUM(commission_amount) as pending FROM commission_tracking WHERE commission_status = 'pending'`,
    `SELECT SUM(commission_amount) as paid FROM commission_tracking WHERE commission_status = 'paid'`,
    `SELECT COUNT(*) as bookings FROM bookings WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)`
  ];
  
  let results = {};
  let completed = 0;
  
  queries.forEach((query, index) => {
    db.query(query, (err, rows) => {
      if (!err && rows.length > 0) {
        if (index === 0) results.totalOwners = rows[0].total;
        if (index === 1) results.expiredOwners = rows[0].expired;
        if (index === 2) results.pendingCommission = rows[0].pending || 0;
        if (index === 3) results.paidCommission = rows[0].paid || 0;
        if (index === 4) results.recentBookings = rows[0].bookings;
      }
      
      completed++;
      if (completed === queries.length) {
        const message = `
📊 *ADMIN DASHBOARD*

👥 *Owners:*
• Total: ${results.totalOwners || 0}
• Expired: ${results.expiredOwners || 0}
• Active: ${(results.totalOwners || 0) - (results.expiredOwners || 0)}

💰 *Commissions:*
• Pending: ₦${(results.pendingCommission || 0).toLocaleString()}
• Paid: ₦${(results.paidCommission || 0).toLocaleString()}
• Total: ₦${((results.pendingCommission || 0) + (results.paidCommission || 0)).toLocaleString()}

📅 *Last 30 Days:*
• Bookings: ${results.recentBookings || 0}

━━━━━━━━━━━━━━━━
Use:
/commissions - Detailed report
/expired_subs - Expired subscriptions
        `;
        
        bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      }
    });
  });
});

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
  
  const keyboard = getBackKeyboard();
  bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard.reply_markup
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

  saveUserInfo(msg);

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
      'UPDATE bookings SET owner_confirmed = 1, owner_confirmed_at = NOW(), status = ? WHERE booking_code = ?',
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

  if (data === 'admin_dashboard') {
    bot.sendMessage(chatId, '/dashboard');
  }

  if (data.startsWith('admin_commission_')) {
    const bookingCode = data.replace('admin_commission_', '');
    
    db.query(
      `SELECT b.*, a.owner_id, a.price, a.name as apartment_name
       FROM bookings b
       JOIN apartments a ON b.apartment_id = a.id
       WHERE b.booking_code = ?`,
      [bookingCode],
      (err, results) => {
        if (err || results.length === 0) {
          return bot.sendMessage(chatId, '❌ Booking not found');
        }
        
        const booking = results[0];
        const commission = booking.amount * 0.1;
        
        bot.sendMessage(chatId, 
          `💰 *Commission Details for ${bookingCode}*\n\n` +
          `• Apartment: ${booking.apartment_name}\n` +
          `• Amount: ₦${booking.amount}\n` +
          `• Commission (10%): ₦${commission}\n` +
          `• Owner ID: ${booking.owner_id || 'Not assigned'}\n` +
          `• Status: ${booking.owner_confirmed ? '✅ Owner Confirmed' : '⏳ Pending'}\n\n` +
          `Use /pay_commission [id] when paid`,
          { parse_mode: 'Markdown' }
        );
      }
    );
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
  if (!validatePIN(pin)) {
    return bot.sendMessage(chatId, '❌ *Invalid PIN format*\nPIN must be 5 digits.', {
      parse_mode: 'Markdown'
    });
  }
  
  db.query(
    `SELECT b.*, a.owner_id, a.price 
     FROM bookings b
     JOIN apartments a ON b.apartment_id = a.id
     WHERE b.booking_code=? AND b.access_pin=? AND b.pin_used=0`,
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

      const booking = rows[0];
      
      db.query(
        `UPDATE bookings 
         SET pin_used=1, tenant_confirmed_at=NOW(), status=?
         WHERE booking_code=?`,
        ['completed', bookingCode],
        (updateErr, result) => {
          if (updateErr) {
            console.error('Error updating PIN status:', updateErr);
            return bot.sendMessage(chatId, '❌ *Error Confirming PIN* \nPlease contact admin.', {
              parse_mode: 'Markdown'
            });
          }
          
          trackCommission(
            booking.id,
            bookingCode,
            booking.owner_id,
            booking.apartment_id,
            booking.amount
          );
          
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
          
          if (booking.owner_id) {
            notifyOwnerCommission(booking.owner_id, bookingCode, booking.amount);
          }
        }
      );
    }
  );
}

/* ================= SEND DAILY SUMMARY ================= */
function sendDailySummary() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  
  db.query(
    `SELECT 
      COUNT(*) as total_bookings,
      SUM(amount) as total_revenue,
      SUM(amount * 0.1) as total_commission
     FROM bookings 
     WHERE created_at BETWEEN ? AND ?`,
    [startOfDay, endOfDay],
    (err, results) => {
      if (err) {
        console.error('Error getting daily summary:', err);
        return;
      }
      
      const summary = results[0];
      
      ADMIN_IDS.forEach(adminId => {
        const message = `
📅 *Daily Summary - ${new Date().toLocaleDateString()}*

📊 *Today's Stats:*
• Bookings: ${summary.total_bookings || 0}
• Revenue: ₦${(summary.total_revenue || 0).toLocaleString()}
• Commission: ₦${(summary.total_commission || 0).toLocaleString()}

━━━━━━━━━━━━━━━━
Check /dashboard for more details
        `;
        
        bot.sendMessage(adminId, message, { parse_mode: 'Markdown' });
      });
    }
  );
}

// Schedule daily summary at 9 PM
const scheduleDailySummary = () => {
  const now = new Date();
  const night = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    21, 0, 0
  );
  
  let msUntilNight = night.getTime() - now.getTime();
  if (msUntilNight < 0) {
    msUntilNight += 24 * 60 * 60 * 1000;
  }
  
  setTimeout(() => {
    sendDailySummary();
    setInterval(sendDailySummary, 24 * 60 * 60 * 1000);
  }, msUntilNight);
  
  console.log('📅 Daily summary scheduled for 9:00 PM');
};

scheduleDailySummary();

console.log('✅ Bot Ready - Photos fixed with path handling! 🏠');

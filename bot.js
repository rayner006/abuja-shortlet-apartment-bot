require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./config/db');
const path = require('path');
const { generateaccesspin } = require('./utils/pingenerator');
const { tenantConfirmKeyboard, propertyOwnerConfirmKeyboard, payCommissionKeyboard } = require('./utils/keyboard');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Error handler
bot.on('polling_error', (error) => console.error('Polling error:', error));

console.log(`${process.env.BOT_NAME || 'Abuja Shortlet Bot'} is running...`);

/* ================= MAIN MENU ================= */
function showmainmenu(chatId, text = 'Welcome to Abuja Shortlet Apartments 🏠, Please choose an option below 👇') {
  bot.sendMessage(chatId, text, {
    reply_markup: {
      keyboard: [
        ['🏠 View Apartments'],
        ['📅 Book Apartment'],
        ['📞 Contact Admin']
      ],
      resize_keyboard: true
    }
  });
}

/* ================= START COMMAND ================= */
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  showmainmenu(chatId, `Welcome to Abuja Shortlet Apartments 🏠\nFind and book comfortable short-let apartments in Abuja easily.\n\nUse the menu below to continue.`);
});

/* ================= MESSAGE HANDLER ================= */
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text === '/start') return;

  // =============== VIEW APARTMENTS - SHOW LOCATIONS ===============
  if (text === '🏠 View Apartments') {
    return bot.sendMessage(chatId, 'Select Location:', {
      reply_markup: {
        keyboard: [
          ['Maitama', 'Asokoro'], ['Wuse', 'Wuse 2'], ['Jabi', 'Guzape'],
          ['Katampe', 'Gwarinpa'], ['Life Camp', 'Utako'], ['Wuye', 'Apo'],
          ['Kubwa', 'Lugbe'], ['Area 1', 'Gwagwalada'], ['⬅ Back to Menu']
        ],
        resize_keyboard: true
      }
    });
  }

  // =============== BACK TO MENU ===============
  if (text === '⬅ Back to Menu') {
    return showmainmenu(chatId, 'Main Menu:');
  }

  // =============== CONTACT ADMIN ===============
  if (text === '📞 Contact Admin') {
    return bot.sendMessage(chatId, '📞 Contact Admin:\nhttps://t.me/yourusername');
  }

  // =============== LOCATIONS LIST ===============
  const locations = ['Maitama','Asokoro','Wuse','Wuse 2','Jabi','Guzape','Katampe','Gwarinpa','Life Camp','Utako','Wuye','Apo','Kubwa','Lugbe','Area 1','Gwagwalada'];
  
  // =============== LOCATION SELECTED - SHOW BEDROOM FILTERS ===============
  if (locations.includes(text)) {
    return bot.sendMessage(chatId, `📍 *${text}*\n\nSelect apartment type:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛏️ Self Contain', callback_data: `filter_${text}_selfcon` }],
          [{ text: '🛏️ 1 Bedroom', callback_data: `filter_${text}_1bed` }],
          [{ text: '🛏️ 2 Bedroom', callback_data: `filter_${text}_2bed` }],
          [{ text: '🛏️ 3 Bedroom', callback_data: `filter_${text}_3bed` }],
          [{ text: '🔍 All Apartments', callback_data: `filter_${text}_all` }],
          [{ text: '« Back to Locations', callback_data: 'back_to_locations' }]
        ]
      }
    });
  }

  showmainmenu(chatId);
});

/* ================= CALLBACK QUERY HANDLER ================= */
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const userId = query.from.id;
  const username = query.from.username ? `@${query.from.username}` : 'No username';
  
  // Answer immediately
  bot.answerCallbackQuery(query.id)
    .catch(err => console.error('Callback answer error:', err));

  // =============== BEDROOM FILTER HANDLER ===============
  if (data.startsWith('filter_')) {
    const parts = data.split('_');
    const location = parts[1];
    const filterType = parts[2]; // selfcon, 1bed, 2bed, 3bed, all
    
    console.log(`🔍 Filtering ${location} - ${filterType}`);
    
    let query = 'SELECT * FROM apartments WHERE location = ?';
    const params = [location];
    
    // Add bedroom filter based on selection
    if (filterType === 'selfcon') {
      query += ' AND bedrooms = 0';
    } else if (filterType === '1bed') {
      query += ' AND bedrooms = 1';
    } else if (filterType === '2bed') {
      query += ' AND bedrooms = 2';
    } else if (filterType === '3bed') {
      query += ' AND bedrooms = 3';
    } else if (filterType === 'all') {
      // No additional filter
    }
    
    db.query(query, params, (err, results) => {
      if (err) {
        console.log(err);
        return bot.sendMessage(chatId, 'Error fetching apartments.');
      }
      
      if (results.length === 0) {
        let filterName = '';
        if (filterType === 'selfcon') filterName = 'Self Contain';
        else if (filterType === '1bed') filterName = '1 Bedroom';
        else if (filterType === '2bed') filterName = '2 Bedroom';
        else if (filterType === '3bed') filterName = '3 Bedroom';
        else if (filterType === 'all') filterName = '';
        
        return bot.sendMessage(chatId, `No ${filterName} apartments found in ${location}.`);
      }
      
      bot.sendMessage(chatId, `📍 *${location}*\n🏠 *${results.length}* apartment(s) found:`, { parse_mode: 'Markdown' });
      
      results.forEach((apartment) => {
        const name = apartment.name || 'Apartment Listing';
        const desc = apartment.description || 'No description yet.';
        const price = Number(apartment.price || 0).toLocaleString();
        
        // Bedroom text formatting
        let bedroomText = '';
        if (apartment.bedrooms === 0) bedroomText = 'Self Contain';
        else if (apartment.bedrooms === 1) bedroomText = '1 Bedroom';
        else if (apartment.bedrooms === 2) bedroomText = '2 Bedrooms';
        else if (apartment.bedrooms === 3) bedroomText = '3 Bedrooms';
        else bedroomText = `${apartment.bedrooms} Bedrooms`;
        
        const caption = `🏠 *${name}*\n📍 Address: ${apartment.address || location}\n🛏️ ${bedroomText}\n💰 ₦${price}\n\n📝 ${desc}`;

        // ===== SINGLE BOOKING BUTTON FUNCTION =====
        const sendBookingButton = () => {
          return bot.sendMessage(chatId, '👇 Book this apartment', {
            reply_markup: {
              inline_keyboard: [
                [{ text: '📅 Book Now', callback_data: `book_${apartment.id}` }]
              ]
            }
          });
        };

        // ===== 5-PHOTO ALBUM - ONE BUTTON ONLY =====
        if (apartment.photos) {
          const photoarray = apartment.photos.split(',').map(p => p.trim()).filter(p => p.length > 0);
          
          if (photoarray.length > 0) {
            const mediagroup = photoarray.map((photo, index) => ({
              type: 'photo',
              media: path.join(__dirname, 'uploads', 'apartments', photo),
              caption: index === 0 ? caption : undefined
            }));
            
            bot.sendMediaGroup(chatId, mediagroup)
              .then(sendBookingButton)
              .catch(() => {
                bot.sendPhoto(chatId, path.join(__dirname, 'uploads', 'apartments', photoarray[0]), { caption })
                  .then(sendBookingButton);
              });
          }
        } else {
          bot.sendMessage(chatId, caption, { parse_mode: 'Markdown' })
            .then(sendBookingButton);
        }
      });
      
      // Add "Back to Locations" button
      bot.sendMessage(chatId, '🔍 Search again?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '« Back to Locations', callback_data: 'back_to_locations' }]
          ]
        }
      });
    });
    
    bot.answerCallbackQuery(query.id);
  }

  // =============== BACK TO LOCATIONS ===============
  if (data === 'back_to_locations') {
    bot.sendMessage(chatId, 'Select Location:', {
      reply_markup: {
        keyboard: [
          ['Maitama', 'Asokoro'], ['Wuse', 'Wuse 2'], ['Jabi', 'Guzape'],
          ['Katampe', 'Gwarinpa'], ['Life Camp', 'Utako'], ['Wuye', 'Apo'],
          ['Kubwa', 'Lugbe'], ['Area 1', 'Gwagwalada'], ['⬅ Back to Menu']
        ],
        resize_keyboard: true
      }
    });
    bot.answerCallbackQuery(query.id);
  }

  // =============== BOOK APARTMENT ===============
  if (data.startsWith('book_')) {
    const apartmentId = data.split('_')[1];
    
    // Get apartment details AND property owner telegram ID
    db.query(
      `SELECT a.price, a.name, a.property_owner_id, po.telegram_id as property_owner_telegram 
       FROM apartments a 
       LEFT JOIN property_owners po ON a.property_owner_id = po.id 
       WHERE a.id = ?`,
      [apartmentId],
      (err, results) => {
        if (err || results.length === 0) {
          return bot.sendMessage(chatId, 'Apartment not found ❌');
        }

        const amount = results[0].price;
        const commission = amount * 0.10;
        const bookingCode = `BK${Date.now()}_${apartmentId}`;
        const apartmentName = results[0].name || `Apartment ${apartmentId}`;
        const propertyOwnerTelegram = results[0].property_owner_telegram;
        
        // Generate PIN
        const pin = generateaccesspin();
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 48);

        // Insert booking
        db.query(
          `INSERT INTO bookings 
           (user_id, apartment_id, amount, commission, booking_code, status, access_pin, pin_expiry) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, apartmentId, amount, commission, bookingCode, 'pending', pin, expiry],
          (insertErr) => {
            if (insertErr) {
              console.error('Insert error:', insertErr);
              return bot.sendMessage(chatId, 'Error creating booking. Please try again.');
            }

            // ===== 1. FIRST: SEND PIN TO TENANT =====
            bot.sendMessage(chatId, `<b>✅ Booking Request Successful!</b>
💰 Amount: ₦${amount.toLocaleString()}
📌 Code: <code>${bookingCode}</code>

<b>🔐 YOUR ACCESS PIN: ${pin}</b>

⚠️ <b>IMPORTANT:</b> Give this PIN to the property owner ONLY after:
• You have inspected the apartment
• You have paid the agreed amount

The property owner CANNOT confirm without this PIN.`, 
            { parse_mode: 'HTML' });

            // ===== 2. SECOND: ASK TENANT TO CONFIRM PAYMENT =====
            bot.sendMessage(chatId, `<b>✅ Already paid the property owner?</b>

Click the button below to confirm your payment:`,
            { 
              parse_mode: 'HTML',
              reply_markup: tenantConfirmKeyboard(bookingCode).reply_markup 
            });

            // ===== NOTIFY PROPERTY OWNER DIRECTLY =====
            if (propertyOwnerTelegram) {
              bot.sendMessage(propertyOwnerTelegram, 
                `<b>🏠 New Booking for Your Apartment!</b>\n\n` +
                `👤 Tenant: ${username}\n` +
                `🏠 Apartment: ${apartmentName}\n` +
                `💰 Rent Amount: ₦${amount.toLocaleString()}\n` +
                `📌 Booking Code: <code>${bookingCode}</code>\n` +
                `<b>🔐 Tenant's PIN: ${pin}</b>\n\n` +
                `⚠️ <i>Wait for tenant to confirm payment, then ask them for this PIN to confirm.</i>`,
                { parse_mode: 'HTML' }
              );
              
              // Send confirmation button to property owner
              bot.sendMessage(propertyOwnerTelegram, 
                `<b>✅ Confirm Tenant Payment</b>\n\n` +
                `Click below ONLY after tenant has paid and given you the PIN:`,
                {
                  parse_mode: 'HTML',
                  reply_markup: propertyOwnerConfirmKeyboard(bookingCode).reply_markup
                }
              );
            } else {
              // No property owner linked - notify admin
              bot.sendMessage(process.env.ADMIN_CHAT_ID,
                `<b>⚠️ No Property Owner Linked!</b>\n` +
                `Apartment ID: ${apartmentId}\n` +
                `Booking: <code>${bookingCode}</code>\n\n` +
                `Please assign a property owner to this apartment.`,
                { parse_mode: 'HTML' }
              );
            }

            // ===== NOTIFY ADMIN (YOU - BOT OWNER) =====
            if (process.env.ADMIN_CHAT_ID) {
              bot.sendMessage(process.env.ADMIN_CHAT_ID, 
                `<b>📢 New Booking Created!</b>\n` +
                `👤 Tenant: ${username}\n` +
                `🏠 ${apartmentName}\n` +
                `💰 Rent: ₦${amount.toLocaleString()}\n` +
                `<b>💵 Your Commission: ₦${commission.toLocaleString()}</b>\n` +
                `📌 <code>${bookingCode}</code>\n` +
                `🔐 PIN: ${pin}\n` +
                `👑 Property Owner: ${propertyOwnerTelegram ? 'Notified' : 'Not linked'}`,
                { parse_mode: 'HTML' }
              );
            }
          }
        );
      }
    );
  }

  // =============== TENANT CONFIRMS PAYMENT ===============
  if (data.startsWith('confirm_tenant_')) {
    const bookingCode = data.replace('confirm_tenant_', '');
    console.log('💰 Tenant confirmed payment for:', bookingCode);
    
    db.query(
      `UPDATE bookings SET tenant_confirmed = true, tenant_confirmed_at = NOW() WHERE booking_code = ?`,
      [bookingCode],
      (err, result) => {
        if (err) {
          console.error('❌ Tenant confirm error:', err);
          return bot.sendMessage(chatId, 'Error confirming payment. Please try again.');
        }

        bot.sendMessage(chatId, 
          `<b>✅ Payment Confirmed!</b>\n\nThank you for confirming your payment. The property owner will now verify and confirm on their side.\n\nYou will be notified once both sides confirm.`,
          { parse_mode: 'HTML' }
        );

        // Check if both confirmed
        db.query(`SELECT * FROM bookings WHERE booking_code = ?`, [bookingCode], (err, rows) => {
          if (!err && rows.length > 0) {
            const booking = rows[0];
            if (booking.tenant_confirmed && booking.property_owner_confirmed) {
              // ===== BOTH CONFIRMED! YOU GET PAID! =====
              const commission = booking.commission;
              
              // Get property owner telegram ID
              db.query(
                `SELECT po.telegram_id FROM apartments a 
                 JOIN property_owners po ON a.property_owner_id = po.id 
                 WHERE a.id = ?`,
                [booking.apartment_id],
                (err, propertyOwnerRows) => {
                  const propertyOwnerId = (propertyOwnerRows && propertyOwnerRows[0]) ? propertyOwnerRows[0].telegram_id : 'Unknown';
                  
                  // NOTIFY YOU TO COLLECT COMMISSION
                  bot.sendMessage(process.env.ADMIN_CHAT_ID, 
                    `<b>💰💰💰 COMMISSION READY! 💰💰💰</b>\n\n` +
                    `<b>✅ BOTH PARTIES CONFIRMED!</b>\n` +
                    `📌 <code>${bookingCode}</code>\n` +
                    `🏠 Apartment ID: ${booking.apartment_id}\n` +
                    `👤 Tenant: ${booking.user_id}\n` +
                    `👑 Property Owner: ${propertyOwnerId}\n\n` +
                    `<b>💵 YOUR COMMISSION: ₦${Number(commission).toLocaleString()}</b>\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n` +
                    `<b>🔔 ACTION REQUIRED:</b>\n` +
                    `1️⃣ Send payment details to property owner\n` +
                    `2️⃣ Collect your 10% commission\n` +
                    `3️⃣ Mark as paid in database\n` +
                    `━━━━━━━━━━━━━━━━━━━━━`,
                    { 
                      parse_mode: 'HTML',
                      reply_markup: {
                        inline_keyboard: [
                          [{ text: `✅ Mark Commission Paid`, callback_data: `mark_paid_${bookingCode}` }]
                        ]
                      }
                    }
                  );
                }
              );
              
              // Notify tenant
              bot.sendMessage(booking.user_id, 
                `<b>✅ Property owner has confirmed your payment!</b>\n\n` +
                `Booking: <code>${bookingCode}</code>\n` +
                `Thank you for using Abuja Shortlet Apartments 🏠\n\n` +
                `Enjoy your stay!`,
                { parse_mode: 'HTML' }
              );
            }
          }
        });
      }
    );
  }

  // =============== PROPERTY OWNER CONFIRMS PAYMENT ===============
  if (data.startsWith('confirm_property_owner_')) {
    const bookingCode = data.replace('confirm_property_owner_', '');
    const propertyOwnerChatId = chatId;
    
    console.log('👑 Property Owner confirmation requested for:', bookingCode);
    
    // Ask for PIN
    bot.sendMessage(propertyOwnerChatId, 
      `<b>🔐 PIN VERIFICATION REQUIRED</b>\n\n` +
      `Ask the tenant for their 5-digit access PIN and enter it below:`,
      { parse_mode: 'HTML' }
    );
    
    // Wait for PIN input
    bot.once('message', (pinMsg) => {
      const enteredPin = pinMsg.text.trim();
      
      // Check if PIN matches and is not expired/used
      db.query(
        `SELECT * FROM bookings 
         WHERE booking_code = ? 
         AND access_pin = ? 
         AND pin_used = false 
         AND pin_expiry > NOW()`,
        [bookingCode, enteredPin],
        (err, rows) => {
          if (err) {
            console.error('❌ PIN verification error:', err);
            return bot.sendMessage(propertyOwnerChatId, 'Error verifying PIN. Please try again.');
          }
          
          if (rows.length === 0) {
            return bot.sendMessage(propertyOwnerChatId, 
              '<b>❌ Invalid or expired PIN</b>\n\nPlease check the PIN with your tenant and try again.',
              { parse_mode: 'HTML' }
            );
          }
          
          // PIN is correct! Mark property owner as confirmed
          db.query(
            `UPDATE bookings SET property_owner_confirmed = true, property_owner_confirmed_at = NOW(), pin_used = true WHERE booking_code = ?`,
            [bookingCode],
            (updateErr) => {
              if (updateErr) {
                console.error('❌ Property Owner confirm error:', updateErr);
                return bot.sendMessage(propertyOwnerChatId, 'Error confirming payment. Please try again.');
              }
              
              bot.sendMessage(propertyOwnerChatId, 
                `<b>✅ PIN VERIFIED! Payment Confirmed.</b>\n\n` +
                `Thank you for confirming. The tenant has been notified.\n\n` +
                `<b>⚠️ Your 10% commission (₦${Number(rows[0].commission).toLocaleString()}) is now due.</b>\n` +
                `You will receive payment instructions from the admin shortly.`,
                { parse_mode: 'HTML' }
              );
              
              // Check if BOTH confirmed
              db.query(`SELECT * FROM bookings WHERE booking_code = ?`, [bookingCode], (err, rows) => {
                if (!err && rows.length > 0) {
                  const booking = rows[0];
                  
                  if (booking.tenant_confirmed && booking.property_owner_confirmed) {
                    // ===== BOTH CONFIRMED! YOU GET PAID! =====
                    const commission = booking.commission;
                    
                    // Get property owner telegram ID
                    db.query(
                      `SELECT po.telegram_id FROM apartments a 
                       JOIN property_owners po ON a.property_owner_id = po.id 
                       WHERE a.id = ?`,
                      [booking.apartment_id],
                      (err, propertyOwnerRows) => {
                        const propertyOwnerId = (propertyOwnerRows && propertyOwnerRows[0]) ? propertyOwnerRows[0].telegram_id : propertyOwnerChatId;
                        
                        // NOTIFY YOU TO COLLECT COMMISSION
                        bot.sendMessage(process.env.ADMIN_CHAT_ID, 
                          `<b>💰💰💰 COMMISSION READY! 💰💰💰</b>\n\n` +
                          `<b>✅ BOTH PARTIES CONFIRMED!</b>\n` +
                          `📌 <code>${bookingCode}</code>\n` +
                          `🏠 Apartment ID: ${booking.apartment_id}\n` +
                          `👤 Tenant: ${booking.user_id}\n` +
                          `👑 Property Owner: ${propertyOwnerId}\n\n` +
                          `<b>💵 YOUR COMMISSION: ₦${Number(commission).toLocaleString()}</b>\n\n` +
                          `━━━━━━━━━━━━━━━━━━━━━\n` +
                          `<b>🔔 ACTION REQUIRED:</b>\n` +
                          `1️⃣ Send payment details to property owner\n` +
                          `2️⃣ Collect your 10% commission\n` +
                          `3️⃣ Mark as paid in database\n` +
                          `━━━━━━━━━━━━━━━━━━━━━`,
                          { 
                            parse_mode: 'HTML',
                            reply_markup: {
                              inline_keyboard: [
                                [{ text: `✅ Mark Commission Paid`, callback_data: `mark_paid_${bookingCode}` }]
                              ]
                            }
                          }
                        );
                      }
                    );
                    
                    // Notify tenant
                    bot.sendMessage(booking.user_id, 
                      `<b>✅ Property owner has confirmed your payment!</b>\n\n` +
                      `Booking: <code>${bookingCode}</code>\n` +
                      `Thank you for using Abuja Shortlet Apartments 🏠\n\n` +
                      `Enjoy your stay!`,
                      { parse_mode: 'HTML' }
                    );
                  }
                }
              });
            }
          );
        }
      );
    });
    
    bot.answerCallbackQuery(query.id);
  }

  // =============== MARK COMMISSION AS PAID ===============
  if (data.startsWith('mark_paid_')) {
    const bookingCode = data.replace('mark_paid_', '');
    
    db.query(
      `UPDATE bookings SET commission_paid = true, commission_paid_at = NOW() WHERE booking_code = ?`,
      [bookingCode],
      (err) => {
        if (err) {
          console.error('❌ Error marking commission paid:', err);
          return bot.sendMessage(chatId, 'Error updating commission status.');
        }
        
        bot.sendMessage(chatId, 
          `<b>✅ Commission marked as PAID!</b>\n\n` +
          `Booking: <code>${bookingCode}</code>\n\n` +
          `💰 Another one in the bank! 🇳🇬`,
          { parse_mode: 'HTML' }
        );
        
        // Notify property owner
        db.query(
          `SELECT b.*, a.property_owner_id, po.telegram_id 
           FROM bookings b
           JOIN apartments a ON b.apartment_id = a.id
           JOIN property_owners po ON a.property_owner_id = po.id
           WHERE b.booking_code = ?`,
          [bookingCode],
          (err, rows) => {
            if (!err && rows.length > 0 && rows[0].telegram_id) {
              bot.sendMessage(rows[0].telegram_id,
                `<b>✅ Commission Received!</b>\n\n` +
                `Thank you for your payment. Your listing remains active.\n\n` +
                `Booking: <code>${bookingCode}</code>`,
                { parse_mode: 'HTML' }
              );
            }
          }
        );
      }
    );
    
    bot.answerCallbackQuery(query.id);
  }

  // =============== PAY COMMISSION ===============
  if (data.startsWith('pay_commission_')) {
    const bookingCode = data.replace('pay_commission_', '');
    
    bot.sendMessage(chatId, 
      `<b>💵 Commission Payment</b>\n\nBooking: <code>${bookingCode}</code>\n\nTo pay your 10% commission:\n\n` +
      `🏦 <b>Bank Transfer:</b>\nBank: Access Bank\nAccount: 1234567890\nName: Abuja Shortlet Bot\n\n` +
      `📤 <b>USDT (TRC20):</b>\nAddress: TXXXXXXXXXXXXXX\n\n` +
      `📸 <b>Send payment screenshot to admin:</b>\n@yourusername\n\n` +
      `Once confirmed, your listing will stay active.`,
      { parse_mode: 'HTML' }
    );
    
    bot.answerCallbackQuery(query.id);
  }
});

console.log('✅ Abuja Shortlet Bot with BEDROOM FILTERS and Cheat-Proof Flow is running!');
console.log('👤 Tenant → 🤖 You → 👑 Property Owner (10% Commission)');
console.log('📍 Location + 🛏️ Bedroom Filters: Self Contain, 1-Bed, 2-Bed, 3-Bed');
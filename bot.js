require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./config/db');
const path = require('path');
const { generateaccesspin } = require('./utils/pingenerator');
const { tenantConfirmKeyboard, propertyOwnerConfirmKeyboard } = require('./utils/keyboard');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// TEMP PIN WAIT STORE
const awaitingPin = {};

bot.on('polling_error', (error) => console.error('Polling error:', error));

console.log(`${process.env.BOT_NAME || 'Abuja Shortlet Bot'} is running...`);

/* ================= MAIN MENU ================= */
function showmainmenu(chatId, text = 'Welcome to Abuja Shortlet Apartments 🏠') {
  bot.sendMessage(chatId, text, {
    reply_markup: {
      keyboard: [
        ['🏠 View Apartments'],
        ['📞 Contact Admin']
      ],
      resize_keyboard: true
    }
  });
}

/* ================= START ================= */
bot.onText(/\/start/, (msg) => {
  showmainmenu(msg.chat.id);
});

/* ================= PIN INPUT HANDLER ================= */
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  // PIN CHECK
  if (awaitingPin[chatId]) {
    const bookingCode = awaitingPin[chatId];
    delete awaitingPin[chatId];

    return verifyPin(chatId, bookingCode, text.trim());
  }

  if (text === '🏠 View Apartments') {
    return bot.sendMessage(chatId, 'Select Location:', {
      reply_markup: {
        keyboard: [
          ['Maitama','Asokoro'],
          ['Wuse','Jabi'],
          ['⬅ Back to Menu']
        ],
        resize_keyboard: true
      }
    });
  }

  if (text === '⬅ Back to Menu') return showmainmenu(chatId);
});

/* ================= CALLBACK ================= */
bot.on('callback_query', (cb) => {
  const chatId = cb.message.chat.id;
  const data = cb.data;

  bot.answerCallbackQuery(cb.id);

  // PROPERTY OWNER CONFIRM
  if (data.startsWith('confirm_property_owner_')) {
    const bookingCode = data.replace('confirm_property_owner_', '');

    awaitingPin[chatId] = bookingCode;

    return bot.sendMessage(chatId, 'Enter tenant PIN:');
  }
});

/* ================= VERIFY PIN ================= */
function verifyPin(chatId, bookingCode, pin) {
  db.query(
    `SELECT * FROM bookings 
     WHERE booking_code=? AND access_pin=? AND pin_used=false`,
    [bookingCode, pin],
    (err, rows) => {
      if (rows.length === 0) {
        return bot.sendMessage(chatId, '❌ Invalid PIN');
      }

      db.query(
        `UPDATE bookings SET pin_used=true WHERE booking_code=?`,
        [bookingCode]
      );

      bot.sendMessage(chatId, '✅ Payment Confirmed!');
    }
  );
}

console.log('✅ Bot Ready');

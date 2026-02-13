require('dotenv').config();

// 👇 UNHANDLED REJECTION HANDLER
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('💥 Reason:', reason);
  console.error('📋 Stack:', reason?.stack || 'No stack trace');
});

// 👇 UNHANDLED EXCEPTIONS HANDLER
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
});

/* ================= KEEP ALIVE SERVER (FOR RAILWAY) ================= */
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
const { generateaccesspin } = require('./utils/pingenerator');
const { tenantConfirmKeyboard, propertyOwnerConfirmKeyboard } = require('./utils/keyboard');

const token = process.env.BOT_TOKEN;

// 👇 UPDATED BOT INITIALIZATION WITH POLLING FIX
const bot = new TelegramBot(token, { 
  polling: true,
  // This helps prevent multiple instance conflicts
  polling: {
    params: {
      timeout: 30,
      limit: 100,
      allowed_updates: ['message', 'callback_query']
    }
  }
});

// 👇 GRACEFUL SHUTDOWN HANDLERS (Fixes 409 Conflict)
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

/* ================= TEMP PIN STORE ================= */
const awaitingPin = {};

/* ================= ERRORS ================= */
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
  // Don't crash the bot on polling errors
});

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

/* ================= MESSAGE HANDLER ================= */
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  /* ===== PIN INPUT ===== */
  if (awaitingPin[chatId]) {
    const bookingCode = awaitingPin[chatId];
    delete awaitingPin[chatId];
    return verifyPin(chatId, bookingCode, text.trim());
  }

  /* ===== VIEW APARTMENTS ===== */
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

  /* ===== BACK MENU ===== */
  if (text === '⬅ Back to Menu') {
    return showmainmenu(chatId);
  }
});

/* ================= CALLBACK ================= */
bot.on('callback_query', (cb) => {
  const chatId = cb.message.chat.id;
  const data = cb.data;

  bot.answerCallbackQuery(cb.id);

  /* ===== PROPERTY OWNER CONFIRM ===== */
  if (data.startsWith('confirm_property_owner_')) {
    const bookingCode = data.replace('confirm_property_owner_', '');
    awaitingPin[chatId] = bookingCode;

    return bot.sendMessage(chatId, '🔐 Enter tenant PIN:');
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
        return bot.sendMessage(chatId, '❌ Database Error');
      }

      if (rows.length === 0) {
        return bot.sendMessage(chatId, '❌ Invalid or Used PIN');
      }

      db.query(
        `UPDATE bookings SET pin_used=true WHERE booking_code=?`,
        [bookingCode],
        (updateErr) => {
          if (updateErr) {
            console.error('Error updating PIN status:', updateErr);
            return bot.sendMessage(chatId, '❌ Error confirming PIN');
          }
          bot.sendMessage(chatId, '✅ Payment Confirmed!');
        }
      );
    }
  );
}

console.log('✅ Bot Ready');

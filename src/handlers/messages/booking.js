// ============================================
// HANDLES BOOKING MESSAGES (NAME & PHONE COLLECTION)
// Location: /handlers/messages/booking.js
// ============================================

const { getRedis } = require('../../config/redis');
const logger = require('../../middleware/logger');

module.exports = (bot) => {
  
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const messageId = msg.message_id;
    
    const redis = getRedis();
    
    try {
      const sessionRaw = await redis.get(`booking:${chatId}`);
      if (!sessionRaw) return;
      
      const session = JSON.parse(sessionRaw);
      
      // ===== STEP 1: GET NAME =====
      if (session.step === 'awaiting_name') {
        
        if (text.split(' ').length < 2) {
          await bot.sendMessage(
            chatId,
            '❌ Please enter your *full name* (first and last name):',
            { parse_mode: 'Markdown', reply_markup: { force_reply: true } }
          );
          return;
        }
        
        session.userName = text;
        session.step = 'awaiting_phone';
        await redis.setex(`booking:${chatId}`, 3600, JSON.stringify(session));
        
        await bot.sendMessage(
          chatId,
          '📞 *Step 2 of 2: Your Phone Number*\n\n' +
          'Please enter your phone number:\n' +
          'Example: `08031234567`',
          { 
            parse_mode: 'Markdown',
            reply_markup: { force_reply: true }
          }
        );
        
        await bot.deleteMessage(chatId, messageId).catch(() => {});
        return;
      }
      
      // ===== STEP 2: GET PHONE =====
      if (session.step === 'awaiting_phone') {
        
        const phone = text.replace(/[^\d]/g, '');
        
        if (!/^0\d{10}$/.test(phone)) {
          await bot.sendMessage(
            chatId,
            '❌ Please enter a valid *11-digit* Nigerian phone number:\n' +
            'Example: `08031234567`',
            { 
              parse_mode: 'Markdown',
              reply_markup: { force_reply: true }
            }
          );
          return;
        }
        
        session.userPhone = phone;
        session.step = 'awaiting_dates';
        await redis.setex(`booking:${chatId}`, 3600, JSON.stringify(session));
        
        await bot.deleteMessage(chatId, messageId).catch(() => {});
        
        const keyboard = {
          inline_keyboard: [
            [{ text: '📅 Select Dates', callback_data: 'show_date_picker' }],
            [{ text: '❌ Cancel Booking', callback_data: 'cancel_booking' }]
          ]
        };
        
        await bot.sendMessage(
          chatId,
          `✅ *Details Confirmed!*\n\n` +
          `Name: ${session.userName}\n` +
          `Phone: ${phone}\n\n` +
          `Click below to select your dates:`,
          {
            parse_mode: 'Markdown',
            reply_markup: keyboard
          }
        );
        return;
      }
      
    } catch (err) {
      logger.error('BOOKING MESSAGE HANDLER ERROR:', err);
      await bot.sendMessage(
        chatId,
        '❌ An error occurred. Please try again.'
      );
    }
  });
};

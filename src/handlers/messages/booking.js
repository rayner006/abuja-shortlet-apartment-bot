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
      
      // If no session, user is not in booking flow - ignore
      if (!sessionRaw) return;
      
      const session = JSON.parse(sessionRaw);
      
      // ===== IGNORE MENU MESSAGES =====
      const menuMessages = [
        '🏠 View Apartments',
        '⬅️ Back to Main Menu',
        '🔍 Search Again',
        '📞 Contact Admin',
        'ℹ️ About Us'
      ];
      
      if (menuMessages.includes(text)) {
        return; // Don't process menu messages in booking flow
      }
      
      // ===== STEP 1: AWAITING NAME =====
      if (session.step === 'awaiting_name') {
        
        // Validate name has at least first and last name
        if (text.split(' ').length < 2) {
          await bot.sendMessage(
            chatId,
            '❌ Please enter your *full name* (first and last name):',
            { parse_mode: 'Markdown', reply_markup: { force_reply: true } }
          );
          return;
        }
        
        // Save name and move to phone step
        session.userName = text;
        session.step = 'awaiting_phone';
        await redis.setex(`booking:${chatId}`, 3600, JSON.stringify(session));
        
        // Ask for phone number
        await bot.sendMessage(
          chatId,
          '📞 *Step 2 of 2: Your Phone Number*\n\n' +
          'Please enter your phone number:',
          { 
            parse_mode: 'Markdown',
            reply_markup: { force_reply: true }
          }
        );
        
        // Delete user's name message for privacy
        await bot.deleteMessage(chatId, messageId).catch(() => {});
        return;
      }
      
      // ===== STEP 2: AWAITING PHONE =====
      if (session.step === 'awaiting_phone') {
        
        // Remove spaces and special characters for counting
        const digitsOnly = text.replace(/[^\d]/g, '');
        
        // Check that it has at least 9 digits
        if (digitsOnly.length < 9) {
          await bot.sendMessage(
            chatId,
            '❌ Please enter a valid phone number:',
            { 
              parse_mode: 'Markdown',
              reply_markup: { force_reply: true }
            }
          );
          return;
        }
        
        // Save phone number (keep original format)
        session.userPhone = text;
        session.step = 'selecting_dates';
        await redis.setex(`booking:${chatId}`, 3600, JSON.stringify(session));
        
        // Delete user's phone message for privacy
        await bot.deleteMessage(chatId, messageId).catch(() => {});
        
        // Get the date picker
        const datePicker = require('../callbacks/datePicker');
        
        // Show date picker directly
        await datePicker.startDatePicker(bot, chatId, {
          apartmentId: session.apartmentId,
          userName: session.userName,
          userPhone: session.userPhone
        });
        
        return;
      }
      
      // ===== DURING DATE SELECTION - SILENTLY IGNORE =====
      // If user is in date selection step, do nothing
      if (session.step === 'selecting_dates') {
        // Just return without sending any message
        return;
      }
      
    } catch (err) {
      logger.error('BOOKING MESSAGE HANDLER ERROR:', err);
      // Don't send error message to user
    }
  });
};

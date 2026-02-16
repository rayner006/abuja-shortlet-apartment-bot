const BookingService = require('../../services/bookingService');
const { getDateRangePickerKeyboard } = require('../../utils/datePicker');
const { getRedis } = require('../../config/redis');
const logger = require('../../middleware/logger');
const { getMainMenuKeyboard } = require('../../utils/keyboard');

module.exports = (bot) => {
  // Handle text input during booking flow
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Skip if no text or it's a command
    if (!text || text.startsWith('/')) return;
    
    try {
      const redis = getRedis();
      const sessionData = await redis.get(`session:${chatId}`);
      
      if (!sessionData) return;
      
      const session = JSON.parse(sessionData);
      
      // Handle name input
      if (session.step === 'awaiting_name') {
        const result = await BookingService.processName(chatId, text, session);
        
        if (result.success) {
          await bot.sendMessage(chatId, result.message, {
            parse_mode: 'Markdown',
            reply_markup: {
              force_reply: true,
              selective: true
            }
          });
        } else {
          await bot.sendMessage(chatId, result.message);
        }
      }
      
      // Handle phone input
      else if (session.step === 'awaiting_phone') {
        // Simple phone validation (basic)
        if (!text.match(/^[0-9+\-\s()]{7,}$/)) {
          return bot.sendMessage(chatId, '❌ Please enter a valid phone number:');
        }
        
        const result = await BookingService.processPhone(chatId, text, session);
        
        if (result.success) {
          // Show date picker
          await bot.sendMessage(chatId, result.message, {
            parse_mode: 'Markdown',
            reply_markup: getDateRangePickerKeyboard('start').reply_markup
          });
        } else {
          await bot.sendMessage(chatId, result.message);
        }
      }
      
    } catch (error) {
      logger.error('Error in booking message handler:', error);
      bot.sendMessage(chatId, '❌ Error processing your request. Please try again.');
    }
  });
};

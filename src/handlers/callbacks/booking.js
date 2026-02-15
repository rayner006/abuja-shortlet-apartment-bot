const BookingService = require('../../services/bookingService');
const { getRedis } = require('../../config/redis');
const logger = require('../../middleware/logger');

module.exports = (bot) => {
  // Handle book button callbacks
  bot.on('callback_query', async (cb) => {
    const chatId = cb.message.chat.id;
    const data = cb.data;
    
    await bot.answerCallbackQuery(cb.id);
    
    if (data.startsWith('book_')) {
      const apartmentId = data.replace('book_', '');
      
      try {
        const result = await BookingService.startBooking(chatId, apartmentId, cb.message);
        
        if (result.success) {
          // Store session in Redis
          const redis = getRedis();
          await redis.setex(`session:${chatId}`, 3600, JSON.stringify(result.session));
          
          await bot.sendMessage(chatId, '📱 *Please enter your phone number:*\n\nWe will contact you shortly to confirm your booking.', {
            parse_mode: 'Markdown',
            reply_markup: {
              force_reply: true,
              selective: true
            }
          });
        } else {
          await bot.sendMessage(chatId, result.message);
        }
      } catch (error) {
        logger.error('Error in book callback:', error);
        await bot.sendMessage(chatId, '❌ Error starting booking process.');
      }
    }
  });
};
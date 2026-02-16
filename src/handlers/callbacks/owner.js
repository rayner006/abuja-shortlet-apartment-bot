const Booking = require('../../models/Booking');
const NotificationService = require('../../services/notificationService');
const Commission = require('../../models/Commission');
const { getRedis } = require('../../config/redis');
const logger = require('../../middleware/logger');

module.exports = (bot) => {
  bot.on('callback_query', async (cb) => {
    const chatId = cb.message.chat.id;
    const data = cb.data;
    const messageId = cb.message.message_id;
    
    // ONLY handle owner-specific callbacks
    if (data.startsWith('confirm_owner_') || 
        data.startsWith('contacted_') || 
        data.startsWith('confirm_property_owner_')) {
      
      await bot.answerCallbackQuery(cb.id);
      
      // Owner confirm booking
      if (data.startsWith('confirm_owner_')) {
        const bookingCode = data.replace('confirm_owner_', '');
        
        try {
          const confirmed = await Booking.confirmByOwner(bookingCode, chatId);
          
          if (confirmed) {
            await bot.sendMessage(chatId, `✅ Booking ${bookingCode} confirmed. Commission will be processed.`);
            
            // Try to edit original message
            try {
              await bot.editMessageText(
                cb.message.text + '\n\n✅ *CONFIRMED BY OWNER*',
                {
                  chat_id: chatId,
                  message_id: messageId,
                  parse_mode: 'Markdown'
                }
              );
            } catch (e) {
              // Ignore edit errors
            }
          } else {
            await bot.sendMessage(chatId, '❌ Error confirming booking. It may have already been confirmed.');
          }
        } catch (error) {
          logger.error('Error in owner confirm callback:', error);
          bot.sendMessage(chatId, '❌ Error confirming booking.');
        }
      }
      
      // Owner contacted guest
      if (data.startsWith('contacted_')) {
        const bookingCode = data.replace('contacted_', '');
        
        await bot.sendMessage(chatId, `✅ Marked booking ${bookingCode} as contacted.`);
        
        try {
          await bot.editMessageText(
            cb.message.text + '\n\n📞 *GUEST CONTACTED*',
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'Markdown'
            }
          );
        } catch (e) {
          // Ignore edit errors
        }
      }
      
      // Owner confirm with PIN (for tenant verification)
      if (data.startsWith('confirm_property_owner_')) {
        const bookingCode = data.replace('confirm_property_owner_', '');
        
        // Store booking code in Redis for PIN verification
        const redis = getRedis();
        await redis.setex(`awaiting_pin:${chatId}`, 300, bookingCode);
        
        await bot.sendMessage(chatId, '🔐 *Enter tenant PIN:*', {
          parse_mode: 'Markdown'
        });
      }
    }
    // Otherwise, do NOTHING - let other handlers process it
  });
};

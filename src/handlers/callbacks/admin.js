const Booking = require('../../models/Booking');
const Commission = require('../../models/Commission');
const { isAdmin } = require('../../middleware/auth');
const logger = require('../../middleware/logger');

module.exports = (bot) => {
  bot.on('callback_query', async (cb) => {
    const chatId = cb.message.chat.id;
    const data = cb.data;
    const messageId = cb.message.message_id;
    
    // ONLY handle admin-specific callbacks
    if (data.startsWith('admin_')) {
      
      // Check authorization
      if (!isAdmin(chatId)) {
        await bot.answerCallbackQuery(cb.id, { text: 'Unauthorized' });
        return bot.sendMessage(chatId, '❌ You are not authorized.');
      }
      
      // Admin commission details
      if (data.startsWith('admin_commission_')) {
        await bot.answerCallbackQuery(cb.id, { text: 'Fetching commission...' });
        
        const bookingCode = data.replace('admin_commission_', '');
        
        try {
          const booking = await Booking.findByCode(bookingCode);
          
          if (!booking) {
            return bot.sendMessage(chatId, '❌ Booking not found');
          }
          
          const commission = booking.amount * 0.1;
          
          const message = 
            `💰 *Commission Details for ${bookingCode}*\n\n` +
            `• Apartment: ${booking.apartment_name}\n` +
            `• Amount: ₦${booking.amount}\n` +
            `• Commission (10%): ₦${commission}\n` +
            `• Owner ID: ${booking.owner_id || 'Not assigned'}\n` +
            `• Status: ${booking.owner_confirmed ? '✅ Owner Confirmed' : '⏳ Pending'}\n\n` +
            `Use /pay_commission [id] when paid`;
          
          await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
          
        } catch (error) {
          logger.error('Error in admin commission callback:', error);
          bot.sendMessage(chatId, '❌ Error fetching commission details.');
        }
      }
      
      // Admin dashboard shortcut
      else if (data === 'admin_dashboard') {
        await bot.answerCallbackQuery(cb.id, { text: 'Opening dashboard...' });
        bot.sendMessage(chatId, '/dashboard');
      }
      
    }
    // Otherwise, do NOTHING - let other handlers process it
  });
};

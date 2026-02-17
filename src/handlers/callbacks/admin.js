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
      
      // Handle main menu buttons
      if (data === 'admin_menu_bookings') {
        await bot.answerCallbackQuery(cb.id, { text: 'Opening Bookings...' });
        // Add bookings functionality here
        bot.sendMessage(chatId, '📋 *Bookings Menu*\n\nComing soon...', { parse_mode: 'Markdown' });
      }
      
      else if (data === 'admin_menu_apartments') {
        await bot.answerCallbackQuery(cb.id, { text: 'Opening Apartments...' });
        // Add apartments functionality here
        bot.sendMessage(chatId, '🏠 *Apartments Menu*\n\nComing soon...', { parse_mode: 'Markdown' });
      }
      
      else if (data === 'admin_menu_owners') {
        await bot.answerCallbackQuery(cb.id, { text: 'Opening Owners...' });
        // Add owners functionality here
        bot.sendMessage(chatId, '👥 *Owners Menu*\n\nComing soon...', { parse_mode: 'Markdown' });
      }
      
      else if (data === 'admin_menu_reports') {
        await bot.answerCallbackQuery(cb.id, { text: 'Opening Reports...' });
        // Add reports functionality here
        bot.sendMessage(chatId, '📊 *Reports Menu*\n\nComing soon...', { parse_mode: 'Markdown' });
      }
      
      else if (data === 'admin_menu_settings') {
        await bot.answerCallbackQuery(cb.id, { text: 'Opening Settings...' });
        // Add settings functionality here
        bot.sendMessage(chatId, '⚙️ *Settings Menu*\n\nComing soon...', { parse_mode: 'Markdown' });
      }
      
      // Admin commission details
      else if (data.startsWith('admin_commission_')) {
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

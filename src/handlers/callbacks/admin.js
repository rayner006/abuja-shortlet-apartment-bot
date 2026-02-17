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
        
        const message = '📋 *Bookings Management*\n\nSelect an option:';
        
        const keyboard = {
          inline_keyboard: [
            [{ text: '📅 All Bookings', callback_data: 'admin_bookings_all' }],
            [{ text: '⏳ Pending Verification', callback_data: 'admin_bookings_pending' }],
            [{ text: '✅ Verified', callback_data: 'admin_bookings_verified' }],
            [{ text: '💰 Commission Due', callback_data: 'admin_bookings_commission_due' }],
            [{ text: '💵 Paid Commissions', callback_data: 'admin_bookings_commission_paid' }],
            [{ text: '🔍 Search Booking', callback_data: 'admin_bookings_search' }],
            [{ text: '« Back to Admin', callback_data: 'admin_main_menu' }]
          ]
        };
        
        await bot.sendMessage(chatId, message, { 
          parse_mode: 'Markdown',
          reply_markup: keyboard 
        });
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
      
      // Bookings submenu handlers
      else if (data === 'admin_bookings_all') {
        await bot.answerCallbackQuery(cb.id, { text: 'Fetching all bookings...' });
        
        try {
          const Booking = require('../../models/Booking');
          const bookings = await Booking.findAll(); // Adjust based on your model
          
          if (!bookings || bookings.length === 0) {
            return bot.sendMessage(chatId, '📭 No bookings found.');
          }
          
          let message = '📋 *All Bookings*\n\n';
          bookings.slice(0, 10).forEach((booking, index) => {
            message += `${index+1}. *${booking.apartment_name}*\n`;
            message += `   Guest: ${booking.guest_name}\n`;
            message += `   Dates: ${booking.check_in} to ${booking.check_out}\n`;
            message += `   Amount: ₦${booking.amount}\n`;
            message += `   Status: ${booking.status || 'Pending'}\n`;
            message += `   Commission: ${booking.commission_paid ? '✅ Paid' : '⏳ Due'}\n\n`;
          });
          
          message += 'Showing last 10 bookings. Use search for more.';
          
          const keyboard = {
            inline_keyboard: [
              [{ text: '« Back to Bookings', callback_data: 'admin_menu_bookings' }]
            ]
          };
          
          await bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            reply_markup: keyboard 
          });
          
        } catch (error) {
          logger.error('Error fetching bookings:', error);
          bot.sendMessage(chatId, '❌ Error fetching bookings.');
        }
      }
      
      else if (data === 'admin_bookings_pending') {
        await bot.answerCallbackQuery(cb.id, { text: 'Fetching pending verifications...' });
        bot.sendMessage(chatId, '⏳ *Pending Verification*\n\nComing soon...', { parse_mode: 'Markdown' });
      }

      else if (data === 'admin_bookings_verified') {
        await bot.answerCallbackQuery(cb.id, { text: 'Fetching verified bookings...' });
        bot.sendMessage(chatId, '✅ *Verified Bookings*\n\nComing soon...', { parse_mode: 'Markdown' });
      }

      else if (data === 'admin_bookings_commission_due') {
        await bot.answerCallbackQuery(cb.id, { text: 'Fetching commissions due...' });
        bot.sendMessage(chatId, '💰 *Commissions Due*\n\nComing soon...', { parse_mode: 'Markdown' });
      }

      else if (data === 'admin_bookings_commission_paid') {
        await bot.answerCallbackQuery(cb.id, { text: 'Fetching paid commissions...' });
        bot.sendMessage(chatId, '💵 *Paid Commissions*\n\nComing soon...', { parse_mode: 'Markdown' });
      }

      else if (data === 'admin_bookings_search') {
        await bot.answerCallbackQuery(cb.id, { text: 'Search feature...' });
        bot.sendMessage(chatId, '🔍 *Search Booking*\n\nPlease enter booking code or guest name:', { parse_mode: 'Markdown' });
        // This would need a message listener to handle the response
      }
      
      else if (data === 'admin_main_menu') {
        await bot.answerCallbackQuery(cb.id, { text: 'Returning to admin...' });
        
        const keyboard = {
          inline_keyboard: [
            [
              { text: '📋 Bookings', callback_data: 'admin_menu_bookings' },
              { text: '🏠 Apartments', callback_data: 'admin_menu_apartments' }
            ],
            [
              { text: '👥 Owners', callback_data: 'admin_menu_owners' },
              { text: '📊 Reports', callback_data: 'admin_menu_reports' }
            ],
            [
              { text: '⚙️ Settings', callback_data: 'admin_menu_settings' }
            ]
          ]
        };
        
        await bot.sendMessage(chatId, '🛠 *Admin Control Center*', {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
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

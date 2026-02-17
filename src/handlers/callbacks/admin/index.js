const { isAdmin } = require('../../../middleware/auth');
const logger = require('../../../middleware/logger');

module.exports = (bot) => {
  
  // Main admin callback handler - routes to specific modules
  bot.on('callback_query', async (cb) => {
    const chatId = cb.message.chat.id;
    const data = cb.data;
    
    // Only handle admin callbacks
    if (!data.startsWith('admin_')) {
      return; // Let other handlers process it
    }
    
    // Check authorization
    if (!isAdmin(chatId)) {
      await bot.answerCallbackQuery(cb.id, { text: 'Unauthorized' });
      return bot.sendMessage(chatId, '❌ You are not authorized.');
    }
    
    // Route to appropriate module based on callback data
    if (data.startsWith('admin_menu_') || data === 'admin_main_menu') {
      // Handle main menu navigation
      await handleMainMenu(bot, cb, chatId, data);
    }
    else if (data.startsWith('admin_bookings_') || 
             data.startsWith('admin_verify_') || 
             data.startsWith('admin_confirm_verify_') || 
             data.startsWith('admin_delete_') || 
             data.startsWith('admin_confirm_delete_')) {
      // Route to bookings module
      const bookingsHandler = require('./bookings');
      await bookingsHandler.handle(bot, cb, chatId, data);
    }
    else if (data.startsWith('admin_apartments_') || 
             data.startsWith('admin_apartment_') ||
             data.startsWith('admin_photo_')) {
      // Route to apartments module
      const apartmentsHandler = require('./apartments');
      await apartmentsHandler.handle(bot, cb, chatId, data);
    }
    else if (data.startsWith('admin_commission_')) {
      // Handle commission details
      const { executeQuery } = require('../../../config/database');
      const Booking = require('../../../models/Booking');
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
    else if (data === 'admin_dashboard') {
      // Admin dashboard shortcut
      await bot.answerCallbackQuery(cb.id, { text: 'Opening dashboard...' });
      bot.sendMessage(chatId, '/dashboard');
    }
    else {
      // Unknown admin callback
      logger.warn(`Unknown admin callback: ${data}`);
      await bot.answerCallbackQuery(cb.id, { text: 'Unknown command' });
    }
  });
};

// Main menu handler
async function handleMainMenu(bot, cb, chatId, data) {
  if (data === 'admin_main_menu') {
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
  else if (data === 'admin_menu_bookings') {
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
    
    const message = '🏠 *Apartments Management*\n\nSelect an option:';
    const keyboard = {
      inline_keyboard: [
        [{ text: '📍 View by Location', callback_data: 'admin_apartments_all' }],
        [{ text: '➕ Add New Apartment', callback_data: 'admin_apartments_add' }],
        [{ text: '« Back to Admin', callback_data: 'admin_main_menu' }]
      ]
    };
    
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    });
  }
  else if (data === 'admin_menu_owners') {
    await bot.answerCallbackQuery(cb.id, { text: 'Opening Owners...' });
    bot.sendMessage(chatId, '👥 *Owners Menu*\n\nComing soon...', { parse_mode: 'Markdown' });
  }
  else if (data === 'admin_menu_reports') {
    await bot.answerCallbackQuery(cb.id, { text: 'Opening Reports...' });
    bot.sendMessage(chatId, '📊 *Reports Menu*\n\nComing soon...', { parse_mode: 'Markdown' });
  }
  else if (data === 'admin_menu_settings') {
    await bot.answerCallbackQuery(cb.id, { text: 'Opening Settings...' });
    bot.sendMessage(chatId, '⚙️ *Settings Menu*\n\nComing soon...', { parse_mode: 'Markdown' });
  }
}

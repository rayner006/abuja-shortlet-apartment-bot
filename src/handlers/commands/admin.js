const { isAdmin } = require('../../middleware/auth');
const logger = require('../../middleware/logger');

module.exports = (bot) => {

  // ================= MAIN ADMIN PANEL =================
  bot.onText(/\/admin$/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      if (!isAdmin(chatId)) {
        return bot.sendMessage(chatId, '❌ This command is for admins only.');
      }

      await bot.sendMessage(chatId, '🛠 *Admin Control Center*', {
        parse_mode: 'Markdown',
        reply_markup: {
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
        }
      });

    } catch (error) {
      logger.error('Admin Panel Error:', error);
      bot.sendMessage(chatId, '⚠️ Failed to open admin panel.');
    }
  });

};

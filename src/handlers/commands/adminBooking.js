const { isAdmin } = require('../../middleware/auth');
const logger = require('../../middleware/logger');

module.exports = (bot) => {

  // ================= BOOKING ADMIN PANEL =================
  bot.onText(/\/admin_booking/, async (msg) => {
    const chatId = msg.chat.id;

    try {
      if (!isAdmin(chatId)) {
        return bot.sendMessage(chatId, '❌ This command is for admins only.');
      }

      await bot.sendMessage(chatId, '🏠 *Booking Admin Panel*', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 View Bookings', callback_data: 'admin_view_bookings' }],
            [
              { text: '✅ Approve Booking', callback_data: 'admin_approve_booking' },
              { text: '❌ Reject Booking', callback_data: 'admin_reject_booking' }
            ],
            [{ text: '🗑 Delete Apartment', callback_data: 'admin_delete_apartment' }]
          ]
        }
      });

    } catch (error) {
      logger.error('Admin Booking Panel Error:', error);
      bot.sendMessage(chatId, '⚠️ Something went wrong opening admin panel.');
    }
  });

};

const LocationHandler = require('./locationHandler');
const BookingHandler = require('./bookingHandler');
const Keyboard = require('../utils/keyboard');
const logger = require('../middleware/logger');

class MessageHandler {
  static async handle(bot, msg) {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text) return;

    try {
      /* ================= MAIN MENU ================= */
      if (text === '🏠 Browse Apartments') {
        return LocationHandler.showLocations(bot, chatId);
      }

      if (text === '📅 My Bookings') {
        return bot.sendMessage(
          chatId,
          'Booking history feature coming soon.'
        );
      }

      if (text === '📞 Contact Support') {
        return bot.sendMessage(
          chatId,
          'Support: @your_support_username'
        );
      }

      /* ================= BACK BUTTON ================= */
      if (text === '⬅️ Back to Menu' || text === '⬅️ Back') {
        return bot.sendMessage(
          chatId,
          'Main Menu:',
          Keyboard.mainMenu()
        );
      }

      /* ================= DATE INPUT ================= */
      // If user is in booking flow, this will capture dates
      await BookingHandler.handleDateInput(bot, msg);

      /* ================= LOCATION FALLBACK ================= */
      // If not booking date, treat text as location
      await LocationHandler.handleSelection(bot, msg);

    } catch (error) {
      logger.error('Message handler error:', error);
      await bot.sendMessage(
        chatId,
        '⚠️ Something went wrong. Please try again.'
      );
    }
  }
}

module.exports = MessageHandler;

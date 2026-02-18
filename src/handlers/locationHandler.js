const ApartmentService = require('../services/apartmentService');
const Keyboard = require('../utils/keyboard');
const logger = require('../middleware/logger');

class LocationHandler {
  /* ================= SHOW LOCATIONS ================= */
  static async showLocations(bot, chatId) {
    try {
      const locations = await ApartmentService.getLocations();

      if (!locations.length) {
        return bot.sendMessage(
          chatId,
          'No apartments available at the moment.'
        );
      }

      await bot.sendMessage(
        chatId,
        '📍 Select a location:',
        Keyboard.locationMenu(locations)
      );
    } catch (error) {
      logger.error('Error showing locations:', error);
      await bot.sendMessage(
        chatId,
        '⚠️ Unable to fetch locations. Please try again later.'
      );
    }
  }

  /* ================= HANDLE LOCATION SELECT ================= */
  static async handleSelection(bot, msg) {
    const chatId = msg.chat.id;
    const selectedLocation = msg.text;

    try {
      logger.info(`User selected location: ${selectedLocation}`);

      // Let apartmentHandler take over listing
      const ApartmentHandler = require('./apartmentHandler');
      await ApartmentHandler.showApartments(
        bot,
        chatId,
        selectedLocation
      );
    } catch (error) {
      logger.error('Error handling location selection:', error);
      await bot.sendMessage(
        chatId,
        '⚠️ Something went wrong. Please try again.'
      );
    }
  }
}

module.exports = LocationHandler;

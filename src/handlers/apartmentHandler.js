const ApartmentService = require('../services/apartmentService');
const Keyboard = require('../utils/keyboard');
const Helpers = require('../utils/helpers');
const logger = require('../middleware/logger');

class ApartmentHandler {
  /* ================= SHOW APARTMENTS ================= */
  static async showApartments(bot, chatId, location) {
    try {
      const apartments = await ApartmentService.getByLocation(location);

      if (!apartments.length) {
        return bot.sendMessage(
          chatId,
          `No apartments found in ${location}.`
        );
      }

      for (const apt of apartments) {
        const caption = `
🏠 *${apt.title}*
📍 ${apt.location}
💵 ${Helpers.formatCurrency(apt.price_per_night)} / night
`;

        if (apt.cover_photo) {
          await bot.sendPhoto(chatId, apt.cover_photo, {
            caption,
            parse_mode: 'Markdown',
            ...Keyboard.apartmentInline(apt.id)
          });
        } else {
          await bot.sendMessage(chatId, caption, {
            parse_mode: 'Markdown',
            ...Keyboard.apartmentInline(apt.id)
          });
        }
      }
    } catch (error) {
      logger.error('Error showing apartments:', error);
      await bot.sendMessage(
        chatId,
        '⚠️ Unable to fetch apartments right now.'
      );
    }
  }

  /* ================= SHOW DETAILS ================= */
  static async showDetails(bot, chatId, apartmentId) {
    try {
      const apt = await ApartmentService.getById(apartmentId);
      if (!apt) {
        return bot.sendMessage(chatId, 'Apartment not found.');
      }

      const text = `
🏠 *${apt.title}*
📍 ${apt.location}
💵 ${Helpers.formatCurrency(apt.price_per_night)} / night

📝 ${Helpers.truncateText(apt.description, 800)}
`;

      await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        ...Keyboard.apartmentInline(apartmentId)
      });
    } catch (error) {
      logger.error('Error showing details:', error);
      await bot.sendMessage(chatId, '⚠️ Failed to load details.');
    }
  }

  /* ================= SHOW PHOTOS ================= */
  static async showPhotos(bot, chatId, apartmentId) {
    try {
      const photos = await ApartmentService.getPhotos(apartmentId);

      if (!photos.length) {
        return bot.sendMessage(chatId, 'No photos available.');
      }

      for (const url of photos) {
        await bot.sendPhoto(chatId, url);
      }
    } catch (error) {
      logger.error('Error showing photos:', error);
      await bot.sendMessage(chatId, '⚠️ Failed to load photos.');
    }
  }
}

module.exports = ApartmentHandler;

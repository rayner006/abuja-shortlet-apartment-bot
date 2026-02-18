const Helpers = require('../utils/helpers');
const ApartmentHandler = require('./apartmentHandler');
const BookingHandler = require('./bookingHandler');
const BookingService = require('../services/bookingService');
const UserService = require('../services/userService');
const Keyboard = require('../utils/keyboard');
const logger = require('../middleware/logger');

class CallbackHandler {
  static async handle(bot, query) {
    const chatId = query.message.chat.id;
    const data = Helpers.parseCallbackData(query.data);

    if (!data) return;

    const { action, id } = data;

    try {
      switch (action) {
        /* ================= APARTMENT ================= */
        case 'photos':
          await ApartmentHandler.showPhotos(bot, chatId, id);
          break;

        case 'details':
          await ApartmentHandler.showDetails(bot, chatId, id);
          break;

        case 'book':
          await BookingHandler.start(
            bot,
            chatId,
            query.from.id,
            id
          );
          break;

        /* ================= BOOKING ================= */
        case 'confirm':
          await BookingHandler.confirm(
            bot,
            chatId,
            query.from.id,
            id
          );
          break;

        case 'cancel':
          await bot.sendMessage(chatId, '❌ Booking cancelled.');
          break;

        /* ================= OWNER ACTIONS ================= */
        case 'paid': {
          const result = await BookingService.confirmPayment(id);

          await bot.sendMessage(
            chatId,
            `💰 Payment Confirmed!\nCommission: ${Helpers.formatCurrency(
              result.commission
            )}\nOwner Payout: ${Helpers.formatCurrency(
              result.ownerPayout
            )}`
          );

          // Notify admins
          const admins = await UserService.getAdmins();
          for (const admin of admins) {
            await bot.sendMessage(
              admin.telegram_id,
              `📊 Commission Earned: ${Helpers.formatCurrency(
                result.commission
              )}`
            );
          }
          break;
        }

        case 'reject':
          await BookingService.cancel(id);
          await bot.sendMessage(chatId, '❌ Booking rejected.');
          break;

        /* ================= ADMIN ================= */
        case 'commission': {
          const report = await BookingService.getCommissionReport();

          await bot.sendMessage(
            chatId,
            `📊 Commission Report\n\nTotal Earned: ${Helpers.formatCurrency(
              report.total_commission || 0
            )}\nPaid Bookings: ${report.total_paid_bookings || 0}`
          );
          break;
        }

        default:
          logger.warn(`Unknown callback action: ${action}`);
      }

      await bot.answerCallbackQuery(query.id);
    } catch (error) {
      logger.error('Callback handler error:', error);
      await bot.sendMessage(chatId, '⚠️ Action failed.');
    }
  }
}

module.exports = CallbackHandler;

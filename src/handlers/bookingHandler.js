const BookingService = require('../services/bookingService');
const ApartmentService = require('../services/apartmentService');
const UserService = require('../services/userService');
const Helpers = require('../utils/helpers');
const Keyboard = require('../utils/keyboard');
const logger = require('../middleware/logger');

class BookingHandler {
  // Temporary in-memory state (can later move to Redis)
  static pendingBookings = new Map();

  /* ================= START BOOKING ================= */
  static async start(bot, chatId, userId, apartmentId) {
    try {
      const apartment = await ApartmentService.getById(apartmentId);
      if (!apartment) {
        return bot.sendMessage(chatId, 'Apartment not found.');
      }

      // Save state
      this.pendingBookings.set(chatId, {
        apartmentId,
        step: 'checkin'
      });

      await bot.sendMessage(
        chatId,
        `📅 Enter *Check-in Date* (YYYY-MM-DD):`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      logger.error('Start booking error:', error);
      await bot.sendMessage(chatId, '⚠️ Unable to start booking.');
    }
  }

  /* ================= HANDLE DATE INPUT ================= */
  static async handleDateInput(bot, msg) {
    const chatId = msg.chat.id;
    const text = msg.text;
    const state = this.pendingBookings.get(chatId);

    if (!state) return;

    try {
      if (!Helpers.isFutureDate(text)) {
        return bot.sendMessage(chatId, 'Please enter a valid future date.');
      }

      if (state.step === 'checkin') {
        state.checkIn = text;
        state.step = 'checkout';

        return bot.sendMessage(
          chatId,
          `📅 Enter *Check-out Date* (YYYY-MM-DD):`,
          { parse_mode: 'Markdown' }
        );
      }

      if (state.step === 'checkout') {
        state.checkOut = text;

        const apt = await ApartmentService.getById(state.apartmentId);

        // Simple 1-night calculation (can be improved)
        const total = apt.price_per_night;

        state.totalPrice = total;

        await bot.sendMessage(
          chatId,
          `Confirm Booking\n\n💵 ${Helpers.formatCurrency(total)}`,
          Keyboard.bookingConfirm(state.apartmentId)
        );

        state.step = 'confirm';
      }
    } catch (error) {
      logger.error('Date input error:', error);
      await bot.sendMessage(chatId, '⚠️ Invalid input.');
    }
  }

  /* ================= CONFIRM BOOKING ================= */
  static async confirm(bot, chatId, userTelegram, apartmentId) {
    const state = this.pendingBookings.get(chatId);
    if (!state) return;

    try {
      const user = await UserService.findByTelegramId(userTelegram);
      const ref = Helpers.generateRef('BOOK');

      const bookingId = await BookingService.create({
        apartment_id: apartmentId,
        user_id: user.id,
        check_in: state.checkIn,
        check_out: state.checkOut,
        total_price: state.totalPrice,
        reference: ref
      });

      this.pendingBookings.delete(chatId);

      await bot.sendMessage(
        chatId,
        `✅ Booking Created!\nReference: ${ref}\nAwait payment confirmation.`
      );

      await this.notifyOwnerAndAdmin(bot, bookingId);
    } catch (error) {
      logger.error('Confirm booking error:', error);
      await bot.sendMessage(chatId, '⚠️ Failed to confirm booking.');
    }
  }

  /* ================= NOTIFICATIONS ================= */
  static async notifyOwnerAndAdmin(bot, bookingId) {
    try {
      const booking = await BookingService.getById(bookingId);
      const admins = await UserService.getAdmins();

      // Notify owner
      if (booking.owner_id) {
        await bot.sendMessage(
          booking.owner_id,
          `📢 New Booking Received\nID: ${bookingId}`,
          Keyboard.ownerApproval(bookingId)
        );
      }

      // Notify admins
      for (const admin of admins) {
        await bot.sendMessage(
          admin.telegram_id,
          `📊 Booking Created #${bookingId}`,
          Keyboard.adminActions(bookingId)
        );
      }
    } catch (error) {
      logger.error('Notification error:', error);
    }
  }
}

module.exports = BookingHandler;

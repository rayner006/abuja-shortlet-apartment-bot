const BookingService = require('../../services/bookingService');
const { getDateRangePickerKeyboard } = require('../../utils/datePicker');
const { getRedis } = require('../../config/redis');
const logger = require('../../middleware/logger');

module.exports = (bot) => {

  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    try {
      const redis = getRedis();
      const sessionRaw = await redis.get(`session:${chatId}`);
      if (!sessionRaw) return;

      const session = JSON.parse(sessionRaw);

      /* ================= DATE CLICK ================= */
      if (data.startsWith('date_')) {
        const selectedDate = data.replace('date_', '');

        if (!session.startDate) {
          session.startDate = selectedDate;
          session.step = 'awaiting_end_date';
        } else {
          session.endDate = selectedDate;
          session.step = 'ready_to_confirm';
        }

        await redis.setex(`session:${chatId}`, 3600, JSON.stringify(session));

        const keyboard = getDateRangePickerKeyboard(
          session.step === 'awaiting_end_date' ? 'end' : 'start',
          session.startDate,
          session.endDate
        );

        await bot.editMessageReplyMarkup(
          keyboard.reply_markup,
          { chat_id: chatId, message_id: messageId }
        );
      }

      /* ================= MONTH NAV ================= */
      else if (data.startsWith('month_')) {
        const [, year, month] = data.split('_');

        const keyboard = getDateRangePickerKeyboard(
          session.step,
          session.startDate,
          session.endDate,
          Number(year),
          Number(month)
        );

        await bot.editMessageReplyMarkup(
          keyboard.reply_markup,
          { chat_id: chatId, message_id: messageId }
        );
      }

      /* ================= YEAR NAV ================= */
      else if (data.startsWith('year_prev_') || data.startsWith('year_next_')) {
        const parts = data.split('_');
        const year = Number(parts[2]);
        const month = Number(parts[3]);

        const keyboard = getDateRangePickerKeyboard(
          session.step,
          session.startDate,
          session.endDate,
          year,
          month
        );

        await bot.editMessageReplyMarkup(
          keyboard.reply_markup,
          { chat_id: chatId, message_id: messageId }
        );
      }

      /* ================= CLEAR ================= */
      else if (data === 'clear_dates') {
        session.startDate = null;
        session.endDate = null;
        session.step = 'awaiting_start_date';

        await redis.setex(`session:${chatId}`, 3600, JSON.stringify(session));

        const keyboard = getDateRangePickerKeyboard('start');

        await bot.editMessageReplyMarkup(
          keyboard.reply_markup,
          { chat_id: chatId, message_id: messageId }
        );
      }

      /* ================= CONFIRM ================= */
      else if (data === 'confirm_booking') {
        const result = await BookingService.confirmBooking(chatId, session);

        await bot.sendMessage(chatId, result.message);
      }

      /* ================= CANCEL ================= */
      else if (data === 'cancel_booking') {
        await redis.del(`session:${chatId}`);
        await bot.sendMessage(chatId, '❌ Booking cancelled.');
      }

      await bot.answerCallbackQuery(query.id);

    } catch (error) {
      logger.error('Booking callback error:', error);
    }
  });

};

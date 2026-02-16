const BookingService = require('../../services/bookingService');
const { getDateRangePickerKeyboard, getDatePickerKeyboard } = require('../../utils/datePicker');
const { getRedis } = require('../../config/redis');
const logger = require('../../middleware/logger');

module.exports = (bot) => {

  bot.on('callback_query', async (cb) => {
    if (!cb.message) return;

    const chatId = cb.message.chat.id;
    const messageId = cb.message.message_id;
    const data = cb.data;

    const redis = getRedis();

    const getSession = async () => {
      const raw = await redis.get(`session:${chatId}`);
      return raw ? JSON.parse(raw) : null;
    };

    const saveSession = async (session) => {
      await redis.setex(`session:${chatId}`, 3600, JSON.stringify(session));
    };

    console.log('📅 CALLBACK:', data);

    /* ================= DATE SELECT ================= */
    if (data.startsWith('date_')) {
      const selectedDate = data.replace('date_', '');

      try {
        const session = await getSession();
        if (!session) return bot.answerCallbackQuery(cb.id);

        /* ---------- CHECK-IN ---------- */
        if (session.step === 'awaiting_start_date') {
          session.startDate = selectedDate;
          session.step = 'awaiting_end_date';
          await saveSession(session);

          await bot.editMessageText(
            `📅 *Select your Check-Out Date*\n\n` +
            `🔵 Check-In Selected: *${selectedDate}*\n\n` +
            `You can change month/year before picking.`,
            {
              chat_id: chatId,
              message_id: messageId,
              parse_mode: 'Markdown',
              reply_markup: getDateRangePickerKeyboard('end', selectedDate).reply_markup
            }
          );

          await bot.answerCallbackQuery(cb.id, { text: 'Check-in selected' });
        }

        /* ---------- CHECK-OUT ---------- */
        else if (session.step === 'awaiting_end_date') {
          const start = new Date(session.startDate);
          const end = new Date(selectedDate);

          if (end <= start) {
            return bot.answerCallbackQuery(cb.id, {
              text: 'Check-out must be after check-in'
            });
          }

          const result = await BookingService.processEndDate(
            chatId,
            selectedDate,
            session
          );

          await redis.del(`session:${chatId}`);

          await bot.editMessageText(result.message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
          });

          await bot.answerCallbackQuery(cb.id, { text: 'Booking confirmed' });
        }

      } catch (err) {
        logger.error('DATE ERROR:', err);
        await bot.answerCallbackQuery(cb.id, { text: 'Error processing date' });
      }
    }

    /* ================= MONTH NAV ================= */
    else if (data.startsWith('month_')) {
      try {
        const [, year, month] = data.split('_').map(Number);
        const session = await getSession();
        if (!session) return bot.answerCallbackQuery(cb.id);

        const keyboard =
          session.step === 'awaiting_start_date'
            ? getDatePickerKeyboard(year, month)
            : getDatePickerKeyboard(year, month, null, session.startDate);

        await bot.editMessageReplyMarkup(
          keyboard.reply_markup,
          { chat_id: chatId, message_id: messageId }
        );

        await bot.answerCallbackQuery(cb.id);

      } catch (err) {
        logger.error('MONTH NAV ERROR:', err);
      }
    }

    /* ================= YEAR NAV ================= */
    else if (data.startsWith('year_')) {
      try {
        const [, direction, year, month] = data.split('_');
        const newYear = direction === 'prev'
          ? Number(year) - 1
          : Number(year) + 1;

        const session = await getSession();
        if (!session) return bot.answerCallbackQuery(cb.id);

        const keyboard =
          session.step === 'awaiting_start_date'
            ? getDatePickerKeyboard(newYear, Number(month))
            : getDatePickerKeyboard(newYear, Number(month), null, session.startDate);

        await bot.editMessageReplyMarkup(
          keyboard.reply_markup,
          { chat_id: chatId, message_id: messageId }
        );

        await bot.answerCallbackQuery(cb.id);

      } catch (err) {
        logger.error('YEAR NAV ERROR:', err);
      }
    }

    /* ================= CLEAR DATES ================= */
    else if (data === 'clear_dates') {
      const session = await getSession();
      if (!session) return bot.answerCallbackQuery(cb.id);

      session.startDate = null;
      session.endDate = null;
      session.step = 'awaiting_start_date';
      await saveSession(session);

      await bot.editMessageText(
        `📅 *Select your Check-In Date*\n\n` +
        `You can change month or year before picking.`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: getDateRangePickerKeyboard('start').reply_markup
        }
      );

      await bot.answerCallbackQuery(cb.id, { text: 'Dates cleared' });
    }

    /* ================= CANCEL ================= */
    else if (data === 'cancel_booking') {
      await redis.del(`session:${chatId}`);

      await bot.editMessageText('❌ Booking cancelled.', {
        chat_id: chatId,
        message_id: messageId
      });

      await bot.answerCallbackQuery(cb.id, { text: 'Cancelled' });
    }

    /* ================= START BOOK ================= */
    else if (data.startsWith('book_')) {
      const apartmentId = data.replace('book_', '');

      try {
        const result = await BookingService.startBooking(
          chatId,
          apartmentId,
          cb.message
        );

        if (!result.success) {
          return bot.sendMessage(chatId, result.message);
        }

        await saveSession(result.session);

        await bot.sendMessage(chatId, result.message, {
          parse_mode: 'Markdown'
        });

        await bot.answerCallbackQuery(cb.id, { text: 'Booking started' });

      } catch (err) {
        logger.error('BOOK START ERROR:', err);
        await bot.sendMessage(chatId, '❌ Error starting booking.');
      }
    }

  });
};

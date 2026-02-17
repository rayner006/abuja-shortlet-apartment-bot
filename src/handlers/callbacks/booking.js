const BookingService = require('../../services/bookingService');
const { getDatePickerKeyboard } = require('../../utils/datePicker');
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

    /* ================= DATE CLICK ================= */
    if (data.startsWith('date_')) {
      const picked = data.replace('date_', '');
      const session = await getSession();
      if (!session) return;

      if (!session.startDate) {
        session.startDate = picked;
      } else if (!session.endDate) {
        if (picked <= session.startDate) {
          return bot.answerCallbackQuery(cb.id, { text: 'End must be after start' });
        }
        session.endDate = picked;
      }

      await saveSession(session);

      const [year, month] = picked.split('-');

      const keyboard = getDatePickerKeyboard(
        Number(year),
        Number(month) - 1,
        session.startDate,
        session.endDate
      );

      await bot.editMessageReplyMarkup(keyboard.reply_markup, {
        chat_id: chatId,
        message_id: messageId
      });

      await bot.answerCallbackQuery(cb.id);
    }

    /* ================= CONFIRM BOOKING ================= */
    else if (data === 'confirm_booking') {
      const session = await getSession();
      if (!session?.startDate || !session?.endDate) {
        return bot.answerCallbackQuery(cb.id, { text: 'Select dates first' });
      }

      const result = await BookingService.processEndDate(
        chatId,
        session.endDate,
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

    /* ================= CLEAR ================= */
    else if (data === 'clear_dates') {
      const session = await getSession();
      if (!session) return;

      session.startDate = null;
      session.endDate = null;
      await saveSession(session);

      await bot.answerCallbackQuery(cb.id, { text: 'Cleared' });
    }

    /* ================= CANCEL ================= */
    else if (data === 'cancel_booking') {
      await redis.del(`session:${chatId}`);

      await bot.editMessageText('❌ Booking cancelled.', {
        chat_id: chatId,
        message_id: messageId
      });
    }

    /* ================= BOOK NOW BUTTON ================= */
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

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

    /* ================= BOOK NOW ================= */
    if (data.startsWith('book_')) {
      const apartmentId = data.replace('book_', '');

      try {
        const result = await BookingService.startBooking(chatId, apartmentId, cb.message);

        if (!result.success) {
          return bot.sendMessage(chatId, result.message);
        }

        await saveSession(result.session);

        await bot.sendMessage(chatId, result.message, {
          parse_mode: 'Markdown',
          reply_markup: { force_reply: true }
        });

        await bot.answerCallbackQuery(cb.id, { text: 'Booking started' });

      } catch (err) {
        logger.error(err);
      }
    }

    /* ================= DATE CLICK ================= */
    else if (data.startsWith('date_')) {
      const selectedDate = data.replace('date_', '');
      const session = await getSession();
      if (!session) return;

      if (session.step === 'awaiting_start_date') {
        session.startDate = selectedDate;
        session.step = 'awaiting_end_date';
        await saveSession(session);

        const d = new Date();
        await bot.editMessageText('📅 *Select Check-Out Date*', {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: getDatePickerKeyboard(
            d.getFullYear(),
            d.getMonth(),
            session.startDate
          ).reply_markup
        });
      }

      else if (session.step === 'awaiting_end_date') {
        const result = await BookingService.processEndDate(chatId, selectedDate, session);

        await redis.del(`session:${chatId}`);

        await bot.editMessageText(result.message, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown'
        });
      }

      await bot.answerCallbackQuery(cb.id);
    }

  });

};

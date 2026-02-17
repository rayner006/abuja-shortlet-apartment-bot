const BookingService = require('../../services/bookingService');
const { getDatePickerKeyboard } = require('../../utils/datePicker');
const { getRedis } = require('../../config/redis');
const logger = require('../../middleware/logger');

/* ===== SHORT DATE FORMAT HELPER ===== */
const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);

  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

module.exports = (bot) => {

  bot.on('callback_query', async (query) => {
    if (!query.message) return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    const redis = getRedis();

    const getSession = async () => {
      const raw = await redis.get(`session:${chatId}`);
      return raw ? JSON.parse(raw) : null;
    };

    const saveSession = async (session) => {
      await redis.setex(`session:${chatId}`, 3600, JSON.stringify(session));
    };

    const buildHeader = (session) => {
      if (!session.startDate)
        return '📅 *Select your check-in date:*';

      if (session.startDate && !session.endDate)
        return `📅 Check-in: *${formatShortDate(session.startDate)}*\nSelect *check-out* date:`;

      return `📅 Check-in: *${formatShortDate(session.startDate)}*\n📅 Check-out: *${formatShortDate(session.endDate)}*`;
    };

    try {

      /* ================= DATE SELECT ================= */
      if (data.startsWith('date_')) {
        const selectedDate = data.replace('date_', '');
        const session = await getSession();
        if (!session) return bot.answerCallbackQuery(query.id);

        if (session.step === 'awaiting_start_date') {
          session.startDate = selectedDate;
          session.step = 'awaiting_end_date';
          await saveSession(session);
        } else if (session.step === 'awaiting_end_date') {
          const start = new Date(session.startDate);
          const end = new Date(selectedDate);

          if (end <= start) {
            return bot.answerCallbackQuery(query.id, {
              text: 'Check-out must be after check-in'
            });
          }

          session.endDate = selectedDate;
          await saveSession(session);
        }

        const start = new Date(session.startDate || new Date());

        await bot.editMessageText(
          buildHeader(session),
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: getDatePickerKeyboard(
              start.getFullYear(),
              start.getMonth(),
              session.startDate,
              session.endDate,
              session.selectedMonth,
              session.selectedYear
            ).reply_markup
          }
        );

        return bot.answerCallbackQuery(query.id);
      }

      /* ================= MONTH NAV ================= */
      if (data.startsWith('month_')) {
        const parts = data.split('_');
        const year = Number(parts[1]);
        const month = Number(parts[2]);

        const session = await getSession();
        if (!session) return;

        await bot.editMessageText(
          buildHeader(session),
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: getDatePickerKeyboard(
              year,
              month,
              session.startDate,
              session.endDate,
              session.selectedMonth,
              session.selectedYear
            ).reply_markup
          }
        );

        return bot.answerCallbackQuery(query.id);
      }

      /* ================= YEAR NAV ================= */
      if (data.startsWith('year_')) {
        const [, direction, year, month] = data.split('_');
        const newYear = direction === 'prev'
          ? Number(year) - 1
          : Number(year) + 1;

        const session = await getSession();
        if (!session) return;

        await bot.editMessageText(
          buildHeader(session),
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: getDatePickerKeyboard(
              newYear,
              Number(month),
              session.startDate,
              session.endDate,
              session.selectedMonth,
              session.selectedYear
            ).reply_markup
          }
        );

        return bot.answerCallbackQuery(query.id);
      }

      /* ================= CLEAR ================= */
      if (data === 'clear_dates') {
        const session = await getSession();
        if (!session) return;

        session.startDate = null;
        session.endDate = null;
        session.selectedMonth = null;
        session.selectedYear = null;
        session.step = 'awaiting_start_date';
        await saveSession(session);

        const now = new Date();

        await bot.editMessageText(
          '📅 *Select your check-in date:*',
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: getDatePickerKeyboard(
              now.getFullYear(),
              now.getMonth()
            ).reply_markup
          }
        );

        return bot.answerCallbackQuery(query.id);
      }

    } catch (err) {
      logger.error('BOOKING CALLBACK ERROR:', err);
      bot.answerCallbackQuery(query.id, { text: 'Error occurred' });
    }
  });

};

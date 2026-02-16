const BookingService = require('../../services/bookingService');
const { getDateRangePickerKeyboard } = require('../../utils/datePicker');
const { getRedis } = require('../../config/redis');
const logger = require('../../middleware/logger');

module.exports = (bot) => {

  bot.on('message', async (msg) => {

    // STOP if no text
    if (!msg.text) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    // STOP commands
    if (text.startsWith('/')) return;

    try {
      const redis = getRedis();
      const sessionRaw = await redis.get(`session:${chatId}`);
      if (!sessionRaw) return;

      const session = JSON.parse(sessionRaw);

      // ONLY run if user is actually in booking flow
      if (!session.step) return;

      /* ================= NAME STEP ================= */
      if (session.step === 'awaiting_name') {

        const result = await BookingService.processName(chatId, text, session);

        if (result.success) {
          await bot.sendMessage(chatId, result.message, {
            parse_mode: 'Markdown',
            reply_markup: { force_reply: true }
          });
        } else {
          await bot.sendMessage(chatId, result.message);
        }
      }

      /* ================= PHONE STEP ================= */
      else if (session.step === 'awaiting_phone') {

        // Ignore menu button texts
        const blockedTexts = [
          '🏠 View Apartments',
          '📞 Contact Admin',
          '⬅️ Back to Main Menu'
        ];

        if (blockedTexts.includes(text)) return;

        // Validate phone
        if (!/^[0-9+\-\s()]{7,}$/.test(text)) {
          return bot.sendMessage(chatId, '❌ Please enter a valid phone number:');
        }

        const result = await BookingService.processPhone(chatId, text, session);

        if (result.success) {
          await bot.sendMessage(chatId, result.message, {
            parse_mode: 'Markdown',
            reply_markup: getDateRangePickerKeyboard('start').reply_markup
          });
        } else {
          await bot.sendMessage(chatId, result.message);
        }
      }

    } catch (error) {
      logger.error('Booking message handler error:', error);
    }

  });

};

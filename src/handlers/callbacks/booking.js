const BookingService = require('../../services/bookingService');
const { getDatePickerKeyboard } = require('../../utils/datePicker');
const { getRedis } = require('../../config/redis');
const logger = require('../../middleware/logger');

module.exports = (bot) => {

  // Handle text input during booking flow
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands or empty text
    if (!text || text.startsWith('/')) return;

    try {
      const redis = getRedis();
      const sessionRaw = await redis.get(`session:${chatId}`);
      if (!sessionRaw) return;

      const session = JSON.parse(sessionRaw);

      /* ================= NAME INPUT ================= */
      if (session.step === 'awaiting_name') {
        const result = await BookingService.processName(chatId, text, session);

        if (result.success) {
          await bot.sendMessage(chatId, result.message, {
            parse_mode: 'Markdown',
            reply_markup: {
              force_reply: true,
              selective: true
            }
          });
        } else {
          await bot.sendMessage(chatId, result.message);
        }
      }

      /* ================= PHONE INPUT ================= */
      else if (session.step === 'awaiting_phone') {

        // Basic phone validation
        if (!text.match(/^[0-9+\-\s()]{7,}$/)) {
          return bot.sendMessage(chatId, '❌ Please enter a valid phone number:');
        }

        const result = await BookingService.processPhone(chatId, text, session);

        if (result.success) {
          const now = new Date();

          await bot.sendMessage(chatId, result.message, {
            parse_mode: 'Markdown',
            reply_markup: getDatePickerKeyboard(
              now.getFullYear(),
              now.getMonth()
            ).reply_markup
          });

        } else {
          await bot.sendMessage(chatId, result.message);
        }
      }

    } catch (error) {
      logger.error('Booking message handler error:', error);
      bot.sendMessage(chatId, '❌ Error processing your request. Please try again.');
    }
  });

};

const BookingService = require('../../services/bookingService');
const { getRedis } = require('../../config/redis');
const logger = require('../../middleware/logger');

// ===== NEW: Import our professional date picker =====
const datePicker = require('./datePicker');

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

    try {

      /* ================= BOOK NOW ================= */
      if (data.startsWith('book_')) {
        const apartmentId = data.replace('book_', '');

        // Store apartment ID in session
        const session = {
          apartmentId,
          step: 'awaiting_dates'
        };
        await saveSession(session);

        // ===== USE OUR NEW DATE PICKER =====
        await datePicker.startDatePicker(bot, chatId, { apartmentId });

        // Delete the original message with "Book Now" button
        await bot.deleteMessage(chatId, messageId).catch(() => {});
        
        await bot.answerCallbackQuery(query.id);
        return;
      }

      /* ================= DATE PICKER CALLBACKS ================= */
      // All date-related callbacks go to our datePicker
      if (data.startsWith('date_') || 
          data === 'month_prev' || 
          data === 'month_next' || 
          data === 'year_prev' || 
          data === 'year_next' || 
          data === 'clear_dates' || 
          data === 'confirm_dates') {
        
        const result = await datePicker.handleCallback(
          bot, 
          query, 
          chatId, 
          messageId, 
          data
        );
        
        if (result.action === 'confirm') {
          // Dates are confirmed! Get the session from datePicker
          const session = await getSession();
          
          // Update session with the confirmed dates
          session.startDate = result.checkIn;
          session.endDate = result.checkOut;
          session.step = 'awaiting_guest_details';
          await saveSession(session);
          
          // Now ask for guest details
          await bot.sendMessage(
            chatId,
            `📝 *Enter Your Full Name:*\n\n` +
            `Please type your full name to continue with the booking.`,
            {
              parse_mode: 'Markdown',
              reply_markup: { force_reply: true }
            }
          );
        }
        else if (result.action === 'cancel') {
          // User cancelled - clean up session
          await redis.del(`session:${chatId}`);
          
          await bot.sendMessage(chatId, result.message, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🏠 Browse Apartments', callback_data: 'browse_apartments' }],
                [{ text: '🔍 Search Again', callback_data: 'search_again' }]
              ]
            }
          });
        }
        
        return;
      }

      /* ================= CONFIRM BOOKING ================= */
      if (data === 'confirm_booking') {
        const session = await getSession();
        if (!session) return;

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

        return bot.answerCallbackQuery(query.id, { text: 'Booking confirmed' });
      }

      /* ================= CANCEL ================= */
      if (data === 'cancel_booking') {
        await redis.del(`session:${chatId}`);

        await bot.editMessageText('❌ Booking cancelled.', {
          chat_id: chatId,
          message_id: messageId
        });

        return bot.answerCallbackQuery(query.id);
      }

    } catch (err) {
      logger.error('BOOKING CALLBACK ERROR:', err);
      bot.answerCallbackQuery(query.id, { text: 'Error occurred' });
    }
  });

};

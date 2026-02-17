// ============================================
// MAIN BOOKING CALLBACK HANDLER
// Location: /handlers/callbacks/bookings.js
// ============================================

const BookingService = require('../../services/bookingService');
const { getRedis } = require('../../config/redis');
const logger = require('../../middleware/logger');
const datePicker = require('./datePicker');

module.exports = (bot) => {

  bot.on('callback_query', async (query) => {
    if (!query.message) return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;

    const redis = getRedis();

    const getSession = async () => {
      const raw = await redis.get(`booking:${chatId}`);
      return raw ? JSON.parse(raw) : null;
    };

    const saveSession = async (session) => {
      await redis.setex(`booking:${chatId}`, 3600, JSON.stringify(session));
    };

    try {

      // ===== CLEAR SESSION WHEN NAVIGATING AWAY FROM BOOKING =====
      if (data === 'browse_apartments' || 
          data === 'main_menu' || 
          data === 'view_locations' ||
          data === 'search_again' ||
          data === 'my_bookings' ||
          data === 'contact_support') {
        
        // Clear any existing booking session
        await redis.del(`booking:${chatId}`);
        
        // Let the main bot handler process this callback
        // We don't return here because other handlers need to process it
      }

      if (data.startsWith('book_')) {
        const apartmentId = data.replace('book_', '');

        const session = {
          apartmentId,
          step: 'awaiting_name',
          userName: null,
          userPhone: null
        };
        await saveSession(session);

        await bot.deleteMessage(chatId, messageId).catch(() => {});

        await bot.sendMessage(
          chatId,
          '📝 *Step 1 of 2: Your Full Name*\n\n' +
          'Please enter your full name (first and last name):',
          {
            parse_mode: 'Markdown',
            reply_markup: { force_reply: true }
          }
        );

        await bot.answerCallbackQuery(query.id);
        return;
      }

      if (data === 'show_date_picker') {
        const session = await getSession();
        if (!session) return;

        session.step = 'selecting_dates';
        await saveSession(session);

        await bot.deleteMessage(chatId, messageId).catch(() => {});

        await datePicker.startDatePicker(bot, chatId, {
          apartmentId: session.apartmentId,
          userName: session.userName,
          userPhone: session.userPhone
        });

        await bot.answerCallbackQuery(query.id);
        return;
      }

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
        
        if (result && result.action === 'confirm') {
          const session = await getSession();
          if (!session) return;
          
          const bookingResult = await BookingService.processCompleteBooking({
            chatId,
            apartmentId: session.apartmentId,
            userName: session.userName,
            userPhone: session.userPhone,
            checkIn: result.checkIn,
            checkOut: result.checkOut,
            nights: result.nights
          });
          
          // Clear session after successful booking
          await redis.del(`booking:${chatId}`);
          
          await bot.sendMessage(
            chatId,
            bookingResult.message,
            {
              parse_mode: 'Markdown',
              reply_markup: bookingResult.keyboard
            }
          );
        }
        else if (result && result.action === 'cancel') {
          // Clear session on cancel
          await redis.del(`booking:${chatId}`);
          
          await bot.sendMessage(chatId, result.message, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🏠 Browse Apartments', callback_data: 'browse_apartments' }],
                [{ text: '🔍 Main Menu', callback_data: 'main_menu' }]
              ]
            }
          });
        }
        
        return;
      }

      if (data === 'cancel_booking') {
        // Clear session on cancel
        await redis.del(`booking:${chatId}`);
        
        await bot.editMessageText(
          '❌ *Booking Cancelled*',
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }],
                [{ text: '📋 Browse Apartments', callback_data: 'browse_apartments' }]
              ]
            }
          }
        );

        await bot.answerCallbackQuery(query.id);
        return;
      }

    } catch (err) {
      logger.error('BOOKING CALLBACK ERROR:', err);
      await bot.answerCallbackQuery(query.id, { text: 'Error occurred' });
    }
  });
};

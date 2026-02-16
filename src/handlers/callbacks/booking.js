const BookingService = require('../../services/bookingService');
const { getDateRangePickerKeyboard } = require('../../utils/datePicker');
const { getRedis } = require('../../config/redis');
const logger = require('../../middleware/logger');

module.exports = (bot) => {
  // Handle all booking-related callbacks
  bot.on('callback_query', async (cb) => {
    const chatId = cb.message.chat.id;
    const data = cb.data;
    const messageId = cb.message.message_id;
    
    console.log('📅 [BOOKING CALLBACK] Received:', data);
    
    // Handle date selections
    if (data.startsWith('date_')) {
      const selectedDate = data.replace('date_', '');
      console.log('📅 Date selected:', selectedDate);
      
      try {
        const redis = getRedis();
        const sessionData = await redis.get(`session:${chatId}`);
        
        if (!sessionData) {
          await bot.answerCallbackQuery(cb.id, { text: 'Session expired. Please start over.' });
          await bot.editMessageText('❌ Session expired. Please start over.', {
            chat_id: chatId,
            message_id: messageId
          });
          return;
        }
        
        const session = JSON.parse(sessionData);
        console.log('📅 Current step:', session.step);
        
        if (session.step === 'awaiting_start_date') {
          // Save start date and move to end date selection
          session.startDate = selectedDate;
          session.step = 'awaiting_end_date';
          
          await redis.setex(`session:${chatId}`, 3600, JSON.stringify(session));
          
          // Show calendar for end date with start date highlighted
          await bot.editMessageText('📅 *Select your check-out date:*\n(Your check-in date is highlighted in blue 🔵)', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: getDateRangePickerKeyboard('end', selectedDate).reply_markup
          });
          
          await bot.answerCallbackQuery(cb.id, { text: `Check-in: ${selectedDate}` });
          
        } else if (session.step === 'awaiting_end_date') {
          // Check if end date is after start date
          const start = new Date(session.startDate);
          const end = new Date(selectedDate);
          
          if (end <= start) {
            await bot.answerCallbackQuery(cb.id, { text: 'End date must be after start date!' });
            return;
          }
          
          // Save end date and complete booking
          const result = await BookingService.processEndDate(chatId, selectedDate, session);
          
          await bot.editMessageText(result.message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
          });
          
          await bot.answerCallbackQuery(cb.id, { text: 'Booking confirmed!' });
        }
        
      } catch (error) {
        logger.error('Error in date selection:', error);
        await bot.answerCallbackQuery(cb.id, { text: 'Error processing date' });
      }
    }
    
    // Handle month navigation
    else if (data.startsWith('month_')) {
      const parts = data.split('_');
      const year = parseInt(parts[1]);
      const month = parseInt(parts[2]);
      
      console.log('📅 Month navigation:', { year, month });
      
      try {
        const redis = getRedis();
        const sessionData = await redis.get(`session:${chatId}`);
        
        if (!sessionData) {
          await bot.answerCallbackQuery(cb.id);
          return;
        }
        
        const session = JSON.parse(sessionData);
        
        // Generate new keyboard for the selected month
        const { getDatePickerKeyboard } = require('../../utils/datePicker');
        let newKeyboard;
        
        if (session.step === 'awaiting_start_date') {
          newKeyboard = getDatePickerKeyboard(year, month);
        } else {
          // For end date selection, highlight the start date
          newKeyboard = getDatePickerKeyboard(year, month, null, session.startDate);
        }
        
        await bot.editMessageReplyMarkup(chatId, messageId, newKeyboard.reply_markup);
        await bot.answerCallbackQuery(cb.id);
        
      } catch (error) {
        logger.error('Error in month navigation:', error);
        await bot.answerCallbackQuery(cb.id);
      }
    }
    
    // Handle year navigation
    else if (data.startsWith('year_prev') || data.startsWith('year_next')) {
      const parts = data.split('_');
      const direction = parts[1]; // 'prev' or 'next'
      const currentYear = parseInt(parts[2]);
      const currentMonth = parseInt(parts[3]);
      
      let newYear = direction === 'prev' ? currentYear - 1 : currentYear + 1;
      
      console.log('📅 Year navigation:', { direction, newYear, month: currentMonth });
      
      try {
        const redis = getRedis();
        const sessionData = await redis.get(`session:${chatId}`);
        
        if (!sessionData) {
          await bot.answerCallbackQuery(cb.id);
          return;
        }
        
        const session = JSON.parse(sessionData);
        
        // Generate new keyboard for the selected year/month
        const { getDatePickerKeyboard } = require('../../utils/datePicker');
        let newKeyboard;
        
        if (session.step === 'awaiting_start_date') {
          newKeyboard = getDatePickerKeyboard(newYear, currentMonth);
        } else {
          newKeyboard = getDatePickerKeyboard(newYear, currentMonth, null, session.startDate);
        }
        
        await bot.editMessageReplyMarkup(chatId, messageId, newKeyboard.reply_markup);
        await bot.answerCallbackQuery(cb.id);
        
      } catch (error) {
        logger.error('Error in year navigation:', error);
        await bot.answerCallbackQuery(cb.id);
      }
    }
    
    // Handle proceed to end date
    else if (data === 'proceed_to_end') {
      try {
        const redis = getRedis();
        const sessionData = await redis.get(`session:${chatId}`);
        
        if (!sessionData) {
          await bot.answerCallbackQuery(cb.id, { text: 'Session expired' });
          return;
        }
        
        const session = JSON.parse(sessionData);
        
        if (session.startDate) {
          await bot.editMessageText('📅 *Select your check-out date:*\n(Your check-in date is highlighted in blue 🔵)', {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: getDateRangePickerKeyboard('end', session.startDate).reply_markup
          });
        }
        
        await bot.answerCallbackQuery(cb.id);
        
      } catch (error) {
        logger.error('Error in proceed to end:', error);
        await bot.answerCallbackQuery(cb.id);
      }
    }
    
    // Handle confirm date (legacy)
    else if (data === 'confirm_date') {
      await bot.answerCallbackQuery(cb.id, { text: 'Please select a date first' });
    }
    
    // Handle confirm booking
    else if (data === 'confirm_booking') {
      try {
        const redis = getRedis();
        const sessionData = await redis.get(`session:${chatId}`);
        
        if (!sessionData) {
          await bot.answerCallbackQuery(cb.id, { text: 'Session expired' });
          return;
        }
        
        const session = JSON.parse(sessionData);
        
        if (session.startDate && session.endDate) {
          const result = await BookingService.processEndDate(chatId, session.endDate, session);
          
          await bot.editMessageText(result.message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
          });
          
          await bot.answerCallbackQuery(cb.id, { text: 'Booking confirmed!' });
        } else {
          await bot.answerCallbackQuery(cb.id, { text: 'Please select both dates' });
        }
        
      } catch (error) {
        logger.error('Error confirming booking:', error);
        await bot.answerCallbackQuery(cb.id, { text: 'Error' });
      }
    }
    
    // Handle cancel booking
    else if (data === 'cancel_booking') {
      try {
        const redis = getRedis();
        await redis.del(`session:${chatId}`);
        
        await bot.editMessageText('❌ Booking cancelled.', {
          chat_id: chatId,
          message_id: messageId
        });
        
        await bot.answerCallbackQuery(cb.id, { text: 'Booking cancelled' });
      } catch (error) {
        logger.error('Error cancelling booking:', error);
      }
    }
    
    // Handle original book button
    else if (data.startsWith('book_')) {
      const apartmentId = data.replace('book_', '');
      
      await bot.answerCallbackQuery(cb.id, { text: 'Starting booking...' });
      
      try {
        const result = await BookingService.startBooking(chatId, apartmentId, cb.message);
        
        if (result.success) {
          const redis = getRedis();
          await redis.setex(`session:${chatId}`, 3600, JSON.stringify(result.session));
          
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
        
      } catch (error) {
        logger.error('Error in book callback:', error);
        await bot.sendMessage(chatId, '❌ Error starting booking process.');
      }
    }
  });
};

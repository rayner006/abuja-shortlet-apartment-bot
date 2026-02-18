// src/controllers/bookingController.js
const { Booking, Apartment, User } = require('../models');
const { Op } = require('sequelize');
const { generateBookingReference, calculateNights, formatCurrency, formatDate } = require('../utils/helpers');
const { createBookingKeyboard, createConfirmationKeyboard } = require('../utils/keyboards');
const logger = require('../config/logger');
const redis = require('../config/redis');

// Booking states
const bookingState = {};

const handleBookingStart = async (bot, callbackQuery, apartmentId) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  
  try {
    // Check if user exists
    const user = await User.findOne({ where: { telegramId: userId } });
    
    if (!user) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Please start the bot first with /start'
      });
      return;
    }
    
    const apartment = await Apartment.findByPk(apartmentId);
    
    if (!apartment) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Apartment not found'
      });
      return;
    }
    
    if (!apartment.isAvailable) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'This apartment is currently unavailable'
      });
      return;
    }
    
    // Initialize booking state
    bookingState[chatId] = {
      step: 'dates',
      apartmentId: apartmentId,
      data: {}
    };
    
    await bot.sendMessage(chatId, 
      `📅 *Booking: ${apartment.title}*\n\n` +
      `Please enter your check-in and check-out dates.\n\n` +
      `Format: *YYYY-MM-DD to YYYY-MM-DD*\n` +
      `Example: *2024-12-01 to 2024-12-05*`,
      { parse_mode: 'Markdown' }
    );
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('Booking start error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error starting booking' });
  }
};

const processBookingDates = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (!bookingState[chatId] || bookingState[chatId].step !== 'dates') {
    return;
  }
  
  try {
    // Parse dates
    const datePattern = /(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/i;
    const match = text.match(datePattern);
    
    if (!match) {
      await bot.sendMessage(chatId,
        'Invalid date format. Please use: *YYYY-MM-DD to YYYY-MM-DD*\n' +
        'Example: *2024-12-01 to 2024-12-05*',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    const checkIn = new Date(match[1]);
    const checkOut = new Date(match[2]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Validation
    if (checkIn < today) {
      await bot.sendMessage(chatId, 'Check-in date cannot be in the past.');
      return;
    }
    
    if (checkOut <= checkIn) {
      await bot.sendMessage(chatId, 'Check-out date must be after check-in date.');
      return;
    }
    
    const nights = calculateNights(checkIn, checkOut);
    
    if (nights > 30) {
      await bot.sendMessage(chatId, 'Maximum booking duration is 30 nights.');
      return;
    }
    
    // Check availability
    const apartment = await Apartment.findByPk(bookingState[chatId].apartmentId);
    const existingBookings = await Booking.findAll({
      where: {
        apartmentId: apartment.id,
        status: { [Op.in]: ['pending', 'confirmed'] },
        [Op.or]: [
          {
            checkIn: { [Op.between]: [checkIn, checkOut] }
          },
          {
            checkOut: { [Op.between]: [checkIn, checkOut] }
          },
          {
            [Op.and]: [
              { checkIn: { [Op.lte]: checkIn } },
              { checkOut: { [Op.gte]: checkOut } }
            ]
          }
        ]
      }
    });
    
    if (existingBookings.length > 0) {
      await bot.sendMessage(chatId, 
        '❌ Sorry, these dates are not available.\n\n' +
        'Please choose different dates.'
      );
      return;
    }
    
    // Store dates
    bookingState[chatId].data.checkIn = match[1];
    bookingState[chatId].data.checkOut = match[2];
    bookingState[chatId].data.nights = nights;
    bookingState[chatId].step = 'guests';
    
    await bot.sendMessage(chatId,
      `📅 Dates selected: ${formatDate(checkIn)} to ${formatDate(checkOut)}\n` +
      `📊 Total nights: ${nights}\n\n` +
      `👥 How many guests will be staying? (Max ${apartment.maxGuests})`
    );
    
  } catch (error) {
    logger.error('Process booking dates error:', error);
    bot.sendMessage(chatId, 'Error processing dates. Please try again.');
  }
};

const processBookingGuests = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (!bookingState[chatId] || bookingState[chatId].step !== 'guests') {
    return;
  }
  
  try {
    const guests = parseInt(text);
    const apartment = await Apartment.findByPk(bookingState[chatId].apartmentId);
    
    if (isNaN(guests) || guests < 1) {
      await bot.sendMessage(chatId, 'Please enter a valid number of guests.');
      return;
    }
    
    if (guests > apartment.maxGuests) {
      await bot.sendMessage(chatId, 
        `This apartment can only accommodate up to ${apartment.maxGuests} guests.`
      );
      return;
    }
    
    bookingState[chatId].data.guests = guests;
    bookingState[chatId].step = 'confirm';
    
    // Calculate total price
    const totalPrice = apartment.pricePerNight * bookingState[chatId].data.nights;
    
    const confirmText = `
📝 *Confirm Your Booking*

🏠 *Apartment:* ${apartment.title}
📍 *Location:* ${apartment.location}
👥 *Guests:* ${guests}
📅 *Check-in:* ${formatDate(bookingState[chatId].data.checkIn)}
📅 *Check-out:* ${formatDate(bookingState[chatId].data.checkOut)}
📊 *Nights:* ${bookingState[chatId].data.nights}

💰 *Price Breakdown:*
${formatCurrency(apartment.pricePerNight)} x ${bookingState[chatId].data.nights} nights = ${formatCurrency(totalPrice)}

*Total: ${formatCurrency(totalPrice)}*

Do you want to proceed with this booking?
    `;
    
    const keyboard = createConfirmationKeyboard('booking', bookingState[chatId].apartmentId);
    
    await bot.sendMessage(chatId, confirmText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
  } catch (error) {
    logger.error('Process booking guests error:', error);
    bot.sendMessage(chatId, 'Error processing guests. Please try again.');
  }
};

const confirmBooking = async (bot, callbackQuery, apartmentId) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  
  try {
    const user = await User.findOne({ where: { telegramId: userId } });
    const apartment = await Apartment.findByPk(apartmentId);
    
    if (!user || !apartment) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error processing booking' });
      return;
    }
    
    const bookingData = bookingState[chatId]?.data;
    
    if (!bookingData) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Booking session expired' });
      return;
    }
    
    // Calculate total price
    const totalPrice = apartment.pricePerNight * bookingData.nights;
    
    // Create booking
    const booking = await Booking.create({
      bookingReference: generateBookingReference(),
      apartmentId: apartment.id,
      userId: user.id,
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      guests: bookingData.guests,
      totalPrice: totalPrice,
      status: 'pending',
      paymentStatus: 'pending'
    });
    
    // Clear booking state
    delete bookingState[chatId];
    
    // Send confirmation
    const confirmationText = `
✅ *Booking Confirmed!*

📋 *Booking Reference:* \`${booking.bookingReference}\`

🏠 *Apartment:* ${apartment.title}
📅 *Check-in:* ${formatDate(booking.checkIn)}
📅 *Check-out:* ${formatDate(booking.checkOut)}
👥 *Guests:* ${booking.guests}
💰 *Total Amount:* ${formatCurrency(booking.totalPrice)}
📊 *Status:* Pending Confirmation

You will receive a confirmation once the owner accepts your booking.

Thank you for choosing Abuja Shortlet Apartments! 🏢
    `;
    
    await bot.sendMessage(chatId, confirmationText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📅 View My Bookings', callback_data: 'menu_bookings' }],
          [{ text: '🔍 Search More', callback_data: 'menu_search' }]
        ]
      }
    });
    
    // Notify apartment owner
    const owner = await User.findByPk(apartment.ownerId);
    if (owner && owner.telegramId) {
      const ownerNotification = `
🔔 *New Booking Request!*

🏠 *Apartment:* ${apartment.title}
👤 *Guest:* ${user.firstName} (@${user.username || 'N/A'})
📅 *Check-in:* ${formatDate(booking.checkIn)}
📅 *Check-out:* ${formatDate(booking.checkOut)}
👥 *Guests:* ${booking.guests}
💰 *Total:* ${formatCurrency(booking.totalPrice)}
📋 *Reference:* \`${booking.bookingReference}\`

Please respond to this booking request.
      `;
      
      await bot.sendMessage(owner.telegramId, ownerNotification, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Accept', callback_data: `accept_booking_${booking.id}` },
              { text: '❌ Decline', callback_data: `decline_booking_${booking.id}` }
            ],
            [{ text: '📞 Contact Guest', callback_data: `contact_guest_${user.id}` }]
          ]
        }
      });
    }
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Booking confirmed! Check your bookings for details.'
    });
    
  } catch (error) {
    logger.error('Confirm booking error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error confirming booking' });
  }
};

const handleMyBookings = async (bot, msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  try {
    const user = await User.findOne({ where: { telegramId: userId } });
    
    if (!user) {
      await bot.sendMessage(chatId, 'Please start the bot first with /start');
      return;
    }
    
    const bookings = await Booking.findAll({
      where: { userId: user.id },
      include: [{
        model: Apartment,
        attributes: ['id', 'title', 'location', 'images']
      }],
      order: [['created_at', 'DESC']]
    });
    
    if (bookings.length === 0) {
      await bot.sendMessage(chatId, 
        'You have no bookings yet.\n\n' +
        'Use /search to find your perfect apartment!'
      );
      return;
    }
    
    await bot.sendMessage(chatId, `📅 You have ${bookings.length} booking(s):`);
    
    for (const booking of bookings) {
      const statusEmoji = {
        'pending': '⏳',
        'confirmed': '✅',
        'cancelled': '❌',
        'completed': '🏁'
      }[booking.status] || '❓';
      
      const paymentEmoji = {
        'pending': '⏳',
        'paid': '💰',
        'refunded': '↩️'
      }[booking.paymentStatus] || '❓';
      
      const text = `
${statusEmoji} *Booking #${booking.bookingReference}*

🏠 *Apartment:* ${booking.Apartment.title}
📍 *Location:* ${booking.Apartment.location}
📅 *Check-in:* ${formatDate(booking.checkIn)}
📅 *Check-out:* ${formatDate(booking.checkOut)}
👥 *Guests:* ${booking.guests}
💰 *Total:* ${formatCurrency(booking.totalPrice)}
📊 *Status:* ${booking.status.toUpperCase()} ${paymentEmoji} Payment: ${booking.paymentStatus}
📅 *Booked on:* ${formatDate(booking.createdAt)}
      `;
      
      const keyboard = createBookingKeyboard(booking.id, booking.status);
      
      if (booking.Apartment.images && booking.Apartment.images.length > 0) {
        await bot.sendPhoto(chatId, booking.Apartment.images[0], {
          caption: text,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      } else {
        await bot.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }
    }
    
  } catch (error) {
    logger.error('My bookings error:', error);
    bot.sendMessage(chatId, 'Error fetching bookings. Please try again.');
  }
};

const cancelBooking = async (bot, callbackQuery, bookingId) => {
  const chatId = callbackQuery.message.chat.id;
  
  try {
    const booking = await Booking.findByPk(bookingId, {
      include: [Apartment]
    });
    
    if (!booking) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Booking not found' });
      return;
    }
    
    if (booking.status !== 'pending') {
      await bot.answerCallbackQuery(callbackQuery.id, { 
        text: `Cannot cancel booking with status: ${booking.status}` 
      });
      return;
    }
    
    booking.status = 'cancelled';
    await booking.save();
    
    await bot.editMessageCaption(
      `❌ *Booking Cancelled*\n\n` +
      `Booking reference: ${booking.bookingReference}\n` +
      `Apartment: ${booking.Apartment.title}\n` +
      `Dates: ${formatDate(booking.checkIn)} to ${formatDate(booking.checkOut)}`,
      {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📅 View My Bookings', callback_data: 'menu_bookings' }]
          ]
        }
      }
    );
    
    // Notify owner
    const owner = await User.findByPk(booking.Apartment.ownerId);
    if (owner && owner.telegramId) {
      await bot.sendMessage(owner.telegramId,
        `❌ *Booking Cancelled by Guest*\n\n` +
        `Booking Reference: ${booking.bookingReference}\n` +
        `Apartment: ${booking.Apartment.title}\n` +
        `Dates: ${formatDate(booking.checkIn)} to ${formatDate(booking.checkOut)}`,
        { parse_mode: 'Markdown' }
      );
    }
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Booking cancelled successfully'
    });
    
  } catch (error) {
    logger.error('Cancel booking error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error cancelling booking' });
  }
};

module.exports = {
  handleBookingStart,
  processBookingDates,
  processBookingGuests,
  confirmBooking,
  handleMyBookings,
  cancelBooking,
  bookingState
};

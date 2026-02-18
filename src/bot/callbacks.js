// src/bot/callbacks.js
const logger = require('../config/logger');
const { 
  handleApartmentDetails, 
  handleAmenities 
} = require('../controllers/apartmentController');
const { 
  handleBookingStart, 
  confirmBooking, 
  cancelBooking,
  handleMyBookings 
} = require('../controllers/bookingController');
const { 
  handleAdminPanel,
  handlePendingApprovals,
  approveApartment,
  rejectApartment,
  handleAdminStats,
  handleUserManagement,
  handleAllApartments
} = require('../controllers/adminController');
const { handleMenu } = require('../controllers/userController');

const handleCallback = async (bot, callbackQuery) => {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  
  try {
    logger.info(`Callback received: ${data} from user ${callbackQuery.from.id}`);
    
    // Menu callbacks
    if (data === 'menu_search') {
      await bot.sendMessage(chatId, '🔍 Use /search to find apartments');
      await bot.answerCallbackQuery(callbackQuery.id);
    }
    else if (data === 'menu_bookings') {
      await handleMyBookings(bot, { 
        chat: { id: chatId }, 
        from: callbackQuery.from 
      });
      await bot.answerCallbackQuery(callbackQuery.id);
    }
    else if (data === 'menu_my_apartments') {
      await bot.sendMessage(chatId, '🏠 Use /my_apartments to view your listings');
      await bot.answerCallbackQuery(callbackQuery.id);
    }
    else if (data === 'menu_add_apartment') {
      await bot.sendMessage(chatId, '➕ Use /add_apartment to list a new property');
      await bot.answerCallbackQuery(callbackQuery.id);
    }
    else if (data === 'menu_owner_dashboard') {
      await bot.sendMessage(chatId, '📊 Owner dashboard coming soon!');
      await bot.answerCallbackQuery(callbackQuery.id);
    }
    else if (data === 'menu_admin') {
      await handleAdminPanel(bot, { 
        chat: { id: chatId }, 
        from: callbackQuery.from,
        message: { message_id: messageId }
      });
    }
    else if (data === 'menu_help') {
      await bot.sendMessage(chatId, 
        '❓ *Help*\n\n' +
        'For assistance, please contact support.\n' +
        'Email: support@abujashortlet.com\n' +
        'Phone: +234 XXX XXX XXXX',
        { parse_mode: 'Markdown' }
      );
      await bot.answerCallbackQuery(callbackQuery.id);
    }
    else if (data === 'back_to_main') {
      await handleMenu(bot, { 
        chat: { id: chatId }, 
        from: callbackQuery.from 
      });
      await bot.answerCallbackQuery(callbackQuery.id);
    }
    
    // Apartment view callbacks
    else if (data.startsWith('view_')) {
      const apartmentId = data.split('_')[1];
      await handleApartmentDetails(bot, callbackQuery, apartmentId);
    }
    else if (data.startsWith('amenities_')) {
      const apartmentId = data.split('_')[1];
      await handleAmenities(bot, callbackQuery, apartmentId);
    }
    else if (data.startsWith('photos_')) {
      const apartmentId = data.split('_')[1];
      await handleApartmentPhotos(bot, callbackQuery, apartmentId);
    }
    else if (data.startsWith('location_')) {
      const apartmentId = data.split('_')[1];
      await handleApartmentLocation(bot, callbackQuery, apartmentId);
    }
    
    // Booking callbacks
    else if (data.startsWith('book_')) {
      const apartmentId = data.split('_')[1];
      await handleBookingStart(bot, callbackQuery, apartmentId);
    }
    else if (data.startsWith('confirm_booking_')) {
      const apartmentId = data.split('_')[2];
      await confirmBooking(bot, callbackQuery, apartmentId);
    }
    else if (data.startsWith('cancel_booking_')) {
      const bookingId = data.split('_')[2];
      await cancelBooking(bot, callbackQuery, bookingId);
    }
    
    // Admin callbacks
    else if (data === 'admin_pending') {
      await handlePendingApprovals(bot, callbackQuery, 1);
    }
    else if (data.startsWith('admin_pending_')) {
      const page = parseInt(data.split('_')[2]);
      await handlePendingApprovals(bot, callbackQuery, page);
    }
    else if (data.startsWith('approve_')) {
      const apartmentId = data.split('_')[1];
      await approveApartment(bot, callbackQuery, apartmentId);
    }
    else if (data.startsWith('reject_')) {
      const apartmentId = data.split('_')[1];
      await rejectApartment(bot, callbackQuery, apartmentId);
    }
    else if (data === 'admin_stats') {
      await handleAdminStats(bot, callbackQuery);
    }
    else if (data === 'admin_users') {
      await handleUserManagement(bot, callbackQuery, 1);
    }
    else if (data.startsWith('admin_users_')) {
      const page = parseInt(data.split('_')[2]);
      await handleUserManagement(bot, callbackQuery, page);
    }
    else if (data === 'admin_apartments') {
      await handleAllApartments(bot, callbackQuery, 1);
    }
    else if (data.startsWith('admin_apartments_')) {
      const page = parseInt(data.split('_')[2]);
      await handleAllApartments(bot, callbackQuery, page);
    }
    
    // Owner apartment management
    else if (data.startsWith('edit_')) {
      const apartmentId = data.split('_')[1];
      await handleEditApartment(bot, callbackQuery, apartmentId);
    }
    else if (data.startsWith('toggle_')) {
      const apartmentId = data.split('_')[1];
      await handleToggleAvailability(bot, callbackQuery, apartmentId);
    }
    else if (data.startsWith('apartment_bookings_')) {
      const apartmentId = data.split('_')[2];
      await handleApartmentBookings(bot, callbackQuery, apartmentId);
    }
    else if (data.startsWith('apartment_stats_')) {
      const apartmentId = data.split('_')[2];
      await handleApartmentStats(bot, callbackQuery, apartmentId);
    }
    else if (data.startsWith('update_photos_')) {
      const apartmentId = data.split('_')[2];
      await handleUpdatePhotos(bot, callbackQuery, apartmentId);
    }
    else if (data === 'back_to_my_apartments') {
      await bot.sendMessage(chatId, '🏠 Use /my_apartments to view your listings');
      await bot.answerCallbackQuery(callbackQuery.id);
    }
    
    // Owner booking management
    else if (data.startsWith('accept_booking_')) {
      const bookingId = data.split('_')[2];
      await handleAcceptBooking(bot, callbackQuery, bookingId);
    }
    else if (data.startsWith('decline_booking_')) {
      const bookingId = data.split('_')[2];
      await handleDeclineBooking(bot, callbackQuery, bookingId);
    }
    else if (data.startsWith('contact_guest_')) {
      const userId = data.split('_')[2];
      await handleContactGuest(bot, callbackQuery, userId);
    }
    
    // Search navigation
    else if (data === 'back_to_search') {
      await bot.sendMessage(chatId, '🔍 Use /search to start a new search');
      await bot.answerCallbackQuery(callbackQuery.id);
    }
    
    // Noop (do nothing)
    else if (data === 'noop') {
      await bot.answerCallbackQuery(callbackQuery.id);
    }
    
    // Unknown callback
    else {
      logger.warn(`Unknown callback data: ${data}`);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Unknown command'
      });
    }
    
  } catch (error) {
    logger.error('Callback handler error:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'An error occurred'
    });
  }
};

// Additional helper functions for owner management
const handleApartmentPhotos = async (bot, callbackQuery, apartmentId) => {
  const chatId = callbackQuery.message.chat.id;
  
  try {
    const { Apartment } = require('../models');
    const apartment = await Apartment.findByPk(apartmentId);
    
    if (!apartment || !apartment.images || apartment.images.length === 0) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'No photos available for this apartment'
      });
      return;
    }
    
    const media = apartment.images.map(img => ({
      type: 'photo',
      media: img
    }));
    
    await bot.sendMediaGroup(chatId, media);
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('Apartment photos error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error loading photos' });
  }
};

const handleApartmentLocation = async (bot, callbackQuery, apartmentId) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  
  try {
    const { Apartment } = require('../models');
    const apartment = await Apartment.findByPk(apartmentId);
    
    if (!apartment) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Apartment not found' });
      return;
    }
    
    const locationText = `
📍 *Location Details*

🏠 *${apartment.title}*
📍 *Area:* ${apartment.location}
📫 *Full Address:* ${apartment.address || 'Not provided'}

📍 *Nearby Places:*
• Coming soon...

📍 *Map Location:*
https://maps.google.com/?q=${encodeURIComponent(apartment.address || apartment.location)}
    `;
    
    await bot.editMessageCaption(locationText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Back to Apartment', callback_data: `view_${apartmentId}` }]
        ]
      }
    });
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('Apartment location error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error loading location' });
  }
};

const handleEditApartment = async (bot, callbackQuery, apartmentId) => {
  const chatId = callbackQuery.message.chat.id;
  
  await bot.sendMessage(chatId, 
    '✏️ *Edit Apartment*\n\n' +
    'This feature is coming soon! You will be able to:\n' +
    '• Update title and description\n' +
    '• Change price\n' +
    '• Modify amenities\n' +
    '• Update photos\n\n' +
    'For now, please use /my_apartments to manage your listings.',
    { parse_mode: 'Markdown' }
  );
  
  await bot.answerCallbackQuery(callbackQuery.id);
};

const handleToggleAvailability = async (bot, callbackQuery, apartmentId) => {
  const chatId = callbackQuery.message.chat.id;
  
  try {
    const { Apartment } = require('../models');
    const apartment = await Apartment.findByPk(apartmentId);
    
    if (!apartment) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Apartment not found' });
      return;
    }
    
    apartment.isAvailable = !apartment.isAvailable;
    await apartment.save();
    
    const status = apartment.isAvailable ? '🟢 Available' : '🔴 Unavailable';
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: `Apartment is now ${status}`
    });
    
    // Update the message
    const text = callbackQuery.message.caption || callbackQuery.message.text;
    const updatedText = text.replace(/🟢 Available|🔴 Unavailable/g, status);
    
    if (callbackQuery.message.photo) {
      await bot.editMessageCaption(updatedText, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        reply_markup: callbackQuery.message.reply_markup
      });
    } else {
      await bot.editMessageText(updatedText, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        reply_markup: callbackQuery.message.reply_markup
      });
    }
    
  } catch (error) {
    logger.error('Toggle availability error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error updating availability' });
  }
};

const handleApartmentBookings = async (bot, callbackQuery, apartmentId) => {
  const chatId = callbackQuery.message.chat.id;
  
  try {
    const { Booking, Apartment } = require('../models');
    const apartment = await Apartment.findByPk(apartmentId);
    const bookings = await Booking.findAll({
      where: { apartmentId },
      include: [{
        model: require('../models/User'),
        attributes: ['id', 'firstName', 'username', 'phone']
      }],
      order: [['created_at', 'DESC']],
      limit: 10
    });
    
    if (bookings.length === 0) {
      await bot.sendMessage(chatId, 
        `📊 *No Bookings Yet*\n\nYour apartment "${apartment.title}" hasn't received any bookings.`,
        { parse_mode: 'Markdown' }
      );
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }
    
    let text = `📊 *Bookings for ${apartment.title}*\n\n`;
    
    for (const booking of bookings) {
      const statusEmoji = {
        'pending': '⏳',
        'confirmed': '✅',
        'cancelled': '❌',
        'completed': '🏁'
      }[booking.status];
      
      text += `${statusEmoji} *${booking.bookingReference}*\n`;
      text += `   👤 Guest: ${booking.User?.firstName || 'Unknown'} (@${booking.User?.username || 'N/A'})\n`;
      text += `   📅 ${new Date(booking.checkIn).toLocaleDateString()} - ${new Date(booking.checkOut).toLocaleDateString()}\n`;
      text += `   👥 ${booking.guests} guests | 💰 ${formatCurrency(booking.totalPrice)}\n`;
      text += `   Status: ${booking.status.toUpperCase()}\n\n`;
    }
    
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('Apartment bookings error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error loading bookings' });
  }
};

const handleApartmentStats = async (bot, callbackQuery, apartmentId) => {
  const chatId = callbackQuery.message.chat.id;
  
  try {
    const { Apartment, Booking } = require('../models');
    const apartment = await Apartment.findByPk(apartmentId);
    
    const totalBookings = await Booking.count({ where: { apartmentId } });
    const confirmedBookings = await Booking.count({ where: { apartmentId, status: 'confirmed' } });
    const completedBookings = await Booking.count({ where: { apartmentId, status: 'completed' } });
    const cancelledBookings = await Booking.count({ where: { apartmentId, status: 'cancelled' } });
    
    const revenue = await Booking.sum('totalPrice', {
      where: { apartmentId, paymentStatus: 'paid' }
    });
    
    const statsText = `
📊 *Apartment Statistics*

🏠 *${apartment.title}*

📈 *Performance*
• Total Views: ${apartment.views}
• Total Bookings: ${totalBookings}
• Conversion Rate: ${apartment.views > 0 ? ((totalBookings / apartment.views) * 100).toFixed(1) : 0}%

📅 *Booking Breakdown*
• ✅ Confirmed: ${confirmedBookings}
• 🏁 Completed: ${completedBookings}
• ❌ Cancelled: ${cancelledBookings}

💰 *Revenue*
• Total Revenue: ${formatCurrency(revenue || 0)}
• Average per Booking: ${totalBookings > 0 ? formatCurrency((revenue || 0) / totalBookings) : formatCurrency(0)}

📊 *Status*
• Availability: ${apartment.isAvailable ? '🟢 Available' : '🔴 Unavailable'}
• Approval: ${apartment.isApproved ? '✅ Approved' : '⏳ Pending'}
• Listed since: ${new Date(apartment.createdAt).toLocaleDateString()}
    `;
    
    await bot.sendMessage(chatId, statsText, { parse_mode: 'Markdown' });
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('Apartment stats error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error loading statistics' });
  }
};

const handleUpdatePhotos = async (bot, callbackQuery, apartmentId) => {
  const chatId = callbackQuery.message.chat.id;
  
  await bot.sendMessage(chatId,
    '📸 *Update Photos*\n\n' +
    'To update photos, please use the following steps:\n\n' +
    '1. Delete old photos (coming soon)\n' +
    '2. Send new photos\n' +
    '3. Type /done when finished\n\n' +
    'For now, please contact admin for photo updates.',
    { parse_mode: 'Markdown' }
  );
  
  await bot.answerCallbackQuery(callbackQuery.id);
};

const handleAcceptBooking = async (bot, callbackQuery, bookingId) => {
  const chatId = callbackQuery.message.chat.id;
  
  try {
    const { Booking, Apartment, User } = require('../models');
    const booking = await Booking.findByPk(bookingId, {
      include: [Apartment, User]
    });
    
    if (!booking) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Booking not found' });
      return;
    }
    
    booking.status = 'confirmed';
    await booking.save();
    
    // Notify guest
    if (booking.User && booking.User.telegramId) {
      await bot.sendMessage(booking.User.telegramId,
        `✅ *Booking Confirmed!*\n\n` +
        `Good news! Your booking for *${booking.Apartment.title}* has been confirmed.\n\n` +
        `📋 *Reference:* ${booking.bookingReference}\n` +
        `📅 *Dates:* ${new Date(booking.checkIn).toLocaleDateString()} to ${new Date(booking.checkOut).toLocaleDateString()}\n` +
        `💰 *Total:* ${formatCurrency(booking.totalPrice)}\n\n` +
        `The owner will contact you soon with check-in details.`,
        { parse_mode: 'Markdown' }
      );
    }
    
    await bot.editMessageText(
      `✅ *Booking Accepted*\n\nBooking for ${booking.Apartment.title} has been confirmed.`,
      {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📞 Contact Guest', callback_data: `contact_guest_${booking.userId}` }],
            [{ text: '🔙 Back', callback_data: 'back_to_my_apartments' }]
          ]
        }
      }
    );
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Booking accepted successfully'
    });
    
  } catch (error) {
    logger.error('Accept booking error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error accepting booking' });
  }
};

const handleDeclineBooking = async (bot, callbackQuery, bookingId) => {
  const chatId = callbackQuery.message.chat.id;
  
  try {
    const { Booking, Apartment, User } = require('../models');
    const booking = await Booking.findByPk(bookingId, {
      include: [Apartment, User]
    });
    
    if (!booking) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Booking not found' });
      return;
    }
    
    booking.status = 'cancelled';
    await booking.save();
    
    // Notify guest
    if (booking.User && booking.User.telegramId) {
      await bot.sendMessage(booking.User.telegramId,
        `❌ *Booking Declined*\n\n` +
        `We regret to inform you that your booking for *${booking.Apartment.title}* has been declined.\n\n` +
        `📋 *Reference:* ${booking.bookingReference}\n\n` +
        `Please search for other available apartments using /search`,
        { parse_mode: 'Markdown' }
      );
    }
    
    await bot.editMessageText(
      `❌ *Booking Declined*\n\nBooking for ${booking.Apartment.title} has been declined.`,
      {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back', callback_data: 'back_to_my_apartments' }]
          ]
        }
      }
    );
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Booking declined'
    });
    
  } catch (error) {
    logger.error('Decline booking error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error declining booking' });
  }
};

const handleContactGuest = async (bot, callbackQuery, userId) => {
  const chatId = callbackQuery.message.chat.id;
  
  try {
    const { User } = require('../models');
    const user = await User.findByPk(userId);
    
    if (!user) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'User not found' });
      return;
    }
    
    const contactInfo = `
📞 *Guest Contact Information*

👤 *Name:* ${user.firstName || ''} ${user.lastName || ''}
📱 *Username:* @${user.username || 'N/A'}
📞 *Phone:* ${user.phone || 'Not provided'}

You can contact the guest directly through Telegram.
    `;
    
    await bot.sendMessage(chatId, contactInfo, { parse_mode: 'Markdown' });
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('Contact guest error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error loading contact info' });
  }
};

module.exports = { handleCallback };

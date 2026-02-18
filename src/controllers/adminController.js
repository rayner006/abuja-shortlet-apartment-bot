// src/controllers/adminController.js (COMPLETE FIXED VERSION)
const { User, Apartment, Booking } = require('../models');
const { Op } = require('sequelize');
const { createAdminKeyboard, createPaginationKeyboard } = require('../utils/keyboards');
const { formatCurrency, paginate } = require('../utils/helpers');
const logger = require('../config/logger');

const handleAdminPanel = async (bot, msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Check if user is admin
  const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id)) : [];
  
  if (!adminIds.includes(userId)) {
    await bot.sendMessage(chatId, '⛔ Access denied. This command is for admins only.');
    return;
  }
  
  const adminText = `
⚙️ *Admin Panel*

Welcome to the administration panel. Select an option below:
  `;
  
  await bot.sendMessage(chatId, adminText, {
    parse_mode: 'Markdown',
    reply_markup: createAdminKeyboard()
  });
};

const handlePendingApprovals = async (bot, callbackQuery, page = 1) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  
  try {
    const apartments = await Apartment.findAll({
      where: { isApproved: false },
      include: [{
        model: User,
        attributes: ['id', 'firstName', 'username', 'phone']
      }],
      order: [['created_at', 'ASC']]
    });
    
    if (apartments.length === 0) {
      await bot.editMessageText(
        '✅ No pending approvals at the moment.\n\nAll apartments have been reviewed.',
        {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
            ]
          }
        }
      );
      return;
    }
    
    const paginated = paginate(apartments, page, 1);
    const apt = paginated.results[0];
    
    const amenities = apt.amenities || [];
    const amenitiesText = amenities.length > 0 
      ? amenities.slice(0, 5).map(a => `• ${a}`).join('\n')
      : '• No amenities listed';
    
    const text = `
📋 *Pending Approval (${page}/${paginated.totalPages})*

🏠 *${apt.title}*
👤 *Owner:* ${apt.User?.firstName || 'Unknown'} (@${apt.User?.username || 'N/A'})
📞 *Phone:* ${apt.User?.phone || 'Not provided'}
📍 *Location:* ${apt.location}
💰 *Price:* ${formatCurrency(apt.pricePerNight)}/night
🛏 *Bedrooms:* ${apt.bedrooms} | 🚿 *Bathrooms:* ${apt.bathrooms}
👥 *Max Guests:* ${apt.maxGuests}

📝 *Description:*
${apt.description || 'No description provided.'}

✨ *Amenities:*
${amenitiesText}

📅 *Listed on:* ${new Date(apt.createdAt).toLocaleDateString()}
    `;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Approve', callback_data: `approve_${apt.id}` },
          { text: '❌ Reject', callback_data: `reject_${apt.id}` }
        ],
        [
          { text: '📞 Contact Owner', callback_data: `contact_owner_${apt.ownerId}` }
        ]
      ]
    };
    
    // Add pagination if needed
    if (paginated.totalPages > 1) {
      const paginationButtons = [];
      if (paginated.previous) {
        paginationButtons.push({ text: '◀️ Previous', callback_data: `admin_pending_${page - 1}` });
      }
      paginationButtons.push({ text: `📄 ${page}/${paginated.totalPages}`, callback_data: 'noop' });
      if (paginated.next) {
        paginationButtons.push({ text: 'Next ▶️', callback_data: `admin_pending_${page + 1}` });
      }
      keyboard.inline_keyboard.push(paginationButtons);
    }
    
    keyboard.inline_keyboard.push([{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]);
    
    if (apt.images && apt.images.length > 0) {
      // If message has photo, edit caption, otherwise send new
      if (callbackQuery.message.photo) {
        await bot.editMessageMedia({
          type: 'photo',
          media: apt.images[0],
          caption: text,
          parse_mode: 'Markdown'
        }, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: keyboard
        });
      } else {
        await bot.sendPhoto(chatId, apt.images[0], {
          caption: text,
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }
    } else {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('Pending approvals error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error loading approvals' });
  }
};

const approveApartment = async (bot, callbackQuery, apartmentId) => {
  const chatId = callbackQuery.message.chat.id;
  
  try {
    const apartment = await Apartment.findByPk(apartmentId, {
      include: [User]
    });
    
    if (!apartment) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Apartment not found' });
      return;
    }
    
    apartment.isApproved = true;
    await apartment.save();
    
    // Notify owner
    if (apartment.User && apartment.User.telegramId) {
      await bot.sendMessage(apartment.User.telegramId,
        `✅ *Great news! Your apartment has been approved!*\n\n` +
        `🏠 *${apartment.title}*\n` +
        `📍 *Location:* ${apartment.location}\n` +
        `💰 *Price:* ${formatCurrency(apartment.pricePerNight)}/night\n\n` +
        `Your listing is now live and visible to all users searching in Abuja.\n\n` +
        `You can manage your apartment using /my\\_apartments`,
        { parse_mode: 'Markdown' }
      );
    }
    
    // Update the message
    const text = `✅ *Apartment Approved*\n\n${apartment.title} has been approved and is now live.`;
    
    if (callbackQuery.message.photo) {
      await bot.editMessageCaption(text, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Next Pending', callback_data: 'admin_pending' }],
            [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
          ]
        }
      });
    } else {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Next Pending', callback_data: 'admin_pending' }],
            [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
          ]
        }
      });
    }
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Apartment approved successfully!'
    });
    
  } catch (error) {
    logger.error('Approve apartment error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error approving apartment' });
  }
};

const rejectApartment = async (bot, callbackQuery, apartmentId) => {
  const chatId = callbackQuery.message.chat.id;
  
  try {
    const apartment = await Apartment.findByPk(apartmentId, {
      include: [User]
    });
    
    if (!apartment) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Apartment not found' });
      return;
    }
    
    // Store apartment data for potential recovery
    const rejectedData = {
      id: apartment.id,
      title: apartment.title,
      ownerId: apartment.ownerId
    };
    
    // Delete or mark as rejected (you might want to soft delete instead)
    await apartment.destroy();
    
    // Notify owner
    if (apartment.User && apartment.User.telegramId) {
      await bot.sendMessage(apartment.User.telegramId,
        `❌ *Apartment Listing Not Approved*\n\n` +
        `We're sorry, but your apartment listing "${apartment.title}" was not approved.\n\n` +
        `*Possible reasons:*\n` +
        `• Incomplete or unclear information\n` +
        `• Missing photos\n` +
        `• Price seems unrealistic\n` +
        `• Location not clearly specified\n\n` +
        `Please review your listing and try again with more details.\n\n` +
        `Use /add\\_apartment to create a new listing.`,
        { parse_mode: 'Markdown' }
      );
    }
    
    // Update the message
    const text = `❌ *Apartment Rejected*\n\n${apartment.title} has been rejected.`;
    
    if (callbackQuery.message.photo) {
      await bot.editMessageCaption(text, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Next Pending', callback_data: 'admin_pending' }],
            [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
          ]
        }
      });
    } else {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Next Pending', callback_data: 'admin_pending' }],
            [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
          ]
        }
      });
    }
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Apartment rejected'
    });
    
  } catch (error) {
    logger.error('Reject apartment error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error rejecting apartment' });
  }
};

const handleAdminStats = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  
  try {
    // Gather statistics
    const totalUsers = await User.count();
    const totalOwners = await User.count({ where: { role: 'owner' } });
    const totalApartments = await Apartment.count();
    const approvedApartments = await Apartment.count({ where: { isApproved: true } });
    const pendingApartments = await Apartment.count({ where: { isApproved: false } });
    
    const totalBookings = await Booking.count();
    const pendingBookings = await Booking.count({ where: { status: 'pending' } });
    const confirmedBookings = await Booking.count({ where: { status: 'confirmed' } });
    const completedBookings = await Booking.count({ where: { status: 'completed' } });
    
    // Revenue calculation
    const paidBookings = await Booking.findAll({
      where: { paymentStatus: 'paid' },
      attributes: ['totalPrice']
    });
    const totalRevenue = paidBookings.reduce((sum, b) => sum + parseFloat(b.totalPrice), 0);
    
    // Recent activity
    const recentUsers = await User.count({
      where: {
        lastActive: {
          [Op.gte]: new Date(new Date() - 24 * 60 * 60 * 1000)
        }
      }
    });
    
    const statsText = `
📊 *System Statistics*

👥 *Users*
• Total Users: ${totalUsers}
• Property Owners: ${totalOwners}
• Active Today: ${recentUsers}

🏢 *Apartments*
• Total Listings: ${totalApartments}
• Approved: ${approvedApartments}
• Pending Approval: ${pendingApartments}

📅 *Bookings*
• Total Bookings: ${totalBookings}
• Pending: ${pendingBookings}
• Confirmed: ${confirmedBookings}
• Completed: ${completedBookings}

💰 *Revenue*
• Total Revenue: ${formatCurrency(totalRevenue)}

📈 *Performance*
• Conversion Rate: ${totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(1) : 0}%
• Avg. Booking Value: ${totalBookings > 0 ? formatCurrency(totalRevenue / totalBookings) : formatCurrency(0)}
    `;
    
    await bot.editMessageText(statsText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Refresh', callback_data: 'admin_stats' }],
          [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
        ]
      }
    });
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('Admin stats error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error loading statistics' });
  }
};

const handleUserManagement = async (bot, callbackQuery, page = 1) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  
  try {
    const users = await User.findAll({
      order: [['created_at', 'DESC']],
      limit: 10,
      offset: (page - 1) * 10
    });
    
    const totalUsers = await User.count();
    const totalPages = Math.ceil(totalUsers / 10);
    
    let text = `👥 *User Management* (Page ${page}/${totalPages})\n\n`;
    
    for (const user of users) {
      const roleEmoji = {
        'user': '👤',
        'owner': '🏠',
        'admin': '⚙️'
      }[user.role];
      
      const userBookings = await Booking.count({ where: { userId: user.id } });
      const userApartments = await Apartment.count({ where: { ownerId: user.id } });
      
      text += `${roleEmoji} *${user.firstName || 'Unknown'}* ${user.lastName || ''}\n`;
      text += `   🆔 \`${user.telegramId}\`\n`;
      text += `   📱 @${user.username || 'N/A'}\n`;
      text += `   📞 ${user.phone || 'Not provided'}\n`;
      text += `   👑 Role: ${user.role}\n`;
      text += `   📊 Stats: ${userBookings} bookings | ${userApartments} properties\n`;
      text += `   📅 Joined: ${new Date(user.createdAt).toLocaleDateString()}\n`;
      text += `   ⏱️ Last active: ${user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Never'}\n\n`;
    }
    
    const keyboard = {
      inline_keyboard: []
    };
    
    // Pagination
    if (totalPages > 1) {
      const paginationRow = [];
      if (page > 1) {
        paginationRow.push({ text: '◀️ Prev', callback_data: `admin_users_${page - 1}` });
      }
      paginationRow.push({ text: `📄 ${page}/${totalPages}`, callback_data: 'noop' });
      if (page < totalPages) {
        paginationRow.push({ text: 'Next ▶️', callback_data: `admin_users_${page + 1}` });
      }
      keyboard.inline_keyboard.push(paginationRow);
    }
    
    keyboard.inline_keyboard.push(
      [{ text: '📊 Export Users', callback_data: 'admin_export_users' }],
      [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
    );
    
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('User management error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error loading users' });
  }
};

const handleAllApartments = async (bot, callbackQuery, page = 1) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  
  try {
    const apartments = await Apartment.findAll({
      include: [{
        model: User,
        attributes: ['id', 'firstName', 'username']
      }],
      order: [['created_at', 'DESC']],
      limit: 5,
      offset: (page - 1) * 5
    });
    
    const totalApartments = await Apartment.count();
    const totalPages = Math.ceil(totalApartments / 5);
    
    let text = `🏢 *All Apartments* (Page ${page}/${totalPages})\n\n`;
    
    for (const apt of apartments) {
      const statusEmoji = apt.isApproved ? '✅' : '⏳';
      const availabilityEmoji = apt.isAvailable ? '🟢' : '🔴';
      
      text += `${statusEmoji} *${apt.title}*\n`;
      text += `   👤 Owner: ${apt.User?.firstName || 'Unknown'} (@${apt.User?.username || 'N/A'})\n`;
      text += `   📍 Location: ${apt.location}\n`;
      text += `   💰 ${formatCurrency(apt.pricePerNight)}/night\n`;
      text += `   📊 Status: ${availabilityEmoji} ${apt.isAvailable ? 'Available' : 'Unavailable'}\n`;
      text += `   👥 Max guests: ${apt.maxGuests} | 🛏️ ${apt.bedrooms} bed\n`;
      text += `   📅 Added: ${new Date(apt.createdAt).toLocaleDateString()}\n`;
      text += `   👁️ Views: ${apt.views}\n\n`;
    }
    
    const keyboard = {
      inline_keyboard: []
    };
    
    // Pagination
    if (totalPages > 1) {
      const paginationRow = [];
      if (page > 1) {
        paginationRow.push({ text: '◀️ Prev', callback_data: `admin_apartments_${page - 1}` });
      }
      paginationRow.push({ text: `📄 ${page}/${totalPages}`, callback_data: 'noop' });
      if (page < totalPages) {
        paginationRow.push({ text: 'Next ▶️', callback_data: `admin_apartments_${page + 1}` });
      }
      keyboard.inline_keyboard.push(paginationRow);
    }
    
    keyboard.inline_keyboard.push(
      [{ text: '📊 Export Data', callback_data: 'admin_export_apartments' }],
      [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
    );
    
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('All apartments error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error loading apartments' });
  }
};

module.exports = {
  handleAdminPanel,
  handlePendingApprovals,
  approveApartment,
  rejectApartment,
  handleAdminStats,
  handleUserManagement,
  handleAllApartments
};

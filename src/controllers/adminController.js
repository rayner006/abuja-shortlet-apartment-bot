// src/controllers/adminController.js (UPDATED - With Full User Management)
const { User, Apartment, Booking } = require('../models');
const { Op } = require('sequelize');
const { createAdminKeyboard, createPaginationKeyboard } = require('../utils/keyboards');
const { formatCurrency, paginate } = require('../utils/helpers');
const logger = require('../config/logger');

// Track active admin sessions to prevent duplicates
const activeAdminPanels = new Set();

const handleAdminPanel = async (bot, msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Check if user is admin
  const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id)) : [];
  
  if (!adminIds.includes(userId)) {
    await bot.sendMessage(chatId, '⛔ Access denied. This command is for admins only.');
    return;
  }
  
  // Prevent duplicate admin panels within 2 seconds
  const panelKey = `${chatId}_admin`;
  if (activeAdminPanels.has(panelKey)) {
    logger.info(`Duplicate admin panel prevented for chat ${chatId}`);
    return;
  }
  
  // Add to active panels
  activeAdminPanels.add(panelKey);
  setTimeout(() => activeAdminPanels.delete(panelKey), 2000);
  
  const adminText = `
⚙️ *Admin Panel*

Welcome to the administration panel. Select an option below:
  `;
  
  // Delete previous message if it's an admin panel to avoid duplicates
  try {
    if (msg.callback_query && msg.callback_query.message) {
      await bot.deleteMessage(chatId, msg.callback_query.message.message_id).catch(() => {});
    }
  } catch (e) {
    // Ignore delete errors
  }
  
  await bot.sendMessage(chatId, adminText, {
    parse_mode: 'Markdown',
    reply_markup: createAdminKeyboard()
  });
};

// ============================================
// USER MANAGEMENT WITH FULL CONTROLS
// ============================================

const handleUserManagement = async (bot, callbackQuery, page = 1) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  
  try {
    const users = await User.findAll({
      order: [['role', 'ASC'], ['created_at', 'DESC']],
      limit: 5,
      offset: (page - 1) * 5
    });
    
    const totalUsers = await User.count();
    const totalPages = Math.ceil(totalUsers / 5);
    
    let text = `👥 *User Management* (Page ${page}/${totalPages})\n\n`;
    text += `Select a user to manage or use buttons below:\n\n`;
    
    for (const user of users) {
      const roleEmoji = {
        'admin': '👑',
        'owner': '🏠',
        'user': '👤'
      }[user.role] || '👤';
      
      // Check if user has isActive field (if not, assume true)
      const isActive = user.isActive !== false;
      const statusEmoji = isActive ? '🟢' : '🔴';
      const status = isActive ? 'Active' : 'Inactive';
      
      const userBookings = await Booking.count({ where: { userId: user.id } });
      const userApartments = await Apartment.count({ where: { ownerId: user.id } });
      
      text += `${statusEmoji} ${roleEmoji} *${user.firstName || 'Unknown'}* ${user.lastName || ''}\n`;
      text += `   🆔 \`${user.telegramId}\`\n`;
      text += `   📱 @${user.username || 'N/A'}\n`;
      text += `   📞 ${user.phone || 'Not provided'}\n`;
      text += `   👑 Role: ${user.role} | ${status}\n`;
      text += `   📊 Stats: ${userBookings} bookings | ${userApartments} properties\n`;
      text += `   📅 Joined: ${new Date(user.createdAt).toLocaleDateString()}\n`;
      text += `   [🔧 Manage] → /manage_${user.id}\n\n`;
    }
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '➕ Add New User', callback_data: 'admin_add_user' },
          { text: '📊 Export All', callback_data: 'admin_export_users' }
        ]
      ]
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

// ============================================
// INDIVIDUAL USER MANAGEMENT
// ============================================

const handleManageUser = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const userId = callbackQuery.data.split('_')[1]; // Format: manage_123
  
  try {
    const user = await User.findByPk(userId, {
      include: [
        { model: Apartment, as: 'apartments' },
        { model: Booking, as: 'bookings' }
      ]
    });
    
    if (!user) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'User not found' });
      return;
    }
    
    const isActive = user.isActive !== false;
    const statusEmoji = isActive ? '🟢' : '🔴';
    const status = isActive ? 'Active' : 'Inactive';
    const roleEmoji = {
      'admin': '👑',
      'owner': '🏠',
      'user': '👤'
    }[user.role] || '👤';
    
    const text = `
👤 *User Details: ${user.firstName || ''} ${user.lastName || ''}*

${roleEmoji} *Role:* ${user.role}
${statusEmoji} *Status:* ${status}
🆔 *Telegram ID:* \`${user.telegramId}\`
📱 *Username:* @${user.username || 'N/A'}
📞 *Phone:* ${user.phone || 'Not provided'}
📅 *Joined:* ${new Date(user.createdAt).toLocaleDateString()}
⏱️ *Last Active:* ${user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Never'}

📊 *Statistics:*
• Apartments: ${user.apartments?.length || 0}
• Bookings: ${user.bookings?.length || 0}

🛠️ *Management Options:*
    `;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '👑 Change Role', callback_data: `user_role_${user.id}` },
          { text: isActive ? '🔴 Deactivate' : '🟢 Activate', callback_data: `user_toggle_${user.id}` }
        ],
        [
          { text: '✏️ Edit Details', callback_data: `user_edit_${user.id}` },
          { text: '📋 View Listings', callback_data: `user_listings_${user.id}` }
        ],
        [
          { text: '📅 View Bookings', callback_data: `user_bookings_${user.id}` },
          { text: '💬 Send Message', callback_data: `user_message_${user.id}` }
        ],
        [
          { text: '❌ Delete User', callback_data: `user_delete_${user.id}` }
        ],
        [{ text: '« Back to Users', callback_data: 'admin_users' }]
      ]
    };
    
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('Manage user error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error loading user' });
  }
};

// ============================================
// CHANGE USER ROLE
// ============================================

const handleChangeRole = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const userId = callbackQuery.data.split('_')[2];
  
  try {
    const user = await User.findByPk(userId);
    
    if (!user) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'User not found' });
      return;
    }
    
    const text = `
👤 *Change Role for ${user.firstName || 'User'}*

Current Role: ${user.role}

Select new role:
    `;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '👤 User', callback_data: `set_role_${user.id}_user` },
          { text: '🏠 Owner', callback_data: `set_role_${user.id}_owner` }
        ],
        [
          { text: '👑 Admin', callback_data: `set_role_${user.id}_admin` }
        ],
        [{ text: '« Back', callback_data: `manage_${user.id}` }]
      ]
    };
    
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('Change role error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error' });
  }
};

// ============================================
// SET NEW ROLE
// ============================================

const handleSetRole = async (bot, callbackQuery) => {
  const parts = callbackQuery.data.split('_');
  const userId = parts[2];
  const newRole = parts[3];
  
  try {
    const user = await User.findByPk(userId);
    
    if (!user) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'User not found' });
      return;
    }
    
    const oldRole = user.role;
    user.role = newRole;
    await user.save();
    
    // Notify user if they're still active
    if (user.telegramId) {
      await bot.sendMessage(user.telegramId,
        `🔔 *Role Update*\n\nYour role has been changed from *${oldRole}* to *${newRole}* by an admin.`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: `Role changed to ${newRole}`
    });
    
    // Refresh user management view
    const mockCallback = {
      message: callbackQuery.message,
      from: callbackQuery.from,
      id: callbackQuery.id,
      data: `manage_${userId}`
    };
    await handleManageUser(bot, mockCallback);
    
  } catch (error) {
    logger.error('Set role error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error setting role' });
  }
};

// ============================================
// TOGGLE USER ACTIVE STATUS
// ============================================

const handleToggleUserStatus = async (bot, callbackQuery) => {
  const userId = callbackQuery.data.split('_')[2];
  
  try {
    const user = await User.findByPk(userId);
    
    if (!user) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'User not found' });
      return;
    }
    
    // Toggle status (if isActive doesn't exist, add it)
    user.isActive = user.isActive === false ? true : false;
    await user.save();
    
    const status = user.isActive ? 'activated' : 'deactivated';
    
    // Notify user
    if (user.telegramId) {
      await bot.sendMessage(user.telegramId,
        `🔔 *Account Update*\n\nYour account has been *${status}* by an admin.`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: `User ${status} successfully`
    });
    
    // Refresh user management view
    const mockCallback = {
      message: callbackQuery.message,
      from: callbackQuery.from,
      id: callbackQuery.id,
      data: `manage_${userId}`
    };
    await handleManageUser(bot, mockCallback);
    
  } catch (error) {
    logger.error('Toggle user status error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error updating user' });
  }
};

// ============================================
// DELETE USER (with confirmation)
// ============================================

const handleDeleteUser = async (bot, callbackQuery) => {
  const userId = callbackQuery.data.split('_')[2];
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  
  try {
    const user = await User.findByPk(userId);
    
    if (!user) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'User not found' });
      return;
    }
    
    // Check if user has apartments or bookings
    const apartmentsCount = await Apartment.count({ where: { ownerId: user.id } });
    const bookingsCount = await Booking.count({ where: { userId: user.id } });
    
    const text = `
⚠️ *Confirm User Deletion*

Are you sure you want to delete *${user.firstName || 'User'}*?

This will permanently remove:
• User account
• ${apartmentsCount} apartment(s) (if owner)
• ${bookingsCount} booking(s)

This action CANNOT be undone!
    `;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Yes, Delete', callback_data: `confirm_delete_${user.id}` },
          { text: '❌ Cancel', callback_data: `manage_${user.id}` }
        ]
      ]
    };
    
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('Delete user error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error' });
  }
};

// ============================================
// CONFIRM DELETE USER
// ============================================

const handleConfirmDeleteUser = async (bot, callbackQuery) => {
  const userId = callbackQuery.data.split('_')[2];
  const chatId = callbackQuery.message.chat.id;
  
  try {
    const user = await User.findByPk(userId);
    
    if (!user) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'User not found' });
      return;
    }
    
    // Store user info for notification
    const userName = user.firstName || 'User';
    const userTelegramId = user.telegramId;
    
    // Delete user (cascade should handle related records if set up)
    await user.destroy();
    
    // Notify if possible
    if (userTelegramId) {
      await bot.sendMessage(userTelegramId,
        `🔔 *Account Deleted*\n\nYour account has been removed from the system by an admin.`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: `User ${userName} deleted successfully`
    });
    
    // Go back to user list
    const mockCallback = {
      message: callbackQuery.message,
      from: callbackQuery.from,
      id: callbackQuery.id,
      data: 'admin_users'
    };
    await handleUserManagement(bot, mockCallback, 1);
    
  } catch (error) {
    logger.error('Confirm delete user error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error deleting user' });
  }
};

// ============================================
// EXISTING FUNCTIONS (keep all your existing code below)
// ============================================

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
    
    await apartment.destroy();
    
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
    const totalUsers = await User.count();
    const totalOwners = await User.count({ where: { role: 'owner' } });
    const totalApartments = await Apartment.count();
    const approvedApartments = await Apartment.count({ where: { isApproved: true } });
    const pendingApartments = await Apartment.count({ where: { isApproved: false } });
    
    const totalBookings = await Booking.count();
    const pendingBookings = await Booking.count({ where: { status: 'pending' } });
    const confirmedBookings = await Booking.count({ where: { status: 'confirmed' } });
    const completedBookings = await Booking.count({ where: { status: 'completed' } });
    
    const paidBookings = await Booking.findAll({
      where: { paymentStatus: 'paid' },
      attributes: ['totalPrice']
    });
    const totalRevenue = paidBookings.reduce((sum, b) => sum + parseFloat(b.totalPrice), 0);
    
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

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Main admin
  handleAdminPanel,
  
  // User management
  handleUserManagement,
  handleManageUser,
  handleChangeRole,
  handleSetRole,
  handleToggleUserStatus,
  handleDeleteUser,
  handleConfirmDeleteUser,
  
  // Apartment approvals
  handlePendingApprovals,
  approveApartment,
  rejectApartment,
  
  // Stats and listings
  handleAdminStats,
  handleAllApartments
};

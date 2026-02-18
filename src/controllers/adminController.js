// src/controllers/adminController.js
const { User, Apartment, Booking } = require('../models');
const { Op } = require('sequelize');
const { createAdminKeyboard } = require('../utils/keyboards');
const { formatCurrency, paginate } = require('../utils/helpers');
const logger = require('../config/logger');

/* ================= ADMIN PANEL ================= */
const handleAdminPanel = async (bot, msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const adminIds = process.env.ADMIN_IDS.split(',').map(id => parseInt(id));

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

/* ================= USER MANAGEMENT ================= */
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
        user: '👤',
        owner: '🏠',
        admin: '⚙️'
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

    const keyboard = { inline_keyboard: [] };

    if (totalPages > 1) {
      const row = [];
      if (page > 1) row.push({ text: '◀️ Prev', callback_data: `admin_users_${page - 1}` });
      row.push({ text: `📄 ${page}/${totalPages}`, callback_data: 'noop' });
      if (page < totalPages) row.push({ text: 'Next ▶️', callback_data: `admin_users_${page + 1}` });
      keyboard.inline_keyboard.push(row);
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

/* ================= ALL APARTMENTS ================= */
const handleAllApartments = async (bot, callbackQuery, page = 1) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;

  try {
    const apartments = await Apartment.findAll({
      include: [{ model: User, attributes: ['id', 'firstName', 'username'] }],
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

    const keyboard = { inline_keyboard: [] };

    if (totalPages > 1) {
      const row = [];
      if (page > 1) row.push({ text: '◀️ Prev', callback_data: `admin_apartments_${page - 1}` });
      row.push({ text: `📄 ${page}/${totalPages}`, call

const UserService = require('../services/userService');
const BookingService = require('../services/bookingService');
const Helpers = require('../utils/helpers');
const logger = require('../middleware/logger');

class AdminHandler {
  /* ================= CHECK ADMIN ================= */
  static async isAdmin(telegramId) {
    try {
      const user = await UserService.findByTelegramId(telegramId);
      return user && user.role === 'admin';
    } catch (error) {
      logger.error('Admin check error:', error);
      return false;
    }
  }

  /* ================= ASSIGN OWNER ROLE ================= */
  // Usage example: /makeowner 123456789
  static async makeOwner(bot, msg, targetTelegramId) {
    const chatId = msg.chat.id;

    try {
      const isAdmin = await this.isAdmin(msg.from.id);
      if (!isAdmin) {
        return bot.sendMessage(chatId, '❌ Unauthorized.');
      }

      const targetUser = await UserService.findByTelegramId(
        targetTelegramId
      );

      if (!targetUser) {
        return bot.sendMessage(chatId, 'User not found.');
      }

      await UserService.updateRole(targetUser.id, 'owner');

      await bot.sendMessage(
        chatId,
        `✅ User ${targetTelegramId} is now an Owner.`
      );
    } catch (error) {
      logger.error('Make owner error:', error);
      await bot.sendMessage(chatId, '⚠️ Failed to assign owner role.');
    }
  }

  /* ================= SYSTEM STATS ================= */
  static async systemStats(bot, msg) {
    const chatId = msg.chat.id;

    try {
      const isAdmin = await this.isAdmin(msg.from.id);
      if (!isAdmin) {
        return bot.sendMessage(chatId, '❌ Unauthorized.');
      }

      const commission = await BookingService.getCommissionReport();
      const totalCommission =
        commission.total_commission || 0;
      const totalPaid =
        commission.total_paid_bookings || 0;

      const text = `
📊 *System Stats*

💰 Total Commission: ${Helpers.formatCurrency(totalCommission)}
🧾 Paid Bookings: ${totalPaid}
`;

      await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('System stats error:', error);
      await bot.sendMessage(chatId, '⚠️ Failed to load stats.');
    }
  }

  /* ================= LIST OWNERS ================= */
  static async listOwners(bot, msg) {
    const chatId = msg.chat.id;

    try {
      const isAdmin = await this.isAdmin(msg.from.id);
      if (!isAdmin) {
        return bot.sendMessage(chatId, '❌ Unauthorized.');
      }

      const owners = await UserService.getOwners();

      if (!owners.length) {
        return bot.sendMessage(chatId, 'No owners found.');
      }

      const list = owners
        .map(
          o =>
            `• ${o.first_name || ''} ${o.last_name || ''} (${
              o.telegram_id
            })`
        )
        .join('\n');

      await bot.sendMessage(chatId, `🏠 *Owners*\n\n${list}`, {
        parse_mode: 'Markdown'
      });
    } catch (error) {
      logger.error('List owners error:', error);
      await bot.sendMessage(chatId, '⚠️ Failed to fetch owners.');
    }
  }
}

module.exports = AdminHandler;

const { isAdmin } = require('../../middleware/auth');
const AdminService = require('../../services/adminService');
const OwnerService = require('../../services/ownerService');
const logger = require('../../middleware/logger');
const config = require('../../config/environment');

module.exports = (bot) => {
  // Test admin status
  bot.onText(/\/test_admin/, (msg) => {
    const chatId = msg.chat.id;
    
    if (isAdmin(chatId)) {
      bot.sendMessage(chatId, '✅ *You are recognized as admin!*\n\nNotifications will work.', {
        parse_mode: 'Markdown'
      });
    } else {
      bot.sendMessage(chatId, '❌ *You are NOT in admin list*\n\nContact the bot owner.', {
        parse_mode: 'Markdown'
      });
    }
  });
  
  // Add subscription
  bot.onText(/\/add_subscription (\d+) (\d{4}-\d{2}-\d{2}) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
      return bot.sendMessage(chatId, '❌ This command is for admins only.');
    }
    
    const ownerId = parseInt(match[1]);
    const endDate = match[2];
    const amount = parseFloat(match[3]);
    
    const result = await AdminService.addSubscription(ownerId, endDate, amount);
    
    bot.sendMessage(chatId, result.message, {
      parse_mode: result.success ? 'Markdown' : undefined
    });
  });
  
  // Check subscription
  bot.onText(/\/check_subscription (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
      return bot.sendMessage(chatId, '❌ This command is for admins only.');
    }
    
    const ownerId = parseInt(match[1]);
    
    const result = await OwnerService.checkSubscription(ownerId);
    
    bot.sendMessage(chatId, result.message, {
      parse_mode: 'Markdown'
    });
  });
  
  // List expired subscriptions
  bot.onText(/\/expired_subs/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
      return bot.sendMessage(chatId, '❌ This command is for admins only.');
    }
    
    const result = await AdminService.getExpiredSubscriptions();
    
    bot.sendMessage(chatId, result.message, {
      parse_mode: 'Markdown'
    });
  });
  
  // Commission report
  bot.onText(/\/commissions(?:\s+(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
      return bot.sendMessage(chatId, '❌ This command is for admins only.');
    }
    
    const ownerId = match[1] ? parseInt(match[1]) : null;
    
    const result = await AdminService.getCommissionReport(ownerId);
    
    bot.sendMessage(chatId, result.message, {
      parse_mode: 'Markdown'
    });
  });
  
  // Pay commission
  bot.onText(/\/pay_commission (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
      return bot.sendMessage(chatId, '❌ This command is for admins only.');
    }
    
    const commissionId = parseInt(match[1]);
    
    const Commission = require('../../models/Commission');
    const success = await Commission.markAsPaid(commissionId);
    
    if (success) {
      bot.sendMessage(chatId, `✅ Commission ID ${commissionId} marked as paid.`);
    } else {
      bot.sendMessage(chatId, '❌ Commission ID not found or error updating.');
    }
  });
  
  // Dashboard
  bot.onText(/\/dashboard/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
      return bot.sendMessage(chatId, '❌ This command is for admins only.');
    }
    
    const result = await AdminService.getDashboard();
    
    bot.sendMessage(chatId, result.message, {
      parse_mode: 'Markdown'
    });
  });
};
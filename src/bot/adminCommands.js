// src/bot/adminCommands.js
const { handleAdminPanel } = require('../controllers/adminController');
const logger = require('../config/logger');

const setupAdminCommands = (bot) => {
  
  // Admin panel command
  bot.onText(/\/admin/, async (msg) => {
    try {
      await handleAdminPanel(bot, msg);
    } catch (error) {
      logger.error('Admin command error:', error);
      bot.sendMessage(msg.chat.id, 'Error accessing admin panel.');
    }
  });

  // Optional: Quick stats command
  bot.onText(/\/stats/, async (msg) => {
    try {
      const { handleAdminStats } = require('../controllers/adminController');
      // Create a mock callback query
      const mockCallback = {
        id: 'stats',
        message: msg,
        from: msg.from,
        data: 'admin_stats'
      };
      await handleAdminStats(bot, mockCallback);
    } catch (error) {
      logger.error('Stats command error:', error);
      bot.sendMessage(msg.chat.id, 'Error loading stats.');
    }
  });

  // Optional: Quick pending approvals
  bot.onText(/\/pending/, async (msg) => {
    try {
      const { handlePendingApprovals } = require('../controllers/adminController');
      const mockCallback = {
        id: 'pending',
        message: msg,
        from: msg.from,
        data: 'admin_pending'
      };
      await handlePendingApprovals(bot, mockCallback, 1);
    } catch (error) {
      logger.error('Pending command error:', error);
      bot.sendMessage(msg.chat.id, 'Error loading pending approvals.');
    }
  });
};

module.exports = { setupAdminCommands };

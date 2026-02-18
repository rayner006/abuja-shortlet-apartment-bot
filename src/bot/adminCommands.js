// src/bot/adminCommands.js
const logger = require('../config/logger');

// Import the NEW admin controller
const AdminController = require('../controllers/admin');

const setupAdminCommands = (bot) => {
  
  // Create admin controller instance with the bot
  const adminController = new AdminController(bot);
  
  // Admin panel command
  bot.onText(/\/admin/, async (msg) => {
    try {
      // Check if user is admin
      const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id)) : [];
      if (!adminIds.includes(msg.from.id)) {
        await bot.sendMessage(msg.chat.id, '⛔ This command is for admins only.');
        return;
      }
      
      await adminController.handleAdminPanel(msg);
    } catch (error) {
      logger.error('Admin command error:', error);
      bot.sendMessage(msg.chat.id, 'Error accessing admin panel.');
    }
  });

  // Quick stats command
  bot.onText(/\/stats/, async (msg) => {
    try {
      // Check if user is admin
      const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id)) : [];
      if (!adminIds.includes(msg.from.id)) {
        await bot.sendMessage(msg.chat.id, '⛔ This command is for admins only.');
        return;
      }
      
      // Create a mock callback query for the stats
      const mockCallback = {
        id: 'stats',
        message: msg,
        from: msg.from,
        data: 'admin_stats'
      };
      
      await adminController.handleCallback(mockCallback);
    } catch (error) {
      logger.error('Stats command error:', error);
      bot.sendMessage(msg.chat.id, 'Error loading stats.');
    }
  });

  // Quick pending approvals
  bot.onText(/\/pending/, async (msg) => {
    try {
      // Check if user is admin
      const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id)) : [];
      if (!adminIds.includes(msg.from.id)) {
        await bot.sendMessage(msg.chat.id, '⛔ This command is for admins only.');
        return;
      }
      
      // Create a mock callback query for pending approvals
      const mockCallback = {
        id: 'pending',
        message: msg,
        from: msg.from,
        data: 'admin_pending_1'
      };
      
      await adminController.handleCallback(mockCallback);
    } catch (error) {
      logger.error('Pending command error:', error);
      bot.sendMessage(msg.chat.id, 'Error loading pending approvals.');
    }
  });
  
  // Quick users list
  bot.onText(/\/users/, async (msg) => {
    try {
      // Check if user is admin
      const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id)) : [];
      if (!adminIds.includes(msg.from.id)) {
        await bot.sendMessage(msg.chat.id, '⛔ This command is for admins only.');
        return;
      }
      
      // Create a mock callback query for users list
      const mockCallback = {
        id: 'users',
        message: msg,
        from: msg.from,
        data: 'admin_users_1'
      };
      
      await adminController.handleCallback(mockCallback);
    } catch (error) {
      logger.error('Users command error:', error);
      bot.sendMessage(msg.chat.id, 'Error loading users.');
    }
  });
  
  // Quick apartments list
  bot.onText(/\/allapartments/, async (msg) => {
    try {
      // Check if user is admin
      const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id)) : [];
      if (!adminIds.includes(msg.from.id)) {
        await bot.sendMessage(msg.chat.id, '⛔ This command is for admins only.');
        return;
      }
      
      // Create a mock callback query for apartments list
      const mockCallback = {
        id: 'allapartments',
        message: msg,
        from: msg.from,
        data: 'admin_apartments_1'
      };
      
      await adminController.handleCallback(mockCallback);
    } catch (error) {
      logger.error('Apartments command error:', error);
      bot.sendMessage(msg.chat.id, 'Error loading apartments.');
    }
  });
};

module.exports = { setupAdminCommands };

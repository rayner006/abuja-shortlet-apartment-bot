require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { initDatabase } = require('./models');
const logger = require('./config/logger');
const redis = require('./config/redis');
const { setupCommands } = require('./bot/commands');
const { setupAdminCommands } = require('./bot/adminCommands');
const { handleCallback } = require('./bot/callbacks');
const { handleMessage } = require('./bot/conversations');

// ✅ 1. FIRST initialize the bot
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: false
});

// ✅ 2. THEN import and create AdminController with the bot
const AdminController = require('./controllers/admin');
const adminController = new AdminController(bot);

const app = express();
app.use(express.json());

app.set('bot', bot);

// Initialize database
initDatabase().catch(err => {
  logger.error('Database initialization failed:', err);
  process.exit(1);
});

// Setup bot commands
setupCommands(bot);
setupAdminCommands(bot);

// --- START BOT SAFELY ---
(async () => {
  try {
    // Stop any previous polling just in case
    await bot.stopPolling().catch(() => {});

    // Delete webhook before polling
    await bot.deleteWebHook();
    logger.info('Webhook deleted successfully');

    // Start polling manually
    await bot.startPolling({
      interval: 300,
      params: { timeout: 10 }
    });

    logger.info('Bot polling started');
  } catch (error) {
    logger.error('Bot startup error:', error.message);
  }
})();

// Bot error handling
bot.on('polling_error', (error) => {
  logger.error('Polling error:', error.message);
});

bot.on('webhook_error', (error) => {
  logger.error('Webhook error:', error.message);
});

bot.on('error', (error) => {
  logger.error('Bot error:', error.message);
});

// Message handler
bot.on('message', async (msg) => {
  try {
    if (msg.text && msg.text.startsWith('/')) return;
    
    // Check for edit states first
    if (global.editStates && global.editStates[msg.chat.id]) {
      const state = global.editStates[msg.chat.id];
      if (state.action === 'editing_user') {
        // Handle user field editing
        const { User } = require('./models');
        const user = await User.findByPk(state.userId);
        
        if (user) {
          // Update the field
          user[state.field] = msg.text;
          await user.save();
          
          delete global.editStates[msg.chat.id];
          
          await bot.sendMessage(msg.chat.id, 
            `✅ ${state.field} updated successfully!`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '« Back to User', callback_data: `manage_${state.userId}` }]
                ]
              }
            }
          );
          return;
        }
      } else if (state.action === 'sending_message') {
        // Handle sending message to user
        await bot.sendMessage(state.targetTelegramId, 
          `📨 *Message from Admin:*\n\n${msg.text}`,
          { parse_mode: 'Markdown' }
        );
        
        delete global.messageStates[msg.chat.id];
        
        await bot.sendMessage(msg.chat.id, 
          '✅ Message sent successfully!',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '« Back to User', callback_data: `manage_${state.targetUserId}` }]
              ]
            }
          }
        );
        return;
      }
    }
    
    // Regular message handling
    await handleMessage(bot, msg);
  } catch (error) {
    logger.error('Message handler error:', error);
  }
});

// Callback query handler
bot.on('callback_query', async (callbackQuery) => {
  try {
    const data = callbackQuery.data;
    
    // Route ALL admin callbacks to the new admin controller
    if (data.startsWith('admin_') || 
        data.startsWith('user_') || 
        data.startsWith('manage_') || 
        data.startsWith('approve_') ||
        data.startsWith('reject_') || 
        data.startsWith('edit_') ||
        data.startsWith('set_role_') || 
        data.startsWith('confirm_delete_') ||
        data === 'menu_admin' || 
        data === 'admin_back') {
      
      await adminController.handleCallback(callbackQuery);
    }
    // Route non-admin callbacks to original handler
    else {
      await handleCallback(bot, callbackQuery);
    }
    
  } catch (error) {
    logger.error('Callback handler error:', error);
    bot.answerCallbackQuery(callbackQuery.id, {
      text: 'An error occurred. Please try again.'
    }).catch(() => {});
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
    bot: 'running'
  });
});

// Start server
const PORT = process.env.PORT || 8888;
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info('Bot server ready...');
});

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down gracefully...');
  try {
    await bot.stopPolling().catch(() => {});
    if (redis) await redis.quit().catch(() => {});
  } catch (e) {
    logger.error('Shutdown error:', e);
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = { bot, app, server };

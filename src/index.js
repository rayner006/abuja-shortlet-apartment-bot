// src/index.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { initDatabase } = require('./models');
const logger = require('./config/logger');
const redis = require('./config/redis');
const { handleStart, handleMenu } = require('./controllers/userController');
const { handleCallback } = require('./bot/callbacks');
const { setupCommands } = require('./bot/commands');

// Initialize bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();

// Middleware
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// Store bot instance for controllers
app.set('bot', bot);

// Initialize database
initDatabase();

// Setup bot commands
setupCommands(bot);

// Error handling for bot
bot.on('polling_error', (error) => {
  logger.error('Polling error:', error);
});

bot.on('webhook_error', (error) => {
  logger.error('Webhook error:', error);
});

// Message handler
bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Ignore commands (they're handled separately)
    if (text && text.startsWith('/')) return;
    
    // Handle non-command messages
    logger.info(`Message from ${chatId}: ${text}`);
    
  } catch (error) {
    logger.error('Message handler error:', error);
    bot.sendMessage(msg.chat.id, 'An error occurred. Please try again.');
  }
});

// Callback query handler
bot.on('callback_query', async (callbackQuery) => {
  try {
    await handleCallback(bot, callbackQuery);
  } catch (error) {
    logger.error('Callback handler error:', error);
    bot.answerCallbackQuery(callbackQuery.id, {
      text: 'An error occurred. Please try again.'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info('Bot is running...');
});

// Graceful shutdown
process.once('SIGINT', () => {
  redis.quit();
  process.exit();
});

process.once('SIGTERM', () => {
  redis.quit();
  process.exit();
});

// src/index.js
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { initDatabase } = require('./models');
const logger = require('./config/logger');
const redis = require('./config/redis');
const { setupCommands } = require('./bot/commands');
const { handleCallback } = require('./bot/callbacks');
const { handleMessage } = require('./bot/conversations');

// Initialize bot (fixed polling config)
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: { timeout: 10 }
  }
});

// Delete webhook to avoid 409 conflicts
bot.deleteWebHook().catch(() => {});

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
    await handleMessage(bot, msg);
  } catch (error) {
    logger.error('Message handler error:', error);
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
  logger.info('Bot is running...');
});

// Graceful shutdown function
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

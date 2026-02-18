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

// Initialize bot with better error handling
const bot = new TelegramBot(process.env.BOT_TOKEN, { 
  polling: true,
  filepath: false,
  // Add these options for stability
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 10
    }
  }
});

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

// Error handling for bot
bot.on('polling_error', (error) => {
  logger.error('Polling error:', error);
  // Don't exit, just log
});

bot.on('webhook_error', (error) => {
  logger.error('Webhook error:', error);
});

// Handle bot errors
bot.on('error', (error) => {
  logger.error('Bot error:', error);
});

// Message handler
bot.on('message', async (msg) => {
  try {
    if (msg.text && msg.text.startsWith('/')) {
      return;
    }
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
    bot: bot.isPolling() ? 'running' : 'stopped'
  });
});

// Keep process alive with proper error handling
const PORT = process.env.PORT || 8888;
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info('Bot is running...');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    bot.stopPolling().then(() => {
      redis.quit().then(() => {
        process.exit(0);
      });
    });
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  server.close(() => {
    bot.stopPolling().then(() => {
      redis.quit().then(() => {
        process.exit(0);
      });
    });
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Keep running despite error
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = { bot, app, server };

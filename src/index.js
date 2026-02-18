// src/index.js (updated)
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { initDatabase } = require('./models');
const logger = require('./config/logger');
const redis = require('./config/redis');
const { setupCommands } = require('./bot/commands');
const { handleCallback } = require('./bot/callbacks');
const { handleMessage, cancelConversation } = require('./bot/conversations');

// Initialize bot
const bot = new TelegramBot(process.env.BOT_TOKEN, { 
  polling: true,
  filepath: false // Disable file download to save memory
});

const app = express();

// Middleware
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
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

// Message handler for non-command messages
bot.on('message', async (msg) => {
  try {
    // Ignore commands (they're handled separately)
    if (msg.text && msg.text.startsWith('/')) {
      return;
    }
    
    await handleMessage(bot, msg);
    
  } catch (error) {
    logger.error('Global message handler error:', error);
    bot.sendMessage(msg.chat.id, 'An error occurred. Please try again.');
  }
});

// Callback query handler
bot.on('callback_query', async (callbackQuery) => {
  try {
    await handleCallback(bot, callbackQuery);
  } catch (error) {
    logger.error('Global callback handler error:', error);
    bot.answerCallbackQuery(callbackQuery.id, {
      text: 'An error occurred. Please try again.'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Stats endpoint (admin only)
app.get('/stats', async (req, res) => {
  // Simple API key check (you should implement proper auth)
  const apiKey = req.query.api_key;
  if (apiKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const { User, Apartment, Booking } = require('./models');
    
    const stats = {
      users: await User.count(),
      owners: await User.count({ where: { role: 'owner' } }),
      apartments: {
        total: await Apartment.count(),
        approved: await Apartment.count({ where: { isApproved: true } }),
        pending: await Apartment.count({ where: { isApproved: false } })
      },
      bookings: {
        total: await Booking.count(),
        pending: await Booking.count({ where: { status: 'pending' } }),
        confirmed: await Booking.count({ where: { status: 'confirmed' } }),
        completed: await Booking.count({ where: { status: 'completed' } })
      },
      redis: {
        status: redis.status
      }
    };
    
    res.json(stats);
  } catch (error) {
    logger.error('Stats endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info('Bot is running...');
});

// Graceful shutdown
process.once('SIGINT', async () => {
  logger.info('Shutting down...');
  await redis.quit();
  process.exit(0);
});

process.once('SIGTERM', async () => {
  logger.info('Shutting down...');
  await redis.quit();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = { bot, app };

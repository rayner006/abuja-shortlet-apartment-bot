const TelegramBot = require('node-telegram-bot-api');
const config = require('./config/environment');
const logger = require('./middleware/logger');

// Initialize bot based on environment
let bot;

if (config.nodeEnv === 'production') {
  // Production: Webhook mode (no polling)
  bot = new TelegramBot(config.botToken);
  
  // Webhook will be set by webhook.js
  logger.info('Bot initialized in webhook mode');
} else {
  // Development: Polling mode
  bot = new TelegramBot(config.botToken, { 
    polling: {
      params: {
        timeout: 30,
        limit: 100,
        allowed_updates: ['message', 'callback_query']
      }
    }
  });
  logger.info('Bot initialized in polling mode');
}

// Global error handlers
bot.on('polling_error', (error) => {
  if (error.code === 'EFATAL') {
    logger.error('Fatal polling error:', error);
  } else {
    logger.warn('Polling error:', error.message);
  }
});

bot.on('webhook_error', (error) => {
  logger.error('Webhook error:', error);
});

// Track bot info
bot.getMe().then(botInfo => {
  bot.botInfo = botInfo;
}).catch(err => {
  logger.error('Failed to get bot info:', err);
});

module.exports = bot;
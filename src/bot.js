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

// Clear any existing webhooks to prevent conflicts
// This ensures clean startup regardless of environment
bot.deleteWebHook()
  .then(() => logger.info('✅ Existing webhook cleared'))
  .catch(err => {
    // 404 means no webhook was set, which is fine
    if (err.response && err.response.statusCode === 404) {
      logger.info('ℹ️ No existing webhook to clear');
    } else {
      logger.warn('⚠️ Error clearing webhook:', err.message);
    }
  });

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
  logger.info(`✅ Bot authenticated as @${botInfo.username}`);
}).catch(err => {
  logger.error('❌ Failed to get bot info - invalid token?', err);
});

module.exports = bot;

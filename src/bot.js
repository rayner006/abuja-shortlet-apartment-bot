const TelegramBot = require('node-telegram-bot-api');
const logger = require('./middleware/logger');

module.exports = function initBot(redis, sequelize) {
  const token = process.env.BOT_TOKEN;
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (!token) {
    throw new Error('BOT_TOKEN is missing in .env');
  }

  let bot;

  // ================= INIT MODE =================
  if (nodeEnv === 'production') {
    // Webhook Mode
    bot = new TelegramBot(token);
    logger.info('Bot running in WEBHOOK mode');
  } else {
    // Polling Mode
    bot = new TelegramBot(token, {
      polling: {
        params: {
          timeout: 30,
          limit: 100,
          allowed_updates: ['message', 'callback_query']
        }
      }
    });
    logger.info('Bot running in POLLING mode');
  }

  // ================= CLEAR OLD WEBHOOK =================
  bot.deleteWebHook().catch(() => {});

  // ================= BOT INFO =================
  bot.getMe()
    .then(info => {
      bot.botInfo = info;
      logger.info(`Authenticated as @${info.username}`);
    })
    .catch(err => logger.error('Bot auth failed:', err.message));

  // ================= GLOBAL ERRORS =================
  bot.on('polling_error', err => logger.warn('Polling error:', err.message));
  bot.on('webhook_error', err => logger.error('Webhook error:', err.message));

  // ================= REGISTER HANDLERS =================
  require('./handlers/commands/start')(bot, redis, sequelize);
  require('./handlers/commands/admin')(bot, redis, sequelize);
  require('./handlers/callbacks/navigation')(bot, redis, sequelize);
  require('./handlers/callbacks/booking')(bot, redis, sequelize);

  return bot;
};

const TelegramBot = require('node-telegram-bot-api');
const logger = require('./middleware/logger');
const config = require('./config/environment');

/* ================= HANDLERS ================= */
const StartHandler = require('./handlers/startHandler');
const MessageHandler = require('./handlers/messageHandler');
const CallbackHandler = require('./handlers/callbackHandler');
const AdminHandler = require('./handlers/adminHandler');

function createBot() {
  const token = config.botToken;
  const nodeEnv = config.nodeEnv || 'development';

  if (!token) {
    throw new Error('BOT_TOKEN is missing in environment variables');
  }

  let bot;

  // ================= INIT MODE =================
  if (nodeEnv === 'production') {
    // Webhook Mode
    bot = new TelegramBot(token, { polling: false });
    logger.info('Bot running in WEBHOOK mode');
  } else {
    // Polling Mode (optional local dev)
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
  bot.onText(/\/start/, (msg) => StartHandler.handle(bot, msg));
  bot.onText(/\/stats/, (msg) => AdminHandler.systemStats(bot, msg));
  bot.onText(/\/makeowner (.+)/, (msg, match) => {
    const targetId = match[1];
    AdminHandler.makeOwner(bot, msg, targetId);
  });

  bot.on('callback_query', (query) => CallbackHandler.handle(bot, query));
  bot.on('message', (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    MessageHandler.handle(bot, msg);
  });

  return bot;
}

module.exports = createBot;

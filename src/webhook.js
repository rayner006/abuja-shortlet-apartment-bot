const config = require('./config/environment');
const logger = require('./middleware/logger');

async function setupWebhook(app, bot) {
  const token = config.botToken;

  /* ================= WEBHOOK ENDPOINT ================= */
  app.post(`/webhook/${token}`, async (req, res) => {
    try {
      await bot.processUpdate(req.body);
      res.sendStatus(200);
    } catch (error) {
      logger.error('Error processing webhook:', error);
      res.sendStatus(500);
    }
  });

  /* ================= SET WEBHOOK ================= */
  if (config.nodeEnv === 'production' && config.webhookUrl) {
    try {
      const webhookUrl = `${config.webhookUrl}/webhook/${token}`;

      await bot.setWebHook(webhookUrl);

      logger.info(`✅ Webhook set to: ${webhookUrl}`);
    } catch (err) {
      logger.error('❌ Failed to set webhook:', err);
    }
  }

  logger.info('Webhook handler registered');
}

module.exports = setupWebhook;

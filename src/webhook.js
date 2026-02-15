const config = require('./config/environment');
const logger = require('./middleware/logger');

module.exports = (app, bot) => {
  const token = config.botToken;
  
  // Webhook endpoint
  app.post(`/webhook/${token}`, (req, res) => {
    try {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    } catch (error) {
      logger.error('Error processing webhook:', error);
      res.sendStatus(500);
    }
  });
  
  // Set webhook in production
  if (config.nodeEnv === 'production' && config.webhookUrl) {
    const webhookUrl = `${config.webhookUrl}/webhook/${token}`;
    
    bot.setWebHook(webhookUrl)
      .then(() => {
        logger.info(`✅ Webhook set to: ${webhookUrl}`);
      })
      .catch(err => {
        logger.error('❌ Failed to set webhook:', err);
      });
  }
  
  logger.info('Webhook handler registered');
};
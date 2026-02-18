const express = require('express');
const logger = require('../middleware/logger');

function createWebhookRouter(bot) {
  const router = express.Router();

  /* ================= TELEGRAM WEBHOOK ================= */
  router.post('/telegram', async (req, res) => {
    try {
      const update = req.body;

      // Pass update to bot
      await bot.processUpdate(update);

      res.sendStatus(200);
    } catch (error) {
      logger.error('Webhook processing error:', error);
      res.sendStatus(500);
    }
  });

  /* ================= HEALTH CHECK ================= */
  router.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'telegram-bot',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}

module.exports = createWebhookRouter;

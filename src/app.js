const express = require('express');
const bodyParser = require('body-parser');
const createWebhookRouter = require('./routes/webhookRoutes');
const logger = require('./middleware/logger');

function createApp(bot) {
  const app = express();

  /* ================= MIDDLEWARE ================= */
  app.use(bodyParser.json({
    limit: '10mb'
  }));

  app.use(bodyParser.urlencoded({
    extended: true
  }));

  /* ================= REQUEST LOGGING ================= */
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.originalUrl}`);
    next();
  });

  /* ================= ROUTES ================= */
  app.use('/webhook', createWebhookRouter(bot));

  /* ================= ROOT ================= */
  app.get('/', (req, res) => {
    res.status(200).json({
      message: 'Abuja Shortlet Apartment Bot is running 🚀'
    });
  });

  /* ================= 404 ================= */
  app.use((req, res) => {
    res.status(404).json({
      error: 'Route not found'
    });
  });

  return app;
}

module.exports = createApp;

require('dotenv').config();

const http = require('http');
const logger = require('./middleware/logger');
const config = require('./config/environment');

const { connectDatabase } = require('./config/db');
const createBot = require('./bot');
const createApp = require('./app');
const setupWebhook = require('./webhook');

/* ================= START APPLICATION ================= */
async function startApp() {
  try {
    // Database Connect
    await connectDatabase();
    logger.info('Database connected successfully');

    // Init Bot
    const bot = createBot();

    // Express App
    const app = createApp(bot);

    // Webhook Setup
    await setupWebhook(app, bot);

    // HTTP Server
    const PORT = process.env.PORT || 5000;
    const server = http.createServer(app);

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });

  } catch (error) {
    logger.error('Startup Error:', error);
    process.exit(1);
  }
}

startApp();

/* ================= GRACEFUL SHUTDOWN ================= */
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  process.exit(0);
});

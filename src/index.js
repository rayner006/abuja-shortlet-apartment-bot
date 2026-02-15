require('dotenv').config();
const express = require('express');
const logger = require('./middleware/logger');
const { connectDatabase } = require('./config/database');
const { connectRedis } = require('./config/redis');
const bot = require('./bot');
const config = require('./config/environment');

const app = express();
app.use(express.json());

// Import webhook handler
require('./webhook')(app, bot);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    bot: process.env.BOT_NAME || 'Abuja Shortlet Bot',
    environment: process.env.NODE_ENV
  });
});

// Import all handlers (they'll attach to bot)
require('./handlers/commands/start')(bot);
require('./handlers/commands/admin')(bot);
require('./handlers/commands/owner')(bot);
require('./handlers/commands/test')(bot);
require('./handlers/messages/locations')(bot);
require('./handlers/messages/apartmentTypes')(bot);
require('./handlers/messages/booking')(bot);
require('./handlers/messages/menu')(bot);
require('./handlers/callbacks/booking')(bot);
require('./handlers/callbacks/admin')(bot);
require('./handlers/callbacks/owner')(bot);
require('./handlers/callbacks/navigation')(bot);

// Schedule daily summary
const { scheduleDailySummary } = require('./services/schedulerService');
scheduleDailySummary();

async function start() {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('✅ Database connected');
    
    // Connect to Redis
    await connectRedis();
    logger.info('✅ Redis connected');
    
    // Start server
    const PORT = config.port;
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      
      // Log bot info
      bot.getMe().then(botInfo => {
        logger.info(`🤖 Bot @${botInfo.username} is running`);
      });
    });
    
  } catch (error) {
    logger.error('Failed to start:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown() {
  logger.info('Received shutdown signal, cleaning up...');
  
  try {
    await bot.stopPolling();
    logger.info('Bot polling stopped');
  } catch (err) {
    logger.error('Error stopping bot:', err);
  }
  
  process.exit(0);
}

start();
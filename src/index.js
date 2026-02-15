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

// Import all handlers with error handling
try {
  require('./handlers/commands/start')(bot);
  logger.info('✅ Loaded: start handler');
} catch (err) {
  logger.error('Failed to load start handler:', err.message);
}

try {
  require('./handlers/commands/admin')(bot);
  logger.info('✅ Loaded: admin handler');
} catch (err) {
  logger.error('Failed to load admin handler:', err.message);
}

try {
  require('./handlers/commands/owner')(bot);
  logger.info('✅ Loaded: owner handler');
} catch (err) {
  logger.error('Failed to load owner handler:', err.message);
}

try {
  require('./handlers/commands/test')(bot);
  logger.info('✅ Loaded: test handler');
} catch (err) {
  logger.error('Failed to load test handler:', err.message);
}

try {
  require('./handlers/messages/locations')(bot);
  logger.info('✅ Loaded: locations handler');
} catch (err) {
  logger.error('Failed to load locations handler:', err.message);
}

try {
  require('./handlers/messages/apartmentTypes')(bot);
  logger.info('✅ Loaded: apartmentTypes handler');
} catch (err) {
  logger.error('Failed to load apartmentTypes handler:', err.message);
}

try {
  require('./handlers/messages/booking')(bot);
  logger.info('✅ Loaded: booking handler');
} catch (err) {
  logger.error('Failed to load booking handler:', err.message);
}

try {
  require('./handlers/messages/menu')(bot);
  logger.info('✅ Loaded: menu handler');
} catch (err) {
  logger.error('Failed to load menu handler:', err.message);
}

try {
  require('./handlers/callbacks/booking')(bot);
  logger.info('✅ Loaded: booking callback handler');
} catch (err) {
  logger.error('Failed to load booking callback handler:', err.message);
}

try {
  require('./handlers/callbacks/admin')(bot);
  logger.info('✅ Loaded: admin callback handler');
} catch (err) {
  logger.error('Failed to load admin callback handler:', err.message);
}

try {
  require('./handlers/callbacks/owner')(bot);
  logger.info('✅ Loaded: owner callback handler');
} catch (err) {
  logger.error('Failed to load owner callback handler:', err.message);
}

try {
  require('./handlers/callbacks/navigation')(bot);
  logger.info('✅ Loaded: navigation callback handler');
} catch (err) {
  logger.error('Failed to load navigation callback handler:', err.message);
}

// Schedule daily summary
try {
  const { scheduleDailySummary } = require('./services/schedulerService');
  scheduleDailySummary();
  logger.info('✅ Daily summary scheduled');
} catch (err) {
  logger.error('Failed to schedule daily summary:', err.message);
}

async function start() {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('✅ Database connected');
    
    // Connect to Redis
    await connectRedis();
    logger.info('✅ Redis connected');
    
    // Start server
    const PORT = config.port || 3000;
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      
      // Log bot info
      bot.getMe().then(botInfo => {
        logger.info(`🤖 Bot @${botInfo.username} is running`);
      }).catch(err => {
        logger.error('Could not get bot info:', err.message);
      });
    });
    
  } catch (error) {
    logger.error('❌ Failed to start:', error);
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

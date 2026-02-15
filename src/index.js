require('dotenv').config();
const express = require('express');
const logger = require('./middleware/logger');
const { connectDatabase } = require('./config/database');
const { connectRedis } = require('./config/redis');
const bot = require('./bot');
const config = require('./config/environment');

// ========== GLOBAL ERROR HANDLERS (ADD THIS AT THE TOP) ==========
process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION:');
  console.error(error);
  console.error(error.stack);
  // Log to file if possible
  try {
    logger.error('UNCAUGHT EXCEPTION:', error);
  } catch (e) {}
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION:');
  console.error(reason);
  if (reason && reason.stack) console.error(reason.stack);
  // Log to file if possible
  try {
    logger.error('UNHANDLED REJECTION:', reason);
  } catch (e) {}
  process.exit(1);
});
// =============================================================

const app = express();
app.use(express.json());

// Import webhook handler
try {
  require('./webhook')(app, bot);
  console.log('✅ Webhook handler loaded');
} catch (err) {
  console.error('❌ Failed to load webhook:', err);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    bot: process.env.BOT_NAME || 'Abuja Shortlet Bot',
    environment: process.env.NODE_ENV
  });
});

// Import all handlers with detailed error logging
const handlers = [
  { name: 'start handler', path: './handlers/commands/start' },
  { name: 'admin handler', path: './handlers/commands/admin' },
  { name: 'owner handler', path: './handlers/commands/owner' },
  { name: 'test handler', path: './handlers/commands/test' },
  { name: 'locations handler', path: './handlers/messages/locations' },
  { name: 'apartmentTypes handler', path: './handlers/messages/apartmentTypes' },
  { name: 'booking handler', path: './handlers/messages/booking' },
  { name: 'menu handler', path: './handlers/messages/menu' },
  { name: 'booking callback handler', path: './handlers/callbacks/booking' },
  { name: 'admin callback handler', path: './handlers/callbacks/admin' },
  { name: 'owner callback handler', path: './handlers/callbacks/owner' },
  { name: 'navigation callback handler', path: './handlers/callbacks/navigation' }
];

handlers.forEach(handler => {
  try {
    require(handler.path)(bot);
    console.log(`✅ Loaded: ${handler.name}`);
  } catch (err) {
    console.error(`❌ Failed to load ${handler.name}:`, err);
    console.error(err.stack);
  }
});

// Schedule daily summary
try {
  const { scheduleDailySummary } = require('./services/schedulerService');
  scheduleDailySummary();
  console.log('✅ Daily summary scheduled');
} catch (err) {
  console.error('❌ Failed to schedule daily summary:', err);
}

async function start() {
  try {
    console.log('📡 Connecting to database...');
    await connectDatabase();
    console.log('✅ Database connected');
    
    console.log('📡 Connecting to Redis...');
    await connectRedis();
    console.log('✅ Redis connected');
    
    // Start server
    const PORT = config.port || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      
      // Log bot info
      bot.getMe().then(botInfo => {
        console.log(`🤖 Bot @${botInfo.username} is running`);
        console.log(`🌐 Environment: ${config.nodeEnv}`);
      }).catch(err => {
        console.error('Could not get bot info:', err);
      });
    });
    
  } catch (error) {
    console.error('❌ FAILED TO START:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function shutdown() {
  console.log('Received shutdown signal, cleaning up...');
  
  try {
    await bot.stopPolling();
    console.log('Bot polling stopped');
  } catch (err) {
    console.error('Error stopping bot:', err);
  }
  
  process.exit(0);
}

// START THE BOT
console.log('🚀 Starting bot...');
start();

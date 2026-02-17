require('dotenv').config();

const express = require('express');
const { Sequelize } = require('sequelize');
const Redis = require('ioredis');
const logger = require('./middleware/logger');

// ================= INIT EXPRESS =================
const app = express();
app.use(express.json());

// ================= DATABASE =================
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    logging: false,
  }
);

// ================= REDIS =================
const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
});

// ================= TELEGRAM BOT =================
const initBot = require('./bot');

// ================= HEALTH ROUTE =================
app.get('/', (req, res) => {
  res.send('Abuja Apartment Bot is running...');
});

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;

async function startApp() {
  try {
    // DB Connect
    await sequelize.authenticate();
    logger.info('Database connected successfully');

    // Redis Connect
    await redis.ping();
    logger.info('Redis connected successfully');

    // Start Bot
    initBot(redis, sequelize);

    // Express Server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });

  } catch (error) {
    logger.error('Startup Error:', error);
    process.exit(1);
  }
}

startApp();

// ================= GRACEFUL SHUTDOWN =================
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  await sequelize.close();
  redis.disconnect();
  process.exit(0);
});


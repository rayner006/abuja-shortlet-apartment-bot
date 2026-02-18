const Redis = require('ioredis');
const logger = require('../middleware/logger');

let client;

function connectRedis() {
  if (client) return client;

  const redisConfig = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 2000);
      return delay;
    }
  };

  client = new Redis(redisConfig);

  client.on('connect', () => {
    logger.info('✅ Redis connected');
  });

  client.on('ready', () => {
    logger.info('🚀 Redis ready');
  });

  client.on('error', (err) => {
    logger.error('❌ Redis error:', err.message);
  });

  client.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return client;
}

function getRedis() {
  if (!client) {
    throw new Error('Redis not initialized. Call connectRedis first.');
  }
  return client;
}

async function disconnectRedis() {
  if (client) {
    await client.quit();
    client = null;
    logger.info('Redis disconnected');
  }
}

module.exports = {
  connectRedis,
  getRedis,
  disconnectRedis
};

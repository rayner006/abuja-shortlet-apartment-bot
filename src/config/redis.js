// src/config/redis.js
const Redis = require('ioredis');
require('dotenv').config();

// Railway provides these environment variables automatically
const redisConfig = {
  host: process.env.REDISHOST || 'localhost',
  port: parseInt(process.env.REDISPORT) || 6379,
  password: process.env.REDISPASSWORD,
  username: process.env.REDISUSER || 'default',
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
};

// Add TLS if required (some Railway Redis instances need this)
if (process.env.REDIS_TLS === 'true') {
  redisConfig.tls = {};
}

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  console.log('✅ Redis connected successfully to', redisConfig.host);
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
});

module.exports = redis;

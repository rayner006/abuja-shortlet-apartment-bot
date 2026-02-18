// config/redis.js
const Redis = require('ioredis');

let redis = null;

try {
  if (process.env.REDIS_URL) {
    // Railway / Production
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    redis.on('connect', () => {
      console.log('✅ Redis connected');
    });

    redis.on('error', (err) => {
      console.error('❌ Redis error:', err.message);
    });

  } else {
    // Local fallback (optional)
    console.log('⚠️ REDIS_URL not found. Redis disabled.');
  }
} catch (err) {
  console.error('❌ Redis init failed:', err.message);
}

module.exports = redis;

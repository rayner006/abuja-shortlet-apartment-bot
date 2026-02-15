const Redis = require('ioredis');
const config = require('./environment');
const logger = require('../middleware/logger');

let redisClient;

function connectRedis() {
  return new Promise((resolve, reject) => {
    if (!config.redisUrl) {
      logger.warn('⚠️ Redis URL not provided, using in-memory fallback');
      redisClient = createMemoryFallback();
      return resolve(redisClient);
    }
    
    // CRITICAL: Add family=0 for Railway private networking
    const connectionUrl = config.redisUrl.includes('?') 
      ? `${config.redisUrl}&family=0` 
      : `${config.redisUrl}?family=0`;
    
    redisClient = new Redis(connectionUrl, {
      family: 0,  // ← CRITICAL for Railway
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });
    
    redisClient.on('connect', () => {
      logger.info('✅ Redis connected via private network');
      resolve(redisClient);
    });
    
    redisClient.on('error', (err) => {
      logger.error('❌ Redis error:', err);
      reject(err);
    });
  });
}

function createMemoryFallback() {
  const store = new Map();
  return {
    async get(key) {
      const item = store.get(key);
      if (!item) return null;
      if (item.expiry && item.expiry < Date.now()) {
        store.delete(key);
        return null;
      }
      return item.value;
    },
    async set(key, value, ...args) {
      let ttl = null;
      if (args.includes('PX')) {
        const idx = args.indexOf('PX');
        if (idx !== -1 && idx + 1 < args.length) ttl = parseInt(args[idx + 1]);
      } else if (args.includes('EX')) {
        const idx = args.indexOf('EX');
        if (idx !== -1 && idx + 1 < args.length) ttl = parseInt(args[idx + 1]) * 1000;
      }
      store.set(key, { value, expiry: ttl ? Date.now() + ttl : null });
      return 'OK';
    },
    async setex(key, seconds, value) {
      store.set(key, { value, expiry: Date.now() + (seconds * 1000) });
      return 'OK';
    },
    async del(...keys) {
      let count = 0;
      keys.forEach(key => { if (store.delete(key)) count++; });
      return count;
    },
    async ping() { return 'PONG'; },
    quit() { store.clear(); }
  };
}

function getRedis() {
  if (!redisClient) throw new Error('Redis not initialized');
  return redisClient;
}

// ✅ MAKE SURE THESE ARE EXPORTED CORRECTLY
module.exports = { 
  connectRedis,  // ← This must be here!
  getRedis 
};

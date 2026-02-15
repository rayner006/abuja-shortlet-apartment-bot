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
    
    // ✅ CRITICAL: Add family=0 for IPv4/IPv6 dual-stack support
    // Railway private networking requires this for Redis! [citation:1][citation:4]
    const redisOptions = {
      family: 0,  // 0 = try both IPv4 and IPv6, let the system decide
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      lazyConnect: true
    };
    
    // Append family=0 to connection string or use options
    const connectionUrl = config.redisUrl.includes('?') 
      ? `${config.redisUrl}&family=0` 
      : `${config.redisUrl}?family=0`;
    
    redisClient = new Redis(connectionUrl, redisOptions);
    
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

// ... rest of your code

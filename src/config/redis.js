// src/config/redis.js - Railway Optimized Version (No .env needed)
const Redis = require('ioredis');

console.log('🔌 Initializing Redis connection...');
console.log('Environment variables available:', Object.keys(process.env).filter(k => k.includes('REDIS')));

// Railway provides these variables automatically when services are linked
const redisConfig = {
  // Try REDIS_URL first (most common)
  ...(process.env.REDIS_URL ? { 
    host: new URL(process.env.REDIS_URL).hostname,
    port: parseInt(new URL(process.env.REDIS_URL).port) || 6379,
    password: new URL(process.env.REDIS_URL).password ? decodeURIComponent(new URL(process.env.REDIS_URL).password) : null,
    username: new URL(process.env.REDIS_URL).username || 'default'
  } : {
    // Fall back to individual variables
    host: process.env.REDISHOST,
    port: parseInt(process.env.REDISPORT) || 6379,
    password: process.env.REDISPASSWORD,
    username: process.env.REDISUSER || 'default'
  }),
  family: 4, // Force IPv4
  retryStrategy: (times) => {
    const delay = Math.min(times * 1000, 10000);
    console.log(`🔄 Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
  maxRetriesPerRequest: 5,
  enableReadyCheck: true,
  connectTimeout: 10000
};

console.log('📊 Redis configuration loaded from Railway environment');
console.log('Host:', redisConfig.host);
console.log('Port:', redisConfig.port);
console.log('Username:', redisConfig.username);

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  console.log('✅ Redis: Connection established to Railway');
});

redis.on('ready', () => {
  console.log('✅ Redis: Ready to accept commands');
  
  // Test the connection
  redis.ping().then(() => {
    console.log('✅ Redis: Ping successful');
  }).catch(err => {
    console.error('❌ Redis: Ping failed:', err.message);
  });
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
  console.log('   Please verify your Redis service is linked to this app');
  console.log('   Check Railway dashboard → Variables tab for:');
  console.log('   - REDISHOST, REDISPORT, REDISPASSWORD');
  console.log('   - or REDIS_URL');
});

redis.on('close', () => {
  console.log('⚠️ Redis: Connection closed');
});

module.exports = redis;

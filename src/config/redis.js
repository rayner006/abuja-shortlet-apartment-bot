// src/config/redis.js - Railway Optimized Version
const Redis = require('ioredis');
require('dotenv').config();

console.log('🔌 Initializing Redis connection...');

// Check if we have Redis variables
if (!process.env.REDISHOST && !process.env.REDIS_URL) {
  console.error('❌ No Redis configuration found in environment variables!');
  console.log('📝 Please add REDISHOST, REDISPORT, and REDISPASSWORD to your .env file');
  console.log('   Or use REDIS_URL from Railway dashboard');
  process.exit(1); // Exit if no Redis config - since you don't want to disable
}

// Method 1: Using REDIS_URL (most common on Railway)
let redis;
if (process.env.REDIS_URL) {
  console.log('🔗 Using REDIS_URL connection');
  redis = new Redis(process.env.REDIS_URL, {
    retryStrategy: (times) => {
      const delay = Math.min(times * 1000, 10000);
      console.log(`🔄 Redis reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
    maxRetriesPerRequest: 5
  });
} 
// Method 2: Using individual host/port/password
else {
  console.log('🔗 Using individual Redis connection parameters');
  console.log(`   Host: ${process.env.REDISHOST}`);
  console.log(`   Port: ${process.env.REDISPORT}`);
  
  redis = new Redis({
    host: process.env.REDISHOST,
    port: parseInt(process.env.REDISPORT) || 6379,
    password: process.env.REDISPASSWORD,
    username: process.env.REDISUSER || 'default',
    retryStrategy: (times) => {
      const delay = Math.min(times * 1000, 10000);
      console.log(`🔄 Redis reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
    maxRetriesPerRequest: 5,
    enableReadyCheck: true,
    lazyConnect: false
  });
}

// Connection event handlers
redis.on('connect', () => {
  console.log('✅ Redis: Connection established');
});

redis.on('ready', () => {
  console.log('✅ Redis: Ready to accept commands');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
  console.log('   Please verify your Redis credentials from Railway dashboard');
  console.log('   REDISHOST:', process.env.REDISHOST || 'not set');
  console.log('   REDISPORT:', process.env.REDISPORT || 'not set');
  console.log('   REDIS_URL:', process.env.REDIS_URL ? 'set' : 'not set');
});

redis.on('close', () => {
  console.log('⚠️ Redis: Connection closed');
});

redis.on('reconnecting', (delay) => {
  console.log(`🔄 Redis: Reconnecting in ${delay}ms...`);
});

// Test the connection immediately
(async () => {
  try {
    await redis.ping();
    console.log('✅ Redis: Ping successful');
    
    // Test set/get
    await redis.set('test_key', 'connected');
    const test = await redis.get('test_key');
    console.log('✅ Redis: Read/write test successful:', test);
    await redis.del('test_key');
    
  } catch (error) {
    console.error('❌ Redis: Initial connection test failed:', error.message);
  }
})();

module.exports = redis;

const { getRedis } = require('../config/redis');
const logger = require('./logger');

class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60 * 1000; // 1 minute default
    this.max = options.max || 30; // 30 requests per window default
    this.keyPrefix = options.keyPrefix || 'ratelimit:';
    this.useRedis = options.useRedis !== false;
  }
  
  async check(chatId) {
    const key = `${this.keyPrefix}${chatId}`;
    
    try {
      if (this.useRedis) {
        const redis = getRedis();
        const current = await redis.incr(key);
        
        if (current === 1) {
          await redis.expire(key, Math.ceil(this.windowMs / 1000));
        }
        
        return {
          limited: current > this.max,
          remaining: Math.max(0, this.max - current),
          reset: await redis.ttl(key)
        };
      } else {
        // In-memory fallback
        if (!this.memoryStore) {
          this.memoryStore = new Map();
        }
        
        const now = Date.now();
        const record = this.memoryStore.get(key);
        
        if (!record) {
          this.memoryStore.set(key, {
            count: 1,
            resetTime: now + this.windowMs
          });
          
          setTimeout(() => {
            this.memoryStore.delete(key);
          }, this.windowMs);
          
          return { limited: false, remaining: this.max - 1, reset: this.windowMs / 1000 };
        }
        
        if (now > record.resetTime) {
          this.memoryStore.delete(key);
          return this.check(chatId);
        }
        
        record.count++;
        
        return {
          limited: record.count > this.max,
          remaining: Math.max(0, this.max - record.count),
          reset: Math.ceil((record.resetTime - now) / 1000)
        };
      }
    } catch (error) {
      logger.error('Rate limiter error:', error);
      // Fail open
      return { limited: false, remaining: 1, reset: 0 };
    }
  }
  
  middleware() {
    return async (ctx, next) => {
      const chatId = ctx.chat?.id || ctx.from?.id;
      
      if (!chatId) {
        return next();
      }
      
      const result = await this.check(chatId);
      
      if (result.limited) {
        logger.warn(`Rate limit exceeded for chat ${chatId}`);
        
        await ctx.reply(`⏱️ Too many requests. Please wait ${result.reset} seconds.`);
        return;
      }
      
      return next();
    };
  }
}

module.exports = RateLimiter;
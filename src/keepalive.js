// src/keepalive.js
const logger = require('./config/logger');

// Simple keep-alive that logs every minute
const startKeepAlive = () => {
  setInterval(() => {
    logger.debug('Bot is still running, uptime: ' + Math.floor(process.uptime() / 60) + ' minutes');
  }, 60000);
  
  // Also log memory usage every 5 minutes
  setInterval(() => {
    const memoryUsage = process.memoryUsage();
    logger.info(`Memory usage - RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB, Heap: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
  }, 300000);
};

module.exports = { startKeepAlive };

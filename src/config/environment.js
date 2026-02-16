require('dotenv').config();

// TEMPORARY DEBUG - ADD THIS BLOCK
console.log('🔍 RAW ENVIRONMENT VARIABLES CHECK:');
console.log('DB_NAME from process.env:', process.env.DB_NAME ? `"${process.env.DB_NAME}"` : '❌ UNDEFINED');
console.log('DB_HOST from process.env:', process.env.DB_HOST ? '✅ Set' : '❌ UNDEFINED');
console.log('DB_USER from process.env:', process.env.DB_USER ? '✅ Set' : '❌ UNDEFINED');
console.log('====================================');

const nodeEnv = process.env.NODE_ENV || 'development';

const config = {
  development: {
    nodeEnv: 'development',
    botToken: process.env.BOT_TOKEN,
    botName: process.env.BOT_NAME || 'Abuja Shortlet Bot',
    port: process.env.PORT || 3000,
    webhookUrl: null,
    database: {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectionLimit: 10
    },
    redisUrl: process.env.REDIS_URL,
    adminIds: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [6947618479],
    commissionRate: 0.1
  },
  
  production: {
    nodeEnv: 'production',
    botToken: process.env.BOT_TOKEN,
    botName: process.env.BOT_NAME || 'Abuja Shortlet Bot',
    port: process.env.PORT || 3000,
    webhookUrl: process.env.RAILWAY_STATIC_URL || process.env.WEBHOOK_URL,
    database: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectionLimit: 20
    },
    redisUrl: process.env.REDIS_URL,
    adminIds: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [],
    commissionRate: 0.1
  }
};


module.exports = config[nodeEnv];

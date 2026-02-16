require('dotenv').config();

console.log('🚀 BOT STARTING...');
console.log('🔍 Checking environment variables:');
console.log('NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('DB_NAME from env:', process.env.DB_NAME ? '✅ present' : '❌ missing');
console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? '✅ present' : '❌ missing');

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
      database: 'railway', // Hardcoded
      connectionLimit: 10
    },
    redisUrl: process.env.REDIS_URL,
    adminIds: process.env.ADMIN_IDS 
      ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) 
      : [6947618479],
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
      database: 'railway', // Hardcoded
      connectionLimit: 20
    },
    redisUrl: process.env.REDIS_URL,
    adminIds: process.env.ADMIN_IDS 
      ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) 
      : [],
    commissionRate: 0.1
  }
};

console.log('✅ Using environment:', nodeEnv);
console.log('✅ Database name:', config[nodeEnv].database.database);

module.exports = config[nodeEnv];

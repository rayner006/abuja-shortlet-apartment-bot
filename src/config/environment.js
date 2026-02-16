const path = require('path');
require('dotenv').config();

// ========== ENHANCED DEBUGGING ==========
console.log('🚀 BOT STARTING...');
console.log('========== ENVIRONMENT DEBUG ==========');
console.log('1. All process.env keys:', Object.keys(process.env).sort());
console.log('2. DB_NAME raw value:', process.env.DB_NAME ? `"${process.env.DB_NAME}"` : '❌ UNDEFINED');
console.log('3. MYSQL_DATABASE raw value:', process.env.MYSQL_DATABASE ? `"${process.env.MYSQL_DATABASE}"` : '❌ UNDEFINED');
console.log('4. DB_HOST raw value:', process.env.DB_HOST ? `"${process.env.DB_HOST}"` : '❌ UNDEFINED');
console.log('5. NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('6. Current working directory:', process.cwd());
console.log('7. __dirname:', __dirname);
console.log('=======================================');

const nodeEnv = process.env.NODE_ENV || 'development';

console.log('🔍 Environment check:');
console.log('NODE_ENV:', nodeEnv);
console.log('DB_NAME from env:', process.env.DB_NAME ? '✅ present' : '❌ missing');
console.log('DB_HOST from env:', process.env.DB_HOST ? '✅ present' : '❌ missing');
console.log('DB_USER from env:', process.env.DB_USER ? '✅ present' : '❌ missing');
console.log('BOT_TOKEN:', process.env.BOT_TOKEN ? '✅ present' : '❌ missing');

// Check if .env file exists and is being read
try {
  const fs = require('fs');
  const envPath = path.join(process.cwd(), '.env');
  console.log('8. .env file exists:', fs.existsSync(envPath) ? '✅ YES' : '❌ NO');
  if (fs.existsSync(envPath)) {
    console.log('9. .env file size:', fs.statSync(envPath).size, 'bytes');
    console.log('10. .env file content preview:', fs.readFileSync(envPath, 'utf8').substring(0, 200).replace(/\n/g, '\\n'));
  }
} catch (e) {
  console.log('8. Error checking .env file:', e.message);
}

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
      connectionLimit: 10,
      port: process.env.DB_PORT || 3306
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
      database: process.env.DB_NAME,
      connectionLimit: 20,
      port: process.env.DB_PORT || 3306
    },
    redisUrl: process.env.REDIS_URL,
    adminIds: process.env.ADMIN_IDS 
      ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) 
      : [],
    commissionRate: 0.1
  }
};

console.log('✅ Using environment:', nodeEnv);
console.log('✅ Database name:', config[nodeEnv].database.database || '❌ EMPTY');
console.log('✅ Database host:', config[nodeEnv].database.host || '❌ EMPTY');
console.log('✅ Database user:', config[nodeEnv].database.user ? '✅ set' : '❌ missing');
console.log('✅ Database port:', config[nodeEnv].database.port);

module.exports = config[nodeEnv];

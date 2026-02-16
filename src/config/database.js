const mysql = require('mysql2/promise');
const config = require('./environment');
const logger = require('../middleware/logger');

// TEMPORARY DEBUG - ADD THIS BLOCK
console.log('🔍 DATABASE CONFIG CHECK:');
console.log('config.database.database:', config.database.database ? `"${config.database.database}"` : '❌ UNDEFINED');
console.log('config.database.host:', config.database.host ? '✅ Set' : '❌ UNDEFINED');
console.log('====================================');

let pool;

async function connectDatabase() {
  try {
    // Log database config (without password)
    logger.info('📡 Connecting to database with:', {
      host: config.database.host,
      user: config.database.user,
      database: config.database.database || '❌ NOT SET',
      port: config.database.port,
      connectionLimit: config.database.connectionLimit
    });

    // Check if database name is missing
    if (!config.database.database) {
      logger.error('❌ DB_NAME is missing! Please set DB_NAME in Railway variables');
      throw new Error('Database name not configured');
    }

    pool = mysql.createPool(config.database);
    
    // Test the connection
    const connection = await pool.getConnection();
    logger.info('✅ Database pool created successfully');
    
    // Test a simple query to verify database is selected
    const [result] = await connection.query('SELECT DATABASE() as db_name');
    logger.info(`✅ Connected to database: ${result[0].db_name}`);
    
    connection.release();
    return pool;
    
  } catch (error) {
    logger.error('❌ Database connection failed:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState
    });
    throw error;
  }
}

function getPool() {
  if (!pool) {
    throw new Error('Database not initialized. Call connectDatabase first.');
  }
  return pool;
}

async function executeQuery(query, params, retries = 3) {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      const [rows] = await getPool().execute(query, params);
      return rows;
    } catch (err) {
      lastError = err;
      
      // Log detailed error information
      logger.warn(`Query attempt ${i + 1} failed:`, {
        message: err.message,
        code: err.code,
        errno: err.errno,
        sqlState: err.sqlState,
        sql: query.substring(0, 100) + '...' // Log first 100 chars of query
      });
      
      if (err.message.includes('No database selected')) {
        logger.error('❌ CRITICAL: No database selected! Check your DB_NAME variable in Railway');
        throw err; // Don't retry if database is missing
      }
      
      if (i < retries - 1) {
        const delay = 1000 * Math.pow(2, i);
        logger.info(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  logger.error('All query attempts failed:', lastError);
  throw lastError;
}

module.exports = { connectDatabase, getPool, executeQuery };


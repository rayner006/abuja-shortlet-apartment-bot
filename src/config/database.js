const mysql = require('mysql2/promise');
const config = require('./environment');
const logger = require('../middleware/logger');

let pool;

async function connectDatabase() {
  try {
    pool = mysql.createPool(config.database);
    const connection = await pool.getConnection();
    logger.info('✅ Database pool created');
    connection.release();
    return pool;
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
}

function getPool() {
  if (!pool) throw new Error('Database not initialized');
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
      logger.warn(`Query attempt ${i + 1} failed:`, err.message);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  }
  
  logger.error('All query attempts failed:', lastError);
  throw lastError;
}

module.exports = { connectDatabase, getPool, executeQuery };
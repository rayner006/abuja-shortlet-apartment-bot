const { executeQuery } = require('../config/database');
const logger = require('../middleware/logger');

class Owner {
  static async findAll() {
    const query = 'SELECT id, business_name as name, telegram_chat_id, subscription_status, subscription_expiry FROM property_owners';
    try {
      return await executeQuery(query);
    } catch (err) {
      logger.error('Error loading owners:', err);
      return [];
    }
  }
  
  static async findById(id) {
    const query = 'SELECT * FROM property_owners WHERE id = ?';
    try {
      const rows = await executeQuery(query, [id]);
      return rows[0] || null;
    } catch (err) {
      logger.error(`Error finding owner ${id}:`, err);
      return null;
    }
  }
  
  static async registerChatId(ownerId, chatId) {
    const query = 'UPDATE property_owners SET telegram_chat_id = ? WHERE id = ?';
    try {
      const result = await executeQuery(query, [chatId, ownerId]);
      return result.affectedRows > 0;
    } catch (err) {
      logger.error('Error registering owner chat ID:', err);
      return false;
    }
  }
  
  static async addSubscription(ownerId, endDate, amount) {
    const startDate = new Date().toISOString().split('T')[0];
    
    const insertQuery = `
      INSERT INTO owner_subscriptions 
      (owner_id, owner_name, subscription_start, subscription_end, amount, payment_status) 
      SELECT ?, business_name, ?, ?, ?, 'paid'
      FROM property_owners WHERE id = ?
    `;
    
    try {
      await executeQuery(insertQuery, [ownerId, startDate, endDate, amount, ownerId]);
      
      const updateQuery = `
        UPDATE property_owners 
        SET subscription_status = 'active', subscription_expiry = ? 
        WHERE id = ?
      `;
      await executeQuery(updateQuery, [endDate, ownerId]);
      
      return true;
    } catch (err) {
      logger.error('Error adding subscription:', err);
      return false;
    }
  }
  
  static async checkSubscription(ownerId) {
    const query = `
      SELECT o.business_name as name, o.subscription_status, o.subscription_expiry, 
             COUNT(s.id) as total_payments,
             SUM(s.amount) as total_paid
      FROM property_owners o
      LEFT JOIN owner_subscriptions s ON o.id = s.owner_id
      WHERE o.id = ?
      GROUP BY o.id
    `;
    try {
      const rows = await executeQuery(query, [ownerId]);
      return rows[0] || null;
    } catch (err) {
      logger.error('Error checking subscription:', err);
      return null;
    }
  }
  
  static async getExpiredSubscriptions() {
    const today = new Date().toISOString().split('T')[0];
    const query = `
      SELECT id, business_name as name, subscription_expiry 
      FROM property_owners 
      WHERE subscription_expiry < ? OR subscription_status = 'expired'
    `;
    try {
      return await executeQuery(query, [today]);
    } catch (err) {
      logger.error('Error fetching expired subscriptions:', err);
      return [];
    }
  }
  
  static async getStats() {
    const queries = [
      `SELECT COUNT(*) as total FROM property_owners`,
      `SELECT COUNT(*) as expired FROM property_owners WHERE subscription_expiry < CURDATE() OR subscription_status = 'expired'`
    ];
    
    try {
      const [totalResult, expiredResult] = await Promise.all([
        executeQuery(queries[0]),
        executeQuery(queries[1])
      ]);
      
      return {
        total: totalResult[0]?.total || 0,
        expired: expiredResult[0]?.expired || 0,
        active: (totalResult[0]?.total || 0) - (expiredResult[0]?.expired || 0)
      };
    } catch (err) {
      logger.error('Error getting owner stats:', err);
      return { total: 0, expired: 0, active: 0 };
    }
  }
}

module.exports = Owner;
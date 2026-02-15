const { executeQuery } = require('../config/database');
const logger = require('../middleware/logger');
const config = require('../config/environment');

class User {
  static async saveUserInfo(msg) {
    const telegramId = msg.from.id;
    const name = msg.from.first_name || '';
    const username = msg.from.username || '';
    const languageCode = msg.from.language_code || 'en';
    const isBot = msg.from.is_bot ? 1 : 0;
    
    let role = 'user';
    if (config.adminIds.includes(telegramId)) role = 'admin';
    
    const query = `
      INSERT INTO users (telegram_id, name, username, language_code, is_bot, role, first_seen, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        username = VALUES(username),
        language_code = VALUES(language_code),
        is_bot = VALUES(is_bot),
        role = VALUES(role),
        last_seen = NOW()
    `;
    
    try {
      await executeQuery(query, [telegramId, name, username, languageCode, isBot, role]);
      return true;
    } catch (err) {
      logger.error('Error saving user:', err);
      return false;
    }
  }
  
  static async incrementBookings(telegramId) {
    const query = 'UPDATE users SET total_bookings = total_bookings + 1 WHERE telegram_id = ?';
    try {
      await executeQuery(query, [telegramId]);
      return true;
    } catch (err) {
      logger.error('Error incrementing bookings:', err);
      return false;
    }
  }
  
  static async findByTelegramId(telegramId) {
    const query = 'SELECT * FROM users WHERE telegram_id = ?';
    try {
      const rows = await executeQuery(query, [telegramId]);
      return rows[0] || null;
    } catch (err) {
      logger.error('Error finding user:', err);
      return null;
    }
  }
}

module.exports = User;
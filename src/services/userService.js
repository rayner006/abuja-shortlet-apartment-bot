const db = require('../config/db');
const logger = require('../middleware/logger');

class UserService {
  /* ================= FIND BY TELEGRAM ID ================= */
  static async findByTelegramId(telegramId) {
    try {
      const [rows] = await db.query(
        `SELECT * FROM users WHERE telegram_id = ? LIMIT 1`,
        [telegramId]
      );

      return rows[0] || null;
    } catch (error) {
      logger.error('Error finding user by Telegram ID:', error);
      throw error;
    }
  }

  /* ================= CREATE USER ================= */
  static async create(data) {
    try {
      const {
        telegram_id,
        username,
        first_name,
        last_name,
        role = 'user' // user | owner | admin
      } = data;

      const [result] = await db.query(
        `INSERT INTO users 
        (telegram_id, username, first_name, last_name, role)
        VALUES (?, ?, ?, ?, ?)`,
        [
          telegram_id,
          username || null,
          first_name || null,
          last_name || null,
          role
        ]
      );

      return result.insertId;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  /* ================= FIND OR CREATE ================= */
  static async findOrCreate(telegramUser) {
    try {
      const existing = await this.findByTelegramId(telegramUser.id);
      if (existing) return existing;

      const userId = await this.create({
        telegram_id: telegramUser.id,
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name
      });

      return {
        id: userId,
        telegram_id: telegramUser.id,
        username: telegramUser.username,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
        role: 'user'
      };
    } catch (error) {
      logger.error('Error in findOrCreate:', error);
      throw error;
    }
  }

  /* ================= UPDATE ROLE ================= */
  static async updateRole(userId, role) {
    try {
      await db.query(
        `UPDATE users SET role = ? WHERE id = ?`,
        [role, userId]
      );
    } catch (error) {
      logger.error('Error updating user role:', error);
      throw error;
    }
  }

  /* ================= GET OWNERS ================= */
  static async getOwners() {
    try {
      const [rows] = await db.query(
        `SELECT * FROM users WHERE role = 'owner'`
      );
      return rows;
    } catch (error) {
      logger.error('Error fetching owners:', error);
      throw error;
    }
  }

  /* ================= GET ADMINS ================= */
  static async getAdmins() {
    try {
      const [rows] = await db.query(
        `SELECT * FROM users WHERE role = 'admin'`
      );
      return rows;
    } catch (error) {
      logger.error('Error fetching admins:', error);
      throw error;
    }
  }

  /* ================= UPDATE PROFILE ================= */
  static async updateProfile(userId, data) {
    try {
      const fields = [];
      const values = [];

      for (const key in data) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }

      values.push(userId);

      await db.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    } catch (error) {
      logger.error('Error updating user profile:', error);
      throw error;
    }
  }
}

module.exports = UserService;

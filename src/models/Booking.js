const { executeQuery } = require('../config/database');
const { COMMISSION_RATE } = require('../config/constants');
const logger = require('../middleware/logger');

class Booking {
  static async create(bookingData) {
    const {
      apartmentId, userId, amount, bookingCode,
      accessPin, userName, username, phone
    } = bookingData;
    
    const commission = amount * COMMISSION_RATE;
    
    const query = `
      INSERT INTO bookings (
        apartment_id, user_id, amount, commission, 
        booking_code, status, access_pin, pin_used,
        user_name, username, phone, created_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?, ?, NOW())
    `;
    
    try {
      const result = await executeQuery(query, [
        apartmentId, userId, amount, commission,
        bookingCode, accessPin, userName, username, phone
      ]);
      logger.info('Booking created', { bookingId: result.insertId, bookingCode });
      return result.insertId;
    } catch (error) {
      logger.error('Error creating booking:', error);
      throw error;
    }
  }
  
  static async findByCode(bookingCode) {
    const query = `
      SELECT b.*, a.owner_id, a.price, a.name as apartment_name,
             a.location, a.type
      FROM bookings b
      JOIN apartments a ON b.apartment_id = a.id
      WHERE b.booking_code = ?
    `;
    try {
      const rows = await executeQuery(query, [bookingCode]);
      return rows[0];
    } catch (error) {
      logger.error('Error finding booking:', error);
      throw error;
    }
  }
  
  static async confirmByOwner(bookingCode, confirmedBy) {
    const query = `
      UPDATE bookings 
      SET status = 'confirmed', 
          owner_confirmed = 1, 
          owner_confirmed_at = NOW(),
          confirmed_by = ?
      WHERE booking_code = ? AND status = 'pending'
    `;
    try {
      const result = await executeQuery(query, [confirmedBy, bookingCode]);
      return result.affectedRows > 0;
    } catch (error) {
      logger.error('Error confirming booking:', error);
      throw error;
    }
  }
  
  static async completeWithPin(bookingCode, pin) {
    const query = `
      UPDATE bookings 
      SET pin_used = 1, 
          tenant_confirmed_at = NOW(),
          status = 'completed'
      WHERE booking_code = ? AND access_pin = ? AND pin_used = 0
    `;
    try {
      const result = await executeQuery(query, [bookingCode, pin]);
      return result.affectedRows > 0;
    } catch (error) {
      logger.error('Error completing booking:', error);
      throw error;
    }
  }
  
  static async getDailySummary(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const query = `
      SELECT 
        COUNT(*) as total_bookings,
        SUM(amount) as total_revenue,
        SUM(commission) as total_commission
      FROM bookings 
      WHERE created_at BETWEEN ? AND ?
    `;
    try {
      const rows = await executeQuery(query, [
        startOfDay.toISOString().slice(0, 19).replace('T', ' '),
        endOfDay.toISOString().slice(0, 19).replace('T', ' ')
      ]);
      return rows[0] || { total_bookings: 0, total_revenue: 0, total_commission: 0 };
    } catch (error) {
      logger.error('Error getting daily summary:', error);
      throw error;
    }
  }
  
  static async getRecentBookings(days = 30) {
    const query = 'SELECT COUNT(*) as count FROM bookings WHERE created_at > DATE_SUB(NOW(), INTERVAL ? DAY)';
    try {
      const rows = await executeQuery(query, [days]);
      return rows[0]?.count || 0;
    } catch (error) {
      logger.error('Error getting recent bookings:', error);
      return 0;
    }
  }
}

module.exports = Booking;
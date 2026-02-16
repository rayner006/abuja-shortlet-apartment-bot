const { executeQuery } = require('../config/database');
const logger = require('../middleware/logger');

class Booking {
  static async create(bookingData) {
    const query = `
      INSERT INTO bookings (
        apartment_id, user_id, user_name, phone, 
        start_date, end_date, total_days, amount, status, booking_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    // Generate a simple booking code
    const bookingCode = 'BOOK' + Math.floor(100000 + Math.random() * 900000);
    
    const values = [
      bookingData.apartmentId,
      bookingData.chatId,           // maps to user_id
      bookingData.guestName,         // maps to user_name
      bookingData.guestPhone,         // maps to phone
      bookingData.startDate,
      bookingData.endDate,
      bookingData.totalDays,
      bookingData.totalAmount,        // maps to amount
      'pending',                      // status
      bookingCode
    ];
    
    try {
      const result = await executeQuery(query, values);
      const insertId = result.insertId;
      
      const [newBooking] = await executeQuery('SELECT * FROM bookings WHERE id = ?', [insertId]);
      return newBooking;
      
    } catch (error) {
      logger.error('Error creating booking:', error);
      throw error;
    }
  }
  
  static async findById(id) {
    const query = 'SELECT * FROM bookings WHERE id = ?';
    try {
      const rows = await executeQuery(query, [id]);
      return rows[0] || null;
    } catch (error) {
      logger.error('Error finding booking:', error);
      throw error;
    }
  }
  
  static async findByCode(bookingCode) {
    const query = 'SELECT * FROM bookings WHERE booking_code = ?';
    try {
      const rows = await executeQuery(query, [bookingCode]);
      return rows[0] || null;
    } catch (error) {
      logger.error('Error finding booking by code:', error);
      throw error;
    }
  }
  
  static async updateStatus(bookingId, status) {
    const query = 'UPDATE bookings SET status = ? WHERE id = ?';
    try {
      await executeQuery(query, [status, bookingId]);
      return true;
    } catch (error) {
      logger.error('Error updating booking status:', error);
      throw error;
    }
  }
}

module.exports = Booking;

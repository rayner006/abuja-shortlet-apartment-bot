const { executeQuery } = require('../config/database');
const logger = require('../middleware/logger');

class Booking {
  static async create(bookingData) {
    const query = `
      INSERT INTO bookings (
        apartment_id, guest_name, guest_phone, 
        start_date, end_date, total_days, total_amount, chat_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      bookingData.apartmentId,
      bookingData.guestName,
      bookingData.guestPhone,
      bookingData.startDate,
      bookingData.endDate,
      bookingData.totalDays,
      bookingData.totalAmount,
      bookingData.chatId
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
}

module.exports = Booking;

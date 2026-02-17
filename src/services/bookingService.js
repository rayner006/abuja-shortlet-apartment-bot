const db = require('../config/db');
const logger = require('../middleware/logger');
const Helpers = require('../utils/helpers');

class BookingService {
  /* ================= CREATE BOOKING ================= */
  static async create(data) {
    try {
      const {
        apartment_id,
        user_id,
        check_in,
        check_out,
        total_price,
        reference
      } = data;

      const [result] = await db.query(
        `INSERT INTO bookings 
        (apartment_id, user_id, check_in, check_out, total_price, reference, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [
          apartment_id,
          user_id,
          check_in,
          check_out,
          total_price,
          reference
        ]
      );

      return result.insertId;
    } catch (error) {
      logger.error('Error creating booking:', error);
      throw error;
    }
  }

  /* ================= GET BOOKING BY ID ================= */
  static async getById(id) {
    try {
      const [rows] = await db.query(
        `SELECT b.*, a.title, a.owner_id
         FROM bookings b
         JOIN apartments a ON b.apartment_id = a.id
         WHERE b.id = ? LIMIT 1`,
        [id]
      );

      return rows[0] || null;
    } catch (error) {
      logger.error('Error fetching booking:', error);
      throw error;
    }
  }

  /* ================= GET USER BOOKINGS ================= */
  static async getByUser(userId) {
    try {
      const [rows] = await db.query(
        `SELECT b.*, a.title, a.location
         FROM bookings b
         JOIN apartments a ON b.apartment_id = a.id
         WHERE b.user_id = ?
         ORDER BY b.created_at DESC`,
        [userId]
      );

      return rows;
    } catch (error) {
      logger.error('Error fetching user bookings:', error);
      throw error;
    }
  }

  /* ================= UPDATE STATUS ================= */
  static async updateStatus(bookingId, status) {
    try {
      await db.query(
        `UPDATE bookings SET status = ? WHERE id = ?`,
        [status, bookingId]
      );
    } catch (error) {
      logger.error('Error updating booking status:', error);
      throw error;
    }
  }

  /* ================= CONFIRM PAYMENT ================= */
  static async confirmPayment(bookingId) {
    try {
      const booking = await this.getById(bookingId);
      if (!booking) throw new Error('Booking not found');

      const commission = Helpers.calculateCommission(booking.total_price);
      const ownerPayout = Helpers.calculateOwnerPayout(
        booking.total_price
      );

      await db.query(
        `UPDATE bookings 
         SET status = 'paid',
             commission = ?,
             owner_payout = ?
         WHERE id = ?`,
        [commission, ownerPayout, bookingId]
      );

      return {
        booking,
        commission,
        ownerPayout
      };
    } catch (error) {
      logger.error('Error confirming payment:', error);
      throw error;
    }
  }

  /* ================= CANCEL BOOKING ================= */
  static async cancel(bookingId) {
    try {
      await db.query(
        `UPDATE bookings SET status = 'cancelled' WHERE id = ?`,
        [bookingId]
      );
    } catch (error) {
      logger.error('Error cancelling booking:', error);
      throw error;
    }
  }

  /* ================= ADMIN COMMISSION REPORT ================= */
  static async getCommissionReport() {
    try {
      const [rows] = await db.query(
        `SELECT 
            SUM(commission) AS total_commission,
            COUNT(id) AS total_paid_bookings
         FROM bookings
         WHERE status = 'paid'`
      );

      return rows[0];
    } catch (error) {
      logger.error('Error fetching commission report:', error);
      throw error;
    }
  }
}

module.exports = BookingService;


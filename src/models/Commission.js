const { executeQuery } = require('../config/database');
const logger = require('../middleware/logger');

class Commission {
  static async track(bookingId, bookingCode, ownerId, apartmentId, amount) {
    const commission = amount * 0.1;
    
    const tableCheck = "SHOW TABLES LIKE 'commission_tracking'";
    const tables = await executeQuery(tableCheck);
    
    if (tables.length === 0) {
      logger.warn('Commission tracking table not yet created');
      return false;
    }
    
    const query = `
      INSERT INTO commission_tracking 
      (booking_id, owner_id, apartment_id, booking_code, guest_name, amount_paid, commission_amount, commission_status)
      SELECT ?, ?, ?, ?, user_name, ?, ?, 'pending'
      FROM bookings WHERE id = ?
    `;
    
    try {
      await executeQuery(query, [bookingId, ownerId, apartmentId, bookingCode, amount, commission, bookingId]);
      logger.info(`✅ Commission tracked: ₦${commission} for booking ${bookingCode}`);
      return true;
    } catch (err) {
      logger.error('Error tracking commission:', err);
      return false;
    }
  }
  
  static async getReport(ownerId = null) {
    let query = `
      SELECT 
        o.business_name as owner_name,
        COUNT(c.id) as total_bookings,
        SUM(c.amount_paid) as total_revenue,
        SUM(c.commission_amount) as total_commission,
        SUM(CASE WHEN c.commission_status = 'paid' THEN c.commission_amount ELSE 0 END) as paid_commission,
        SUM(CASE WHEN c.commission_status = 'pending' THEN c.commission_amount ELSE 0 END) as pending_commission
      FROM commission_tracking c
      JOIN property_owners o ON c.owner_id = o.id
    `;
    
    const params = [];
    if (ownerId) {
      query += ' WHERE c.owner_id = ?';
      params.push(ownerId);
    }
    
    query += ' GROUP BY c.owner_id, o.business_name ORDER BY total_commission DESC';
    
    try {
      return await executeQuery(query, params);
    } catch (err) {
      logger.error('Error fetching commission report:', err);
      return [];
    }
  }
  
  static async markAsPaid(commissionId) {
    const query = `
      UPDATE commission_tracking 
      SET commission_status = 'paid', commission_paid_date = NOW() 
      WHERE id = ?
    `;
    try {
      const result = await executeQuery(query, [commissionId]);
      return result.affectedRows > 0;
    } catch (err) {
      logger.error('Error marking commission as paid:', err);
      return false;
    }
  }
  
  static async getTotals() {
    const queries = [
      `SELECT SUM(commission_amount) as pending FROM commission_tracking WHERE commission_status = 'pending'`,
      `SELECT SUM(commission_amount) as paid FROM commission_tracking WHERE commission_status = 'paid'`
    ];
    
    try {
      const [pendingResult, paidResult] = await Promise.all([
        executeQuery(queries[0]),
        executeQuery(queries[1])
      ]);
      
      return {
        pending: pendingResult[0]?.pending || 0,
        paid: paidResult[0]?.paid || 0
      };
    } catch (err) {
      logger.error('Error getting commission totals:', err);
      return { pending: 0, paid: 0 };
    }
  }
}

module.exports = Commission;
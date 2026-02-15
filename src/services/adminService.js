const Owner = require('../models/Owner');
const Commission = require('../models/Commission');
const Booking = require('../models/Booking');
const logger = require('../middleware/logger');

class AdminService {
  static async addSubscription(ownerId, endDate, amount) {
    try {
      const success = await Owner.addSubscription(ownerId, endDate, amount);
      
      if (success) {
        return {
          success: true,
          message: `✅ Subscription added for owner ID ${ownerId}\n📅 Expires: ${endDate}\n💰 Amount: ₦${amount}`
        };
      } else {
        return { success: false, message: '❌ Error adding subscription.' };
      }
    } catch (err) {
      logger.error('Error in addSubscription:', err);
      return { success: false, message: '❌ Error adding subscription.' };
    }
  }
  
  static async getExpiredSubscriptions() {
    try {
      const owners = await Owner.getExpiredSubscriptions();
      
      if (owners.length === 0) {
        return { success: true, message: '✅ All subscriptions are active!', owners: [] };
      }
      
      let message = '⚠️ *EXPIRED SUBSCRIPTIONS:*\n\n';
      owners.forEach(owner => {
        message += `👤 ${owner.name} (ID: ${owner.id})\n`;
        message += `📅 Expired: ${owner.subscription_expiry}\n\n`;
      });
      
      return { success: true, message, owners };
    } catch (err) {
      logger.error('Error getting expired subscriptions:', err);
      return { success: false, message: '❌ Error fetching data.' };
    }
  }
  
  static async getCommissionReport(ownerId = null) {
    try {
      const results = await Commission.getReport(ownerId);
      
      if (results.length === 0) {
        return { success: true, message: '📊 No commission data found.', report: [] };
      }
      
      let message = '💰 *COMMISSION REPORT*\n\n';
      let grandTotal = 0;
      let grandPaid = 0;
      let grandPending = 0;
      
      results.forEach(row => {
        message += `👤 *${row.owner_name}*\n`;
        message += `📊 Bookings: ${row.total_bookings}\n`;
        message += `💰 Revenue: ₦${parseFloat(row.total_revenue || 0).toLocaleString()}\n`;
        message += `💵 Commission: ₦${parseFloat(row.total_commission || 0).toLocaleString()}\n`;
        message += `✅ Paid: ₦${parseFloat(row.paid_commission || 0).toLocaleString()}\n`;
        message += `⏳ Pending: ₦${parseFloat(row.pending_commission || 0).toLocaleString()}\n\n`;
        
        grandTotal += parseFloat(row.total_commission || 0);
        grandPaid += parseFloat(row.paid_commission || 0);
        grandPending += parseFloat(row.pending_commission || 0);
      });
      
      message += `━━━━━━━━━━━━━━━━\n`;
      message += `📊 *TOTALS:*\n`;
      message += `💰 Total Commission: ₦${grandTotal.toLocaleString()}\n`;
      message += `✅ Total Paid: ₦${grandPaid.toLocaleString()}\n`;
      message += `⏳ Total Pending: ₦${grandPending.toLocaleString()}`;
      
      return {
        success: true,
        message,
        report: results,
        totals: { grandTotal, grandPaid, grandPending }
      };
    } catch (err) {
      logger.error('Error getting commission report:', err);
      return { success: false, message: '❌ Error fetching data.' };
    }
  }
  
  static async getDashboard() {
    try {
      const [ownerStats, commissionTotals, recentBookings] = await Promise.all([
        Owner.getStats(),
        Commission.getTotals(),
        Booking.getRecentBookings(30)
      ]);
      
      const message = `
📊 *ADMIN DASHBOARD*

👥 *Owners:*
• Total: ${ownerStats.total}
• Expired: ${ownerStats.expired}
• Active: ${ownerStats.active}

💰 *Commissions:*
• Pending: ₦${commissionTotals.pending.toLocaleString()}
• Paid: ₦${commissionTotals.paid.toLocaleString()}
• Total: ₦${(commissionTotals.pending + commissionTotals.paid).toLocaleString()}

📅 *Last 30 Days:*
• Bookings: ${recentBookings}

━━━━━━━━━━━━━━━━
Use:
/commissions - Detailed report
/expired_subs - Expired subscriptions
      `;
      
      return {
        success: true,
        message,
        data: { ownerStats, commissionTotals, recentBookings }
      };
    } catch (err) {
      logger.error('Error getting dashboard:', err);
      return { success: false, message: '❌ Error fetching dashboard data.' };
    }
  }
}

module.exports = AdminService;
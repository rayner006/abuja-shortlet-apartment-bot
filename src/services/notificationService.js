const bot = require('../bot');
const config = require('../config/environment');
const logger = require('../middleware/logger');
const Owner = require('../models/Owner');
const { getOwnerActionsKeyboard, getAdminActionsKeyboard } = require('../utils/keyboard');

class NotificationService {
  static async notifyOwner(ownerId, bookingInfo) {
    try {
      const owner = await Owner.findById(ownerId);
      if (!owner || !owner.telegram_chat_id) {
        logger.warn(`Owner ${ownerId} has no chat ID registered`);
        return false;
      }
      
      const message = `
🏠 *NEW BOOKING REQUEST!* 🏠

🔑 *Booking Code:* \`${bookingInfo.bookingCode}\`
🆔 *Booking ID:* ${bookingInfo.bookingId}

👤 *Guest Details:*
• Name: ${bookingInfo.guestName}
• Username: @${bookingInfo.guestUsername}
• Phone: ${bookingInfo.guestPhone}

🏠 *Apartment Details:*
• Name: ${bookingInfo.apartmentName}
• Location: ${bookingInfo.location}
• Type: ${bookingInfo.type}
• Price: ₦${bookingInfo.price}/night

📅 *Booking Date:* ${new Date().toLocaleString()}
💰 *Commission:* ₦${bookingInfo.price * 0.1}

Please contact the guest to confirm their booking.
      `;
      
      const keyboard = getOwnerActionsKeyboard(bookingInfo.bookingCode);
      
      await bot.sendMessage(owner.telegram_chat_id, message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
      
      logger.info(`Owner ${ownerId} notified about booking ${bookingInfo.bookingCode}`);
      return true;
    } catch (error) {
      logger.error('Error notifying owner:', error);
      return false;
    }
  }
  
  static async notifyAdmins(bookingInfo) {
    const markdownMessage = 
`🔔 *NEW BOOKING ALERT!* 🔔

🔑 *Booking Code:* \`${bookingInfo.bookingCode}\`
🆔 *Booking ID:* ${bookingInfo.bookingId}

👤 *Guest Details:*
• Name: ${bookingInfo.guestName}
• Username: @${bookingInfo.guestUsername}
• Phone: ${bookingInfo.guestPhone}

🏠 *Apartment Details:*
• Name: ${bookingInfo.apartmentName}
• Location: ${bookingInfo.location}
• Type: ${bookingInfo.type}
• Price: ₦${bookingInfo.price}/night
• Owner ID: ${bookingInfo.ownerId || 'Not assigned'}

📅 *Booking Time:* ${new Date().toLocaleString()}
💰 *Commission (10%):* ₦${(bookingInfo.price * 0.1).toFixed(2)}`;
    
    const keyboard = getAdminActionsKeyboard(bookingInfo.bookingCode);
    
    let successCount = 0;
    
    for (const adminId of config.adminIds) {
      try {
        await bot.sendMessage(adminId, markdownMessage, {
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup
        });
        successCount++;
      } catch (err) {
        logger.error(`Failed to notify admin ${adminId}:`, err);
      }
    }
    
    logger.info(`Notified ${successCount}/${config.adminIds.length} admins`);
    return successCount;
  }
  
  static async sendDailySummary() {
    const Booking = require('../models/Booking');
    
    try {
      const summary = await Booking.getDailySummary(new Date());
      
      const message = `
📅 *Daily Summary - ${new Date().toLocaleDateString()}*

📊 *Today's Stats:*
• Bookings: ${summary.total_bookings || 0}
• Revenue: ₦${(summary.total_revenue || 0).toLocaleString()}
• Commission: ₦${(summary.total_commission || 0).toLocaleString()}

━━━━━━━━━━━━━━━━
Check /dashboard for more details
      `;
      
      for (const adminId of config.adminIds) {
        await bot.sendMessage(adminId, message, { parse_mode: 'Markdown' });
      }
      
      logger.info('Daily summary sent');
    } catch (error) {
      logger.error('Error sending daily summary:', error);
    }
  }
}

module.exports = NotificationService;
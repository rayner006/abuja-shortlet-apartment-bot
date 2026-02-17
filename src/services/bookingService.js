const Apartment = require('../models/Apartment');
const Booking = require('../models/Booking');
const { getRedis } = require('../config/redis');
const logger = require('../middleware/logger');

class BookingService {
  
  /**
   * Helper to format dates
   */
  static formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  static async startBooking(chatId, apartmentId, message) {
    try {
      const apartment = await Apartment.findById(apartmentId);
      
      if (!apartment) {
        return { success: false, message: '❌ Apartment not found.' };
      }
      
      // Create session with step 1 (name)
      const session = {
        step: 'awaiting_name',
        apartmentId: apartment.id,
        apartmentName: apartment.name,
        price: apartment.price,
        chatId,
        messageId: message.message_id
      };
      
      return { 
        success: true, 
        session,
        message: '👤 *Please enter full name:*'
      };
      
    } catch (error) {
      logger.error('Error in startBooking:', error);
      return { success: false, message: '❌ Error starting booking.' };
    }
  }
  
  static async processName(chatId, name, session) {
    try {
      session.name = name;
      session.step = 'awaiting_phone';
      
      const redis = getRedis();
      await redis.setex(`session:${chatId}`, 3600, JSON.stringify(session));
      
      return {
        success: true,
        session,
        message: '📱 *Please enter your phone number:*'
      };
      
    } catch (error) {
      logger.error('Error in processName:', error);
      return { success: false, message: '❌ Error processing name.' };
    }
  }
  
  static async processPhone(chatId, phone, session) {
    try {
      session.phone = phone;
      session.step = 'awaiting_start_date';
      
      const redis = getRedis();
      await redis.setex(`session:${chatId}`, 3600, JSON.stringify(session));
      
      return {
        success: true,
        session,
        message: '📅 *Select your check-in date:*',
        showDatePicker: true
      };
      
    } catch (error) {
      logger.error('Error in processPhone:', error);
      return { success: false, message: '❌ Error processing phone.' };
    }
  }
  
  static async processStartDate(chatId, date, session) {
    try {
      session.startDate = date;
      session.step = 'awaiting_end_date';
      
      const redis = getRedis();
      await redis.setex(`session:${chatId}`, 3600, JSON.stringify(session));
      
      return {
        success: true,
        session,
        message: '📅 *Select your check-out date:*',
        showDatePicker: true,
        startDate: date
      };
      
    } catch (error) {
      logger.error('Error in processStartDate:', error);
      return { success: false, message: '❌ Error processing start date.' };
    }
  }
  
  static async processEndDate(chatId, endDate, session) {
    try {
      session.endDate = endDate;

      // 🔧 SAFETY FIX — Ensure apartment data exists
      if (!session.price || !session.apartmentName) {
        const apartment = await Apartment.findById(session.apartmentId);
        if (apartment) {
          session.price = apartment.price;
          session.apartmentName = apartment.name;
        }
      }
      
      const start = new Date(session.startDate);
      const end = new Date(endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      
      if (days <= 0) {
        return { 
          success: false, 
          message: '❌ Check-out date must be after check-in date. Please select again.' 
        };
      }
      
      const totalAmount = session.price * days;
      
      const booking = await Booking.create({
        apartmentId: session.apartmentId,
        chatId: chatId,
        guestName: session.name,
        guestPhone: session.phone,
        startDate: session.startDate,
        endDate: endDate,
        totalDays: days,
        totalAmount: totalAmount
      });
      
      const redis = getRedis();
      await redis.del(`session:${chatId}`);
      
      return {
        success: true,
        booking,
        message: `
✅ *Booking Confirmed!*

📋 *Booking Details:*
🏠 Apartment: ${session.apartmentName}
👤 Name: ${session.name}
📞 Phone: ${session.phone}
📅 Check-in: ${session.startDate}
📅 Check-out: ${endDate}
📆 Total Days: ${days}
💰 Total Amount: ₦${totalAmount}

🔑 *Your Booking Code:* \`${booking.booking_code}\`

We will contact you shortly to confirm.
        `
      };
      
    } catch (error) {
      logger.error('Error in processEndDate:', error);
      return { success: false, message: '❌ Error processing end date.' };
    }
  }
  
  static async confirmBooking(bookingCode, chatId) {
    try {
      const booking = await Booking.findByCode(bookingCode);
      
      if (!booking) {
        return { success: false, message: '❌ Booking not found.' };
      }
      
      await Booking.updateStatus(booking.id, 'confirmed');
      
      return {
        success: true,
        message: `✅ Booking ${bookingCode} confirmed successfully!`
      };
      
    } catch (error) {
      logger.error('Error confirming booking:', error);
      return { success: false, message: '❌ Error confirming booking.' };
    }
  }

  /**
   * NEW METHOD: Process complete booking with all data at once
   * This is for our new calendar flow
   */
  static async processCompleteBooking({
    chatId,
    apartmentId,
    userName,
    userPhone,
    checkIn,
    checkOut,
    nights
  }) {
    try {
      // Get apartment details
      const apartment = await Apartment.findById(apartmentId);
      
      if (!apartment) {
        throw new Error('Apartment not found');
      }
      
      const totalAmount = apartment.price * nights;
      
      // Create booking using your existing Booking model
      const booking = await Booking.create({
        apartmentId: apartmentId,
        chatId: chatId.toString(),
        guestName: userName,
        guestPhone: userPhone,
        startDate: checkIn,
        endDate: checkOut,
        totalDays: nights,
        totalAmount: totalAmount
      });
      
      const message = 
        `✅ *Booking Confirmed!*\n\n` +
        `━━━━━━━━━━━━━━━━━\n\n` +
        `🏠 *Apartment:* ${apartment.name}\n` +
        `📍 *Location:* ${apartment.location || 'N/A'}\n` +
        `👤 *Guest:* ${userName}\n` +
        `📞 *Phone:* ${userPhone}\n\n` +
        `📅 *Check-in:* ${this.formatDate(checkIn)}\n` +
        `📅 *Check-out:* ${this.formatDate(checkOut)}\n` +
        `🌙 *Nights:* ${nights}\n\n` +
        `💰 *Total:* ₦${totalAmount.toLocaleString()}\n\n` +
        `━━━━━━━━━━━━━━━━━\n\n` +
        `🔑 *Booking Code:* \`${booking.booking_code}\`\n\n` +
        `📌 *Next Steps:*\n` +
        `1. Make payment to the provided account\n` +
        `2. Upload payment proof\n` +
        `3. Admin will verify and confirm\n\n` +
        `Thank you for choosing Abuja Shortlet! 🏨`;

      const keyboard = {
        inline_keyboard: [
          [{ text: '📤 Upload Payment Proof', callback_data: `upload_proof_${booking.booking_code}` }],
          [{ text: '📋 My Bookings', callback_data: 'my_bookings' }],
          [{ text: '🏠 Main Menu', callback_data: 'main_menu' }]
        ]
      };

      return {
        success: true,
        bookingCode: booking.booking_code,
        message,
        keyboard
      };

    } catch (error) {
      logger.error('processCompleteBooking Error:', error);
      
      return {
        success: false,
        message: `❌ *Booking Failed*\n\nSorry, we couldn't process your booking. Please try again.`,
        keyboard: {
          inline_keyboard: [
            [{ text: '🔍 Browse Apartments', callback_data: 'browse_apartments' }]
          ]
        }
      };
    }
  }
}

module.exports = BookingService;

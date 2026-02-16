const Apartment = require('../models/Apartment');
const Booking = require('../models/Booking');
const { getRedis } = require('../config/redis');
const logger = require('../middleware/logger');

class BookingService {
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
      // Store name and move to phone number step
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
      // Store phone and move to date selection
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
      
      // Calculate total days and price
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
      
      // Create booking in database with correct column mappings
      const booking = await Booking.create({
        apartmentId: session.apartmentId,
        chatId: chatId,                    // maps to user_id
        guestName: session.name,            // maps to user_name
        guestPhone: session.phone,          // maps to phone
        startDate: session.startDate,
        endDate: endDate,
        totalDays: days,
        totalAmount: totalAmount            // maps to amount
      });
      
      // Clear session
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
}

module.exports = BookingService;


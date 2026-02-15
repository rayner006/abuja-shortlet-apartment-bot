const { generateBookingCode, generateaccesspin, validatePIN } = require('../utils/pingenerator');
const Booking = require('../models/Booking');
const Apartment = require('../models/Apartment');
const User = require('../models/User');
const Commission = require('../models/Commission');
const NotificationService = require('./notificationService');
const { photoExists } = require('../config/uploads');
const logger = require('../middleware/logger');

class BookingService {
  static async processBooking(chatId, phoneNumber, msg, session) {
    try {
      const userId = msg.from.id;
      const fullName = msg.from.first_name || '';
      const username = msg.from.username || 'No username';
      
      if (phoneNumber.length < 10) {
        return { success: false, message: '❌ Please enter a valid phone number (at least 10 digits)' };
      }
      
      // Check if apartment has photos (optional validation)
      const apt = await Apartment.findById(session.apartmentId);
      if (apt) {
        const photos = Apartment.processPhotos(apt);
        if (photos.length === 0) {
          logger.warn(`Apartment ${session.apartmentId} has no photos`);
        }
      }
      
      const bookingCode = generateBookingCode();
      const amount = session.apartmentPrice;
      const pin = generateaccesspin();
      
      if (!validatePIN(pin)) {
        return { success: false, message: '❌ Error generating valid PIN. Please try again.' };
      }
      
      const bookingId = await Booking.create({
        apartmentId: session.apartmentId,
        userId,
        amount,
        bookingCode,
        accessPin: pin,
        userName: fullName,
        username,
        phone: phoneNumber
      });
      
      await User.incrementBookings(userId);
      
      const bookingInfo = {
        bookingCode,
        guestName: fullName,
        guestUsername: username,
        guestPhone: phoneNumber,
        apartmentName: session.apartmentName,
        location: session.apartmentLocation,
        type: session.apartmentType,
        price: amount,
        bookingId,
        ownerId: session.ownerId
      };
      
      if (session.ownerId) {
        await NotificationService.notifyOwner(session.ownerId, bookingInfo);
      }
      
      await NotificationService.notifyAdmins(bookingInfo);
      
      Commission.track(bookingId, bookingCode, session.ownerId, session.apartmentId, amount).catch(err => {
        logger.error('Error tracking commission:', err);
      });
      
      return {
        success: true,
        bookingCode,
        pin,
        fullName,
        username,
        phoneNumber,
        apartmentName: session.apartmentName,
        amount
      };
      
    } catch (error) {
      logger.error('Error processing booking:', error);
      return { success: false, message: '❌ Error creating booking. Please try again.' };
    }
  }
  
  static async verifyPin(chatId, bookingCode, pin) {
    if (!validatePIN(pin)) {
      return { 
        success: false, 
        message: '❌ *Invalid PIN format*\nPIN must be 5 digits.' 
      };
    }
    
    try {
      const completed = await Booking.completeWithPin(bookingCode, pin);
      
      if (!completed) {
        return { 
          success: false, 
          message: '❌ *Invalid or Used PIN* \nPlease check and try again.' 
        };
      }
      
      return {
        success: true,
        message: '✅ *Payment Confirmed!* 🎉\n\nYour booking is complete.\nThank you for choosing Abuja Shortlet Apartments! 🏠'
      };
      
    } catch (error) {
      logger.error('Error verifying PIN:', error);
      return { 
        success: false, 
        message: '❌ *Error Confirming PIN* \nPlease contact admin.' 
      };
    }
  }
}

module.exports = BookingService;
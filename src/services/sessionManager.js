const { getRedis } = require('../config/redis');
const logger = require('../middleware/logger');

class SessionManager {
  static async hasActiveSession(chatId) {
    try {
      const redis = getRedis();
      
      // Check for booking session
      const bookingSession = await redis.get(`session:${chatId}`);
      if (bookingSession) return true;
      
      // Check for location selection
      const locationData = await redis.get(`selected_location:${chatId}`);
      if (locationData) return true;
      
      return false;
    } catch (error) {
      logger.error('Session check failed:', error);
      return false;
    }
  }

  static async getUserContext(chatId) {
    try {
      const redis = getRedis();
      
      // Check booking session first
      const sessionData = await redis.get(`session:${chatId}`);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        return {
          hasSession: true,
          context: 'booking_flow',
          step: session.step,
          data: session
        };
      }
      
      // Check location selection
      const locationData = await redis.get(`selected_location:${chatId}`);
      if (locationData) {
        return {
          hasSession: true,
          context: 'location_selection',
          data: JSON.parse(locationData)
        };
      }
      
      return { hasSession: false };
    } catch (error) {
      logger.error('Error getting user context:', error);
      return { hasSession: false };
    }
  }

  static async getWelcomeBackMessage(chatId) {
    const context = await this.getUserContext(chatId);
    
    if (context.hasSession) {
      // User has session but sent something unexpected
      if (context.context === 'booking_flow') {
        // For booking flow, return a more specific message
        return {
          hasSession: true,
          message: "👋 I see you're in the middle of booking. Would you like to continue or start over?",
          action: 'show_resume_options'
        };
      } else {
        return {
          hasSession: true,
          message: "👋 I see you're in the middle of something. Would you like to continue or start over?",
          action: 'show_resume_options'
        };
      }
    } else {
      // New or returning user with cleared history
      return {
        hasSession: false,
        message: "👋 *Welcome Back!*\n\n🏠 *Abuja Shortlet Apartments*\n\n👇 *Click On Any Menu Below To Continue*",
        action: 'show_main_menu'
      };
    }
  }
}

module.exports = SessionManager;

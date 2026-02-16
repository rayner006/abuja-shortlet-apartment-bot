const { getRedis } = require('../config/redis');
const logger = require('../middleware/logger');

class SessionManager {
  // Check if user has an active session
  static async hasActiveSession(chatId) {
    try {
      const redis = getRedis();
      
      // Check for any active session keys
      const sessionKeys = await redis.keys(`*:${chatId}`);
      return sessionKeys.length > 0;
    } catch (error) {
      logger.error('Session check failed:', error);
      return false;
    }
  }

  // Get user's current context/state
  static async getUserContext(chatId) {
    try {
      const redis = getRedis();
      
      // Check different possible session states
      const contexts = [
        { key: `selected_location:${chatId}`, type: 'location_selection' },
        { key: `booking:${chatId}`, type: 'booking_flow' },
        { key: `admin_action:${chatId}`, type: 'admin_action' }
      ];
      
      for (const ctx of contexts) {
        const data = await redis.get(ctx.key);
        if (data) {
          return {
            hasSession: true,
            context: ctx.type,
            data: JSON.parse(data)
          };
        }
      }
      
      return { hasSession: false };
    } catch (error) {
      logger.error('Error getting user context:', error);
      return { hasSession: false };
    }
  }

  // Welcome back message based on user history
  static async getWelcomeBackMessage(chatId, userInput) {
    const context = await this.getUserContext(chatId);
    
    if (context.hasSession) {
      // User has session but sent something unexpected
      return {
        message: "👋 I see you're in the middle of something. Would you like to continue or start over?",
        action: 'show_resume_options'
      };
    } else {
      // New or returning user with cleared history
      return {
        message: "Welcome back! 👋\n\nIt looks like we lost track of our conversation. Let's start fresh!",
        action: 'show_main_menu'
      };
    }
  }
}

module.exports = SessionManager;

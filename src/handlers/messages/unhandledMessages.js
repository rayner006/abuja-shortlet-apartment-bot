const { showMainMenu } = require('../../utils/messageHelpers');
const SessionManager = require('../../services/sessionManager');
const logger = require('../../middleware/logger');

// Add cooldown map to prevent duplicates
const messageCooldown = new Map();

module.exports = (bot) => {
  bot.on('message', async (msg) => {
    // Ignore commands
    if (msg.text && msg.text.startsWith('/')) return;
    
    // 🚫 IMPORTANT: Skip ALL menu commands - let specific handlers process them
    const menuCommands = [
      '🏠 View Apartments', 
      '📞 Contact Admin', 
      'ℹ️ About Us', 
      '⬅️ Back to Main Menu', 
      '🔍 Search Again'
    ];
    
    if (msg.text && menuCommands.includes(msg.text)) {
      return; // Let specific handlers process these
    }
    
    // 🚫 Skip location selections
    if (msg.text && msg.text.match(/^[🏛️🏘️💰🏭]/)) {
      return; // Let locations.js handle these
    }
    
    // 🚫 Skip apartment type selections
    if (msg.text && msg.text.match(/^🛏️/)) {
      return; // Let apartmentTypes.js handle these
    }
    
    try {
      const chatId = msg.chat.id;
      
      // Check cooldown
      const lastMessage = messageCooldown.get(chatId);
      if (lastMessage && Date.now() - lastMessage < 5000) {
        return;
      }
      
      // IMPORTANT: Check if user is in ACTIVE booking flow
      const redis = require('../../config/redis').getRedis();
      const sessionData = await redis.get(`session:${chatId}`);
      
      // If user has an active session, DO NOT show the resume message
      // Let the booking flow handlers process it instead
      if (sessionData) {
        logger.info(`User ${chatId} has active booking session - ignoring in unhandledMessages`);
        return; // ← THIS IS KEY - don't show resume message
      }
      
      // Also check for location selection session
      const locationData = await redis.get(`selected_location:${chatId}`);
      
      // Only show welcome/resume for users with NO active session at all
      if (!sessionData && !locationData) {
        logger.info(`User ${chatId} has no active session - showing welcome/resume options`);
        
        const { hasSession, message, action } = await SessionManager.getWelcomeBackMessage(chatId);
        
        if (action === 'show_resume_options') {
          await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🔄 Continue where I left off', callback_data: 'resume_session' },
                  { text: '🆕 Start fresh', callback_data: 'start_fresh' }
                ]
              ]
            }
          });
        } else {
          await showMainMenu(bot, chatId, '👋 *Welcome Back!*\n\n🏠 *Abuja Shortlet Apartments*\n\n👇 *Click On Any Menu Below To Continue*');
        }
        
        messageCooldown.set(chatId, Date.now());
      }
      
    } catch (error) {
      logger.error('Error in unhandled messages handler:', error);
    }
  });
};

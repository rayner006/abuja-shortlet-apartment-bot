const { showMainMenu } = require('../../utils/messageHelpers');
const { contactAdmin, aboutUs } = require('../../utils/messageHelpers');
const { getRedis } = require('../../config/redis');
const logger = require('../../middleware/logger');

module.exports = (bot) => {
  // Handle main menu navigation
  bot.onText(/⬅️ Back to Main Menu/, (msg) => {
    showMainMenu(bot, msg.chat.id, 'Welcome Back! 👋\n\nAbuja Shortlet Apartments 🏠\nClick Any Menu Below To Continue 👇👇👇');
  });
  
  // Handle contact admin
  bot.onText(/📞 Contact Admin/, (msg) => {
    contactAdmin(bot, msg.chat.id);
  });
  
  // Handle about us
  bot.onText(/ℹ️ About Us/, (msg) => {
    aboutUs(bot, msg.chat.id);
  });
  
  // Handle any button click - This catches all callback queries
  bot.on('callback_query', async (cb) => {
    const chatId = cb.message.chat.id;
    const data = cb.data;
    
    // Let the specific handlers process first
    // If it's a navigation callback, we handle it specially
    if (data === 'main_menu') {
      await bot.answerCallbackQuery(cb.id);
      showMainMenu(bot, chatId, 'Welcome Back! 👋\n\nAbuja Shortlet Apartments 🏠\nClick Any Menu Below To Continue 👇👇👇');
    }
  });
  
  // Handle any message that might indicate they're returning
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Skip if no text, command, or already handled
    if (!text || text.startsWith('/')) return;
    
    try {
      const redis = getRedis();
      
      // Check if user has an active session
      const sessionData = await redis.get(`session:${chatId}`);
      const locationData = await redis.get(`selected_location:${chatId}`);
      
      // If no active session and not a menu command, they might be returning
      if (!sessionData && !locationData && !text.match(/^(🏠|📞|ℹ️|⬅️|🔍)/)) {
        logger.info(`User ${chatId} appears to be returning, showing welcome back message`);
        
        // Show welcome back message with emojis
        showMainMenu(bot, chatId, 'Welcome Back! 👋\n\nAbuja Shortlet Apartments 🏠\nClick Any Menu Below To Continue 👇👇👇');
      }
    } catch (error) {
      logger.error('Error checking session for returning user:', error);
    }
  });
};

const { showMainMenu } = require('../../utils/messageHelpers');
const { contactAdmin, aboutUs } = require('../../utils/messageHelpers');

module.exports = (bot) => {
  // Handle main menu navigation
  bot.onText(/⬅️ Back to Main Menu/, (msg) => {
    showMainMenu(bot, msg.chat.id);
  });
  
  // Handle contact admin
  bot.onText(/📞 Contact Admin/, (msg) => {
    contactAdmin(bot, msg.chat.id);
  });
  
  // Handle about us
  bot.onText(/ℹ️ About Us/, (msg) => {
    aboutUs(bot, msg.chat.id);
  });
  
  // Default handler for unknown text
  bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Skip if no text, command, or already handled
    if (!text || text.startsWith('/')) return;
    
    // Check if user is in a session (handled by booking.js)
    // Otherwise, show main menu
    getRedis().get(`session:${chatId}`).then(session => {
      if (!session) {
        showMainMenu(bot, chatId, 'Welcome Back! 👋\n\nAbuja Shortlet Apartments 🏠,\nClick On Any Menu Below 👇👇👇');
      }
    }).catch(err => {
      logger.error('Error checking session:', err);
    });
  });
};
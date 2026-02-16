const { showMainMenu } = require('../../utils/messageHelpers');
const { contactAdmin, aboutUs } = require('../../utils/messageHelpers');

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
  
  // 🗑️ REMOVED: The duplicate message handler that was causing double welcome messages
  // All unhandled messages now go through unhandledMessages.js
};

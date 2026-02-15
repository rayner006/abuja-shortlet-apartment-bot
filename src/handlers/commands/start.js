const { getMainMenuKeyboard } = require('../../utils/keyboard');
const User = require('../../models/User');
const logger = require('../../middleware/logger');

module.exports = (bot) => {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      // Save user info
      await User.saveUserInfo(msg);
      
      // Get keyboard
      const keyboard = getMainMenuKeyboard();
      
      // Send welcome message
      await bot.sendMessage(
        chatId,
        'Welcome To\nAbuja Shortlet Apartments 🏠,\nClick On Any Menu Below 👇👇👇',
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup
        }
      );
      
      logger.info('User started bot', { 
        userId: msg.from.id,
        username: msg.from.username 
      });
      
    } catch (error) {
      logger.error('Error in /start handler:', error);
      
      await bot.sendMessage(
        chatId,
        '❌ Sorry, something went wrong. Please try again later.'
      );
    }
  });
};
const { showMainMenu, showWelcomeBack } = require('../../utils/messageHelpers');
const SessionManager = require('../../services/sessionManager');
const logger = require('../../middleware/logger');

module.exports = (bot) => {
  bot.on('message', async (msg) => {
    // Ignore commands
    if (msg.text && msg.text.startsWith('/')) return;
    
    // Ignore common callback-related texts
    const callbackPatterns = ['✅', '❌', '💰', '📅', '🔍', '📞', 'ℹ️', '⬅️'];
    if (msg.text && callbackPatterns.some(pattern => msg.text.includes(pattern))) return;
    
    try {
      const chatId = msg.chat.id;
      const userInput = msg.text;
      
      logger.info(`Unhandled message from ${chatId}: "${userInput}"`);
      
      const { hasSession, message, action } = await SessionManager.getWelcomeBackMessage(chatId);
      
      // Send appropriate response based on session state
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
        await showWelcomeBack(bot, chatId);
      }
      
    } catch (error) {
      logger.error('Error in unhandled messages handler:', error);
    }
  });
};

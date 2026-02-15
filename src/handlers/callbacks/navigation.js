const { showLocations } = require('../../utils/messageHelpers');

module.exports = (bot) => {
  bot.on('callback_query', async (cb) => {
    const chatId = cb.message.chat.id;
    const data = cb.data;
    
    await bot.answerCallbackQuery(cb.id);
    
    // Search again
    if (data === 'search_again') {
      showLocations(bot, chatId);
    }
    
    // Back to main menu (if you have callback for that)
    if (data === 'back_to_main') {
      const { showMainMenu } = require('../../utils/messageHelpers');
      showMainMenu(bot, chatId);
    }
  });
};
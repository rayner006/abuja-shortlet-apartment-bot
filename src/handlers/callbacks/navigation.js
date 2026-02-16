const { showLocations } = require('../../utils/messageHelpers');

module.exports = (bot) => {
  bot.on('callback_query', async (cb) => {
    const chatId = cb.message.chat.id;
    const data = cb.data;
    
    // ONLY handle navigation-specific callbacks
    if (data === 'search_again') {
      await bot.answerCallbackQuery(cb.id);
      showLocations(bot, chatId);
    }
    else if (data === 'back_to_main') {
      await bot.answerCallbackQuery(cb.id);
      const { showMainMenu } = require('../../utils/messageHelpers');
      showMainMenu(bot, chatId);
    }
    // Otherwise, do NOTHING - let other handlers process it
  });
};

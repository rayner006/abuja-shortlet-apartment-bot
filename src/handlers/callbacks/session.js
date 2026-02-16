const { showMainMenu, showWelcomeBack } = require('../../utils/messageHelpers');
const { getRedis } = require('../../config/redis');
const logger = require('../../middleware/logger');

module.exports = (bot) => {
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    try {
      if (data === 'resume_session') {
        await bot.answerCallbackQuery(query.id, { text: 'Resuming your session...' });
        
        // Check what session they had and redirect accordingly
        const redis = getRedis();
        const locationData = await redis.get(`selected_location:${chatId}`);
        
        if (locationData) {
          const { location } = JSON.parse(locationData);
          const { showApartmentTypes } = require('../../utils/messageHelpers');
          await showApartmentTypes(bot, chatId, location);
        } else {
          await showMainMenu(bot, chatId);
        }
        
      } else if (data === 'start_fresh') {
        await bot.answerCallbackQuery(query.id, { text: 'Starting fresh...' });
        
        // Clear any existing sessions
        const redis = getRedis();
        const keys = await redis.keys(`*:${chatId}`);
        for (const key of keys) {
          await redis.del(key);
        }
        
        await showWelcomeBack(bot, chatId);
      }
      
    } catch (error) {
      logger.error('Error in session callback:', error);
      await bot.answerCallbackQuery(query.id, { text: 'Error processing request' });
    }
  });
};

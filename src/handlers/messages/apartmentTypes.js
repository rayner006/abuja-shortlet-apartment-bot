const { showApartmentsByLocationAndType } = require('../../utils/messageHelpers');
const { getRedis } = require('../../config/redis');
const logger = require('../../middleware/logger');

module.exports = (bot) => {
  const typePattern = /^🛏️ (Self Contain|1-Bedroom|2-Bedroom|3-Bedroom)/;
  
  bot.onText(typePattern, async (msg) => {
    const chatId = msg.chat.id;
    const apartmentType = msg.text;
    
    try {
      const redis = getRedis();
      const locationData = await redis.get(`selected_location:${chatId}`);
      
      if (!locationData) {
        const { showLocations } = require('../../utils/messageHelpers');
        return showLocations(bot, chatId);
      }
      
      const { location } = JSON.parse(locationData);
      await showApartmentsByLocationAndType(bot, chatId, location, apartmentType);
      
    } catch (error) {
      logger.error('Error in apartmentTypes handler:', error);
      bot.sendMessage(chatId, '❌ Error fetching apartments. Please try again.');
    }
  });
};
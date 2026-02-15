const { showApartmentsByLocationAndType } = require('../../utils/messageHelpers');
const { getRedis } = require('../../config/redis');
const logger = require('../../middleware/logger');

module.exports = (bot) => {
  // Handle apartment type selections - with or without emoji
  const typePattern = /^(🛏️ )?(Self Contain|1-Bedroom|2-Bedroom|3-Bedroom)$/;
  
  bot.onText(typePattern, async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Extract the type without emoji if present
    let apartmentType = text;
    if (!apartmentType.startsWith('🛏️')) {
      // Add the emoji back for consistency
      apartmentType = '🛏️ ' + apartmentType;
    }
    
    console.log('🏠 Apartment type selected:', apartmentType);
    
    try {
      const redis = getRedis();
      const locationData = await redis.get(`selected_location:${chatId}`);
      
      if (!locationData) {
        console.log('📍 No location selected, going back to locations');
        const { showLocations } = require('../../utils/messageHelpers');
        return showLocations(bot, chatId);
      }
      
      const { location } = JSON.parse(locationData);
      console.log('📍 Location from session:', location);
      
      await showApartmentsByLocationAndType(bot, chatId, location, apartmentType);
      
    } catch (error) {
      logger.error('Error in apartmentTypes handler:', error);
      bot.sendMessage(chatId, '❌ Error fetching apartments. Please try again.');
    }
  });
};

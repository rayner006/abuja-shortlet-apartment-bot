const { showLocations } = require('../../utils/messageHelpers');

module.exports = (bot) => {
  // This handler just forwards to the helper function
  // The actual location display logic is in messageHelpers
  bot.onText(/🏠 View Apartments|🔍 Search Again/, (msg) => {
    showLocations(bot, msg.chat.id);
  });
  
  // Handle location selections (these are text messages, not callbacks)
  const locationPattern = /^[🏛️🏘️💰🏭]/;
  bot.onText(locationPattern, (msg) => {
    const chatId = msg.chat.id;
    const location = msg.text;
    
    // Import here to avoid circular dependency
    const { showApartmentTypes } = require('../../utils/messageHelpers');
    showApartmentTypes(bot, chatId, location);
  });
};
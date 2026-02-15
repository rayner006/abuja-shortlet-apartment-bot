const { showLocations } = require('../../utils/messageHelpers');

module.exports = (bot) => {
  // Handle View Apartments button - this should come FIRST
  bot.onText(/🏠 View Apartments/, (msg) => {
    console.log('✅ View Apartments detected - showing locations');
    showLocations(bot, msg.chat.id);
  });
  
  // Handle Search Again button
  bot.onText(/🔍 Search Again/, (msg) => {
    console.log('✅ Search Again detected - showing locations');
    showLocations(bot, msg.chat.id);
  });
  
  // Handle location selections - this should come AFTER
  // But we need to make sure it doesn't catch "View Apartments"
  const locationPattern = /^[🏛️🏘️💰🏭]/;  // Starts with location emoji
  
  bot.onText(locationPattern, (msg) => {
    // Double-check it's not "View Apartments"
    if (msg.text === '🏠 View Apartments' || msg.text === '🔍 Search Again') {
      return; // Skip - these are handled above
    }
    
    console.log('📍 Location selected:', msg.text);
    const chatId = msg.chat.id;
    const location = msg.text;
    
    const { showApartmentTypes } = require('../../utils/messageHelpers');
    showApartmentTypes(bot, chatId, location);
  });
};

const { showLocations } = require('../../utils/messageHelpers');

module.exports = (bot) => {
  // Handle View Apartments button
  bot.onText(/🏠 View Apartments/, (msg) => {
    console.log('✅ View Apartments detected - showing locations');
    showLocations(bot, msg.chat.id);
  });
  
  // Handle Search Again button
  bot.onText(/🔍 Search Again/, (msg) => {
    console.log('✅ Search Again detected - showing locations');
    showLocations(bot, msg.chat.id);
  });
  
  // Handle location selections - ONLY exact location matches
  const locations = [
    '🏛️ Maitama', '🏛️ Asokoro', '🏛️ Wuse', '🏛️ Jabi', '🏛️ Garki',
    '🏘️ Gwarinpa', '🏛️ Guzape', '🏛️ Katampe', '🏘️ Jahi', '💰 Utako',
    '🏘️ Wuye', '🏘️ Life Camp', '🏘️ Apo', '🏘️ Lokogoma', '🏘️ Kubwa',
    '🏘️ Lugbe', '🏘️ Durumi', '🏭 Gwagwalada'
  ];
  
  // Register handler for each specific location
  locations.forEach(location => {
    bot.onText(new RegExp(`^${location}$`), (msg) => {
      console.log('📍 Location selected:', location);
      const chatId = msg.chat.id;
      
      const { showApartmentTypes } = require('../../utils/messageHelpers');
      showApartmentTypes(bot, chatId, location);
    });
  });
};

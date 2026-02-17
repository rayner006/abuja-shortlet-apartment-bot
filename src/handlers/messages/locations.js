// ============================================
// NAVIGATION CALLBACK HANDLER
// Location: /handlers/callbacks/navigation.js
// ============================================

const { showLocations } = require('../../utils/messageHelpers');

module.exports = (bot) => {
  
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data;
    
    console.log('🔍 Navigation callback:', data);
    
    // Handle View Apartments button
    if (data === 'view_apartments') {
      console.log('✅ View Apartments callback - showing locations');
      
      // Delete the original message
      await bot.deleteMessage(chatId, messageId).catch(() => {});
      
      // Show locations
      showLocations(bot, chatId);
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Handle Search Again button
    if (data === 'search_again') {
      console.log('✅ Search Again callback - showing locations');
      
      await bot.deleteMessage(chatId, messageId).catch(() => {});
      
      showLocations(bot, chatId);
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    // Handle location selections
    if (data.startsWith('location_')) {
      const location = data.replace('location_', '');
      console.log('📍 Location selected:', location);
      
      await bot.deleteMessage(chatId, messageId).catch(() => {});
      
      const { showApartmentTypes } = require('../../utils/messageHelpers');
      showApartmentTypes(bot, chatId, location);
      
      await bot.answerCallbackQuery(query.id);
      return;
    }
  });
};

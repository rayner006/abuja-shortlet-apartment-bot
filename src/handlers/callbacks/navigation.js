// ============================================
// NAVIGATION HANDLER (for regular keyboard buttons)
// Location: /handlers/callbacks/navigation.js
// ============================================

const { getLocationsKeyboard, getBackKeyboard } = require('../../utils/keyboard');
const logger = require('../../middleware/logger');

module.exports = (bot) => {
  
  // Handle View Apartments button (text message)
  bot.onText(/🏠 View Apartments/, async (msg) => {
    const chatId = msg.chat.id;
    console.log('✅ View Apartments detected - showing locations');
    
    try {
      const keyboard = getLocationsKeyboard();
      
      await bot.sendMessage(
        chatId,
        '📍 *Select a location:*',
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup
        }
      );
    } catch (error) {
      logger.error('Error showing locations:', error);
    }
  });
  
  // Handle Back button
  bot.onText(/⬅️ Back to Main Menu/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      const { getMainMenuKeyboard } = require('../../utils/keyboard');
      const keyboard = getMainMenuKeyboard();
      
      await bot.sendMessage(
        chatId,
        'Welcome Back! 👋',
        {
          reply_markup: keyboard.reply_markup
        }
      );
    } catch (error) {
      logger.error('Error going back to main menu:', error);
    }
  });
  
  // Handle location selections
  const locations = [
    '🏛️ Maitama', '🏛️ Asokoro', '🏛️ Wuse', '🏛️ Jabi', '🏛️ Garki',
    '🏘️ Gwarinpa', '🏛️ Guzape', '🏛️ Katampe', '🏘️ Jahi', '💰 Utako',
    '🏘️ Wuye', '🏘️ Life Camp', '🏘️ Apo', '🏘️ Lokogoma', '🏘️ Kubwa',
    '🏘️ Lugbe', '🏘️ Durumi', '🏭 Gwagwalada'
  ];
  
  locations.forEach(location => {
    bot.onText(new RegExp(`^${location}$`), async (msg) => {
      const chatId = msg.chat.id;
      console.log('📍 Location selected:', location);
      
      try {
        const { getApartmentTypesKeyboard } = require('../../utils/keyboard');
        const keyboard = getApartmentTypesKeyboard(location);
        
        await bot.sendMessage(
          chatId,
          `🏙️ *Apartments in ${location}*\n\nSelect apartment type:`,
          {
            parse_mode: 'Markdown',
            reply_markup: keyboard.reply_markup
          }
        );
      } catch (error) {
        logger.error('Error showing apartment types:', error);
      }
    });
  });
  
  // Handle Search Again button
  bot.onText(/🔍 Search Again/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      const keyboard = getLocationsKeyboard();
      
      await bot.sendMessage(
        chatId,
        '📍 *Select a location:*',
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup
        }
      );
    } catch (error) {
      logger.error('Error showing locations:', error);
    }
  });
};

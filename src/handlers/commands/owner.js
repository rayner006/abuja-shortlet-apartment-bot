const OwnerService = require('../../services/ownerService');
const logger = require('../../middleware/logger');

module.exports = (bot) => {
  // Register owner
  bot.onText(/\/register_owner (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const ownerId = parseInt(match[1]);
    
    const result = await OwnerService.registerOwner(chatId, ownerId);
    
    bot.sendMessage(chatId, result.message);
  });
  
  // Owner check their own subscription (optional)
  bot.onText(/\/my_subscription/, async (msg) => {
    const chatId = msg.chat.id;
    
    // This would need to map chatId to ownerId
    // Simplified for now
    bot.sendMessage(chatId, 'Please use /check_subscription [owner_id] as admin');
  });
};
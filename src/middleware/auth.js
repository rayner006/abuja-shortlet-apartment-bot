const config = require('../config/environment');

function isAdmin(chatId) {
  return config.adminIds.includes(chatId);
}

function adminOnly(bot) {
  return async (msg, match, next) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
      await bot.sendMessage(chatId, '❌ This command is for admins only.');
      return;
    }
    
    if (next) next();
  };
}

module.exports = {
  isAdmin,
  adminOnly
};
const Keyboard = require('../utils/keyboard');
const UserService = require('../services/userService');
const logger = require('../middleware/logger');

class StartHandler {
  static async handle(bot, msg) {
    const chatId = msg.chat.id;

    try {
      // Ensure user exists in DB
      const user = await UserService.findOrCreate(msg.from);

      const firstName = msg.from.first_name || 'there';

      const welcomeText = `
👋 Welcome ${firstName}!

Find and book shortlet apartments in Abuja easily.

What would you like to do today?
`;

      await bot.sendMessage(chatId, welcomeText, Keyboard.mainMenu());

      logger.info(`User ${user.telegram_id} started bot`);
    } catch (error) {
      logger.error('Start handler error:', error);

      await bot.sendMessage(
        chatId,
        '⚠️ Something went wrong. Please try again later.'
      );
    }
  }
}

module.exports = StartHandler;

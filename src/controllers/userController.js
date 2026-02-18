// src/controllers/userController.js
const { User } = require('../models');
const { createMainMenuKeyboard } = require('../utils/keyboards');
const logger = require('../config/logger');
const redis = require('../config/redis');

const handleStart = async (bot, msg) => {
  const chatId = msg.chat.id;
  const from = msg.from;
  
  try {
    // Check if user exists
    let user = await User.findOne({ where: { telegramId: from.id } });
    
    if (!user) {
      // Create new user
      user = await User.create({
        telegramId: from.id,
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
        role: from.id.toString() === process.env.ADMIN_IDS?.split(',')[0] ? 'admin' : 'user',
        lastActive: new Date()
      });
      
      logger.info(`New user created: ${from.id} (${from.username})`);
      
      // Welcome message for new users
      const welcomeText = `
🏢 *Welcome to Abuja Shortlet Apartments!*

Hello ${from.first_name || 'there'}! I'm your personal assistant for finding and booking shortlet apartments in Abuja.

✨ *What I can do for you:*
• Search for apartments by location, price, and guests
• View detailed apartment information and photos
• Make bookings and manage your reservations
• For property owners: List and manage your apartments

Use /menu to see all available options or /help for assistance.

Happy apartment hunting! 🏠
      `;
      
      await bot.sendMessage(chatId, welcomeText, { parse_mode: 'Markdown' });
    } else {
      // Update last active
      user.lastActive = new Date();
      await user.save();
      
      // Welcome back message
      await bot.sendMessage(chatId, 
        `Welcome back, ${user.firstName || 'there'}! 👋\nUse /menu to continue.`
      );
    }
    
    // Show main menu
    await handleMenu(bot, msg);
    
  } catch (error) {
    logger.error('Start handler error:', error);
    bot.sendMessage(chatId, 'An error occurred. Please try again later.');
  }
};

const handleMenu = async (bot, msg) => {
  const chatId = msg.chat.id;
  
  try {
    const user = await User.findOne({ where: { telegramId: msg.from.id } });
    
    const menuText = `
📋 *Main Menu*

Please select an option below:
    `;
    
    const keyboard = createMainMenuKeyboard(user ? user.role : 'user');
    
    await bot.sendMessage(chatId, menuText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
  } catch (error) {
    logger.error('Menu handler error:', error);
    bot.sendMessage(chatId, 'Error loading menu. Please try again.');
  }
};

const handleContact = async (bot, msg) => {
  const chatId = msg.chat.id;
  
  if (msg.contact) {
    try {
      const user = await User.findOne({ where: { telegramId: msg.from.id } });
      
      if (user) {
        user.phone = msg.contact.phone_number;
        await user.save();
        
        await bot.sendMessage(chatId, 
          '✅ Phone number saved successfully!\n\n' +
          'You can now proceed with your booking.'
        );
      }
    } catch (error) {
      logger.error('Contact handler error:', error);
      bot.sendMessage(chatId, 'Error saving phone number. Please try again.');
    }
  }
};

const handleProfile = async (bot, msg) => {
  const chatId = msg.chat.id;
  
  try {
    const user = await User.findOne({ where: { telegramId: msg.from.id } });
    
    if (!user) {
      bot.sendMessage(chatId, 'Please start the bot first with /start');
      return;
    }
    
    const roleEmoji = {
      'user': '👤',
      'owner': '🏠',
      'admin': '⚙️'
    };
    
    const profileText = `
👤 *Your Profile*

• Name: ${user.firstName || ''} ${user.lastName || ''}
• Username: @${user.username || 'Not set'}
• Role: ${roleEmoji[user.role]} ${user.role.toUpperCase()}
• Phone: ${user.phone || 'Not provided'}
• Member since: ${new Date(user.createdAt).toLocaleDateString()}
• Last active: ${new Date(user.lastActive).toLocaleString()}

Use /edit\\_profile to update your information.
    `;
    
    await bot.sendMessage(chatId, profileText, { parse_mode: 'Markdown' });
    
  } catch (error) {
    logger.error('Profile handler error:', error);
    bot.sendMessage(chatId, 'Error fetching profile. Please try again.');
  }
};

module.exports = {
  handleStart,
  handleMenu,
  handleContact,
  handleProfile
};

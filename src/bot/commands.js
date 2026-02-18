// src/bot/commands.js
const { handleStart } = require('../controllers/userController');
const { handleSearch } = require('../controllers/apartmentController');
const { handleMyBookings } = require('../controllers/bookingController');
const { handleAddApartment } = require('../controllers/apartmentController');
const { handleAdminPanel } = require('../controllers/adminController');
const logger = require('../config/logger');

const setupCommands = (bot) => {
  // Start command
  bot.onText(/\/start/, async (msg) => {
    try {
      await handleStart(bot, msg);
    } catch (error) {
      logger.error('Start command error:', error);
      bot.sendMessage(msg.chat.id, 'Welcome! Use /menu to see available options.');
    }
  });

  // Menu command
  bot.onText(/\/menu/, async (msg) => {
    try {
      await handleMenu(bot, msg);
    } catch (error) {
      logger.error('Menu command error:', error);
      bot.sendMessage(msg.chat.id, 'Error loading menu. Please try again.');
    }
  });

  // Search command
  bot.onText(/\/search/, async (msg) => {
    try {
      await handleSearch(bot, msg);
    } catch (error) {
      logger.error('Search command error:', error);
      bot.sendMessage(msg.chat.id, 'Error starting search. Please try again.');
    }
  });

  // My bookings command
  bot.onText(/\/my_bookings/, async (msg) => {
    try {
      await handleMyBookings(bot, msg);
    } catch (error) {
      logger.error('My bookings command error:', error);
      bot.sendMessage(msg.chat.id, 'Error fetching bookings. Please try again.');
    }
  });

  // Add apartment command (for owners)
  bot.onText(/\/add_apartment/, async (msg) => {
    try {
      await handleAddApartment(bot, msg);
    } catch (error) {
      logger.error('Add apartment command error:', error);
      bot.sendMessage(msg.chat.id, 'Error starting apartment addition. Please try again.');
    }
  });

  // Admin command
  bot.onText(/\/admin/, async (msg) => {
    try {
      await handleAdminPanel(bot, msg);
    } catch (error) {
      logger.error('Admin command error:', error);
      bot.sendMessage(msg.chat.id, 'Error accessing admin panel.');
    }
  });

  // Help command
  bot.onText(/\/help/, (msg) => {
    const helpText = `
🤖 *Abuja Shortlet Apartment Bot - Help*

*Available Commands:*
/start - Start the bot
/menu - Show main menu
/search - Search for apartments
/my\\_bookings - View your bookings
/help - Show this help message

*For Apartment Owners:*
/register\\_owner - Register as an owner
/add\\_apartment - Add a new apartment
/my\\_apartments - Manage your apartments

*For more assistance, contact support*
    `;
    
    bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
  });

  // Register owner command
  bot.onText(/\/register_owner/, async (msg) => {
    try {
      const { User } = require('../models');
      const user = await User.findOne({ where: { telegramId: msg.from.id } });
      
      if (user && user.role === 'user') {
        user.role = 'owner';
        await user.save();
        bot.sendMessage(msg.chat.id, 
          '✅ You are now registered as an apartment owner!\n\n' +
          'You can now:\n' +
          '• Add apartments using /add\\_apartment\n' +
          '• View your apartments with /my\\_apartments\n' +
          '• Manage bookings from your dashboard'
        , { parse_mode: 'Markdown' });
      } else if (user && (user.role === 'owner' || user.role === 'admin')) {
        bot.sendMessage(msg.chat.id, 'You are already registered as an owner!');
      } else {
        bot.sendMessage(msg.chat.id, 'Please start the bot first with /start');
      }
    } catch (error) {
      logger.error('Register owner error:', error);
      bot.sendMessage(msg.chat.id, 'Error registering as owner. Please try again.');
    }
  });

  // My apartments command
  bot.onText(/\/my_apartments/, async (msg) => {
    try {
      const { User, Apartment } = require('../models');
      const user = await User.findOne({ where: { telegramId: msg.from.id } });
      
      if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
        bot.sendMessage(msg.chat.id, 'You need to be registered as an owner first. Use /register_owner');
        return;
      }
      
      const apartments = await Apartment.findAll({ 
        where: { ownerId: user.id },
        order: [['created_at', 'DESC']]
      });
      
      if (apartments.length === 0) {
        bot.sendMessage(msg.chat.id, 
          'You haven\'t added any apartments yet.\n\n' +
          'Use /add\\_apartment to list your first property!'
        , { parse_mode: 'Markdown' });
        return;
      }
      
      bot.sendMessage(msg.chat.id, `🏠 You have ${apartments.length} apartment(s):`);
      
      for (const apt of apartments) {
        const status = apt.isApproved ? '✅ Approved' : '⏳ Pending';
        const availability = apt.isAvailable ? '🟢 Available' : '🔴 Unavailable';
        
        const text = `
🏠 *${apt.title}*
📍 ${apt.location}
💰 ₦${apt.pricePerNight}/night
📊 Status: ${status} | ${availability}
📅 Bookings: ${apt.Bookings ? apt.Bookings.length : 0}
        `;
        
        const { createOwnerApartmentKeyboard } = require('../utils/keyboards');
        
        if (apt.images && apt.images.length > 0) {
          await bot.sendPhoto(msg.chat.id, apt.images[0], {
            caption: text,
            parse_mode: 'Markdown',
            reply_markup: createOwnerApartmentKeyboard(apt.id)
          });
        } else {
          await bot.sendMessage(msg.chat.id, text, {
            parse_mode: 'Markdown',
            reply_markup: createOwnerApartmentKeyboard(apt.id)
          });
        }
      }
    } catch (error) {
      logger.error('My apartments error:', error);
      bot.sendMessage(msg.chat.id, 'Error fetching apartments. Please try again.');
    }
  });
};

module.exports = { setupCommands };

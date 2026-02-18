// src/bot/commands.js
const { handleStart, handleMenu } = require('../controllers/userController');  // 👈 FIXED: Added handleMenu
const { handleSearch } = require('../controllers/apartmentController');
const { handleMyBookings } = require('../controllers/bookingController');
const { handleAddApartment } = require('../controllers/apartmentController');
// 👇 REMOVE this old import
// const { handleAdminPanel } = require('../controllers/adminController');

// 👇 ADD this new import
const AdminController = require('../controllers/admin');

const logger = require('../config/logger');

const setupCommands = (bot) => {
  
  // 👇 Create admin controller instance
  const adminController = new AdminController(bot);
  
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
      await handleMenu(bot, msg);  // 👈 Now this will work!
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

  // Admin command - UPDATED to use new controller
  bot.onText(/\/admin/, async (msg) => {
    try {
      // Use the new admin controller
      await adminController.handleAdminPanel(msg);
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

*For Property Owners:*
/register\\_owner - Register to list your property
/add\\_apartment - Add a new apartment listing
/my\\_apartments - Manage your listings

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
          '✅ *Congratulations! You can now list your property!*\n\n' +
          'You now have access to:\n' +
          '• 📋 *List your apartments* using /add\\_apartment\n' +
          '• 👁️ *View your listings* with /my\\_apartments\n' +
          '• 📊 *Manage bookings* from your dashboard\n\n' +
          'Start earning from your property today! 🏠💰',
        { parse_mode: 'Markdown' });
      } else if (user && (user.role === 'owner' || user.role === 'admin')) {
        bot.sendMessage(msg.chat.id, 
          '✅ You are already registered as a property owner!\n\n' +
          'Use /add\\_apartment to list a new property or /my\\_apartments to manage existing ones.',
          { parse_mode: 'Markdown' }
        );
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
        bot.sendMessage(msg.chat.id, 
          '📋 *Want to list your property?*\n\n' +
          'You need to register as a property owner first.\n\n' +
          'Use /register\\_owner to get started and start earning!',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      const apartments = await Apartment.findAll({ 
        where: { ownerId: user.id },
        order: [['created_at', 'DESC']]
      });
      
      if (apartments.length === 0) {
        bot.sendMessage(msg.chat.id, 
          '📋 *You haven\'t listed any apartments yet*\n\n' +
          'Ready to start earning? Use /add\\_apartment to list your first property!\n\n' +
          '✨ *Benefits of listing with us:*\n' +
          '• Reach thousands of potential guests\n' +
          '• Professional property management\n' +
          '• Secure payment processing\n' +
          '• Best rates in Abuja',
        { parse_mode: 'Markdown' });
        return;
      }
      
      bot.sendMessage(msg.chat.id, `🏠 You have *${apartments.length}* apartment(s) listed:`);
      
      for (const apt of apartments) {
        const status = apt.isApproved ? '✅ Approved' : '⏳ Pending Approval';
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

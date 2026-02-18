// src/controllers/apartmentController.js
const { Apartment, User, Booking } = require('../models');
const { Op } = require('sequelize');
const { createApartmentKeyboard } = require('../utils/keyboards');
const { formatCurrency } = require('../utils/helpers');
const logger = require('../config/logger');
const redis = require('../config/redis');

// Search states (for conversation)
const searchState = {};

const handleSearch = async (bot, msg) => {
  const chatId = msg.chat.id;
  
  const searchText = `
🔍 *Search Apartments*

Please enter your search criteria in one of these formats:

1. *Simple search:* Just type a location (e.g., "Wuse 2", "Maitama")
2. *Advanced:* location, max price, guests (e.g., "Wuse 2, 50000, 2")
3. *Specific:* /search location price\\_min price\\_max guests

Examples:
• "Wuse 2"
• "Maitama, 100000, 4"
• /search wuse 20000 50000 3

What would you like to search for?
  `;
  
  searchState[chatId] = { step: 'awaiting_input' };
  
  await bot.sendMessage(chatId, searchText, { parse_mode: 'Markdown' });
};

const processSearch = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  try {
    let location = text;
    let maxPrice = null;
    let guests = null;
    
    // Parse advanced search if commas exist
    if (text.includes(',')) {
      const parts = text.split(',').map(p => p.trim());
      location = parts[0];
      maxPrice = parts[1] ? parseFloat(parts[1]) : null;
      guests = parts[2] ? parseInt(parts[2]) : null;
    }
    
    // Build query
    const whereClause = {
      isApproved: true,
      isAvailable: true
    };
    
    if (location && location !== '') {
      whereClause[Op.or] = [
        { location: { [Op.like]: `%${location}%` } },
        { title: { [Op.like]: `%${location}%` } }
      ];
    }
    
    if (maxPrice) {
      whereClause.pricePerNight = { [Op.lte]: maxPrice };
    }
    
    if (guests) {
      whereClause.maxGuests = { [Op.gte]: guests };
    }
    
    const apartments = await Apartment.findAll({
      where: whereClause,
      include: [{
        model: User,
        attributes: ['id', 'firstName', 'username']
      }],
      order: [['created_at', 'DESC']],
      limit: 20
    });
    
    if (apartments.length === 0) {
      await bot.sendMessage(chatId, 
        '😕 No apartments found matching your criteria.\n\n' +
        'Try:\n' +
        '• Using a different location\n' +
        '• Increasing your budget\n' +
        '• Reducing the number of guests\n' +
        '• Checking back later for new listings'
      );
      return;
    }
    
    await bot.sendMessage(chatId, 
      `✅ Found ${apartments.length} apartment(s) matching your search:\n`
    );
    
    for (const apt of apartments) {
      await sendApartmentDetails(bot, chatId, apt);
    }
    
    delete searchState[chatId];
    
  } catch (error) {
    logger.error('Search processing error:', error);
    bot.sendMessage(chatId, 'Error processing search. Please try again.');
  }
};

const sendApartmentDetails = async (bot, chatId, apartment) => {
  try {
    // Increment view count
    apartment.views += 1;
    await apartment.save();
    
    const amenities = apartment.amenities || [];
    const amenitiesList = amenities.slice(0, 5).map(a => `• ${a}`).join('\n');
    
    const details = `
🏠 *${apartment.title}*

📍 *Location:* ${apartment.location}
💰 *Price:* ${formatCurrency(apartment.pricePerNight)}/night
👥 *Max Guests:* ${apartment.maxGuests}
🛏 *Bedrooms:* ${apartment.bedrooms}
🚿 *Bathrooms:* ${apartment.bathrooms}

📝 *Description:*
${apartment.description || 'No description provided.'}

✨ *Key Amenities:*
${amenitiesList || '• Basic amenities included'}

👤 *Hosted by:* ${apartment.User?.firstName || 'Property Manager'}
📊 *Views:* ${apartment.views}
    `;
    
    const keyboard = createApartmentKeyboard(apartment.id);
    
    if (apartment.images && apartment.images.length > 0) {
      // Send first photo with details
      await bot.sendPhoto(chatId, apartment.images[0], {
        caption: details,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
      
      // Send additional photos if any
      if (apartment.images.length > 1) {
        const media = apartment.images.slice(1, 5).map(img => ({
          type: 'photo',
          media: img
        }));
        
        if (media.length > 0) {
          await bot.sendMediaGroup(chatId, media);
        }
      }
    } else {
      await bot.sendMessage(chatId, details, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }
  } catch (error) {
    logger.error('Send apartment details error:', error);
  }
};

const handleApartmentDetails = async (bot, callbackQuery, apartmentId) => {
  const chatId = callbackQuery.message.chat.id;
  
  try {
    const apartment = await Apartment.findByPk(apartmentId, {
      include: [{
        model: User,
        attributes: ['id', 'firstName', 'username', 'phone']
      }]
    });
    
    if (!apartment) {
      await bot.sendMessage(chatId, 'Apartment not found.');
      return;
    }
    
    await sendApartmentDetails(bot, chatId, apartment);
    
  } catch (error) {
    logger.error('Apartment details error:', error);
    bot.sendMessage(chatId, 'Error loading apartment details.');
  }
};

const handleAmenities = async (bot, callbackQuery, apartmentId) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  
  try {
    const apartment = await Apartment.findByPk(apartmentId);
    
    if (!apartment || !apartment.amenities) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'No amenities listed for this apartment'
      });
      return;
    }
    
    const amenities = apartment.amenities;
    const amenitiesText = amenities.map((a, i) => `${i+1}. ${a}`).join('\n');
    
    const text = `
✨ *Amenities for ${apartment.title}*

${amenitiesText}

${amenities.length} amenities available.
    `;
    
    await bot.editMessageCaption(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Back to Apartment', callback_data: `view_${apartmentId}` }]
        ]
      }
    });
    
  } catch (error) {
    logger.error('Amenities error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error loading amenities' });
  }
};

const handleAddApartment = async (bot, msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  try {
    const user = await User.findOne({ where: { telegramId: userId } });
    
    if (!user || (user.role !== 'owner' && user.role !== 'admin')) {
      await bot.sendMessage(chatId, 
        'You need to be registered as an owner first.\n\n' +
        'Use /register\\_owner to get started.'
      , { parse_mode: 'Markdown' });
      return;
    }
    
    // Initialize apartment data in redis cache
    const sessionId = `add_apt_${chatId}`;
    await redis.set(sessionId, JSON.stringify({
      step: 'title',
      data: {}
    }), 'EX', 3600); // 1 hour expiry
    
    await bot.sendMessage(chatId, 
      "📝 *Let's add your apartment!*\n\n" +
      "Please enter the *title* of your apartment:",
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    logger.error('Add apartment error:', error);
    bot.sendMessage(chatId, 'Error starting apartment addition. Please try again.');
  }
};

module.exports = {
  handleSearch,
  processSearch,
  handleApartmentDetails,
  handleAmenities,
  handleAddApartment,
  searchState
};

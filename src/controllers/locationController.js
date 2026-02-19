// src/controllers/locationController.js
const { Apartment } = require('../models');
const logger = require('../config/logger');

// Popular Abuja locations with emojis - UPDATED
const popularLocations = [
  { id: 'asokoro', name: 'Asokoro', emoji: '🏛️' },
  { id: 'maitama', name: 'Maitama', emoji: '🏰' },
  { id: 'wuse', name: 'Wuse', emoji: '🏢' }, // 👈 CHANGED: from 'wuse2' to 'wuse', from 'Wuse 2' to 'Wuse'
  { id: 'garki', name: 'Garki', emoji: '🏙️' },
  { id: 'jabi', name: 'Jabi', emoji: '🌳' },
  { id: 'gwarinpa', name: 'Gwarinpa', emoji: '🏘️' },
  { id: 'utako', name: 'Utako', emoji: '🏬' },
  { id: 'central', name: 'Central Area', emoji: '🏛️' },
  { id: 'life-camp', name: 'Life Camp', emoji: '🏡' },
  { id: 'guzape', name: 'Guzape', emoji: '🏠' },
  { id: 'katampe', name: 'Katampe', emoji: '🏞️' },
  { id: 'kubwa', name: 'Kubwa', emoji: '🏘️' },
  { id: 'lugbe', name: 'Lugbe', emoji: '🏡' }
];

// Apartment types for filtering
const apartmentTypes = [
  { id: 'studio', name: 'Studio Apartment', emoji: '🏠', bedrooms: 0 },
  { id: '1bed', name: '1-Bedroom', emoji: '🛏️', bedrooms: 1 },
  { id: '2bed', name: '2-Bedroom', emoji: '🛏️🛏️', bedrooms: 2 },
  { id: '3bed', name: '3-Bedroom', emoji: '🏰', bedrooms: 3 }
];

// Handle showing location selection menu
const handleLocationSelection = async (bot, msg) => {
  const chatId = msg.chat.id;
  
  try {
    // Create keyboard with location buttons (3 per row)
    const locationKeyboard = [];
    
    // Group locations in rows of 3
    for (let i = 0; i < popularLocations.length; i += 3) {
      const row = popularLocations.slice(i, i + 3).map(loc => ({
        text: `${loc.emoji} ${loc.name}`,
        callback_data: `location_${loc.id}`
      }));
      locationKeyboard.push(row);
    }
    
    // Add back button
    locationKeyboard.push([
      { text: '« Back to Menu', callback_data: 'back_to_main' }
    ]);
    
    await bot.sendMessage(chatId, 
      `📍 *Select a Location*\n\n` +
      `Please choose an area in Abuja to search for apartments:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: locationKeyboard
        }
      }
    );
    
  } catch (error) {
    logger.error('Location selection error:', error);
    bot.sendMessage(chatId, 'Error loading locations. Please try again.');
  }
};

// Handle when user clicks on a location
const handleLocationCallback = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  
  try {
    // Extract location ID from callback data (format: "location_asokoro")
    const locationId = data.replace('location_', '');
    
    // Find the location name
    const location = popularLocations.find(loc => loc.id === locationId);
    
    if (!location) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Location not found!' });
      return;
    }
    
    // Acknowledge the callback
    await bot.answerCallbackQuery(callbackQuery.id);
    
    // Show apartment type selection menu
    await showApartmentTypeSelection(bot, chatId, messageId, location);
    
  } catch (error) {
    logger.error('Location callback error:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error. Please try again.' });
  }
};

// Show apartment type selection after location
const showApartmentTypeSelection = async (bot, chatId, messageId, location) => {
  try {
    // Create keyboard with apartment type buttons
    const typeKeyboard = [];
    
    // Group types in rows of 2
    for (let i = 0; i < apartmentTypes.length; i += 2) {
      const row = apartmentTypes.slice(i, i + 2).map(type => ({
        text: `${type.emoji} ${type.name}`,
        callback_data: `type_${location.id}_${type.id}`
      }));
      typeKeyboard.push(row);
    }
    
    // Add back button to change location
    typeKeyboard.push([
      { text: '« Change Location', callback_data: 'show_locations' },
      { text: '« Menu', callback_data: 'back_to_main' }
    ]);
    
    await bot.editMessageText(
      `📍 *${location.emoji} ${location.name}*\n\n` +
      `🏠 *Select Apartment Type:*\n\n` +
      `Please choose the type of apartment you're looking for:`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: typeKeyboard
        }
      }
    );
    
  } catch (error) {
    logger.error('Show apartment type error:', error);
  }
};

// Handle apartment type selection
const handleApartmentTypeCallback = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  
  try {
    // Extract data (format: "type_locationId_typeId")
    const parts = data.split('_');
    const locationId = parts[1];
    const typeId = parts[2];
    
    // Find location and type
    const location = popularLocations.find(loc => loc.id === locationId);
    const type = apartmentTypes.find(t => t.id === typeId);
    
    if (!location || !type) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Selection not found!' });
      return;
    }
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
    // Show loading message
    await bot.editMessageText(
      `🔍 *Searching ${type.emoji} ${type.name}s in ${location.emoji} ${location.name}...*`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      }
    );
    
    // Build bedroom filter based on type
    let bedroomFilter = {};
    if (typeId === 'studio') {
      bedroomFilter = { bedrooms: 0 };
    } else if (typeId === '1bed') {
      bedroomFilter = { bedrooms: 1 };
    } else if (typeId === '2bed') {
      bedroomFilter = { bedrooms: 2 };
    } else if (typeId === '3bed') {
      bedroomFilter = { bedrooms: { [Op.gte]: 3 } };
    }
    
    // Fetch apartments matching location and type
    const { Op } = require('sequelize');
    const apartments = await Apartment.findAll({
      where: {
        location: location.name,
        isAvailable: true,
        isApproved: true,
        ...bedroomFilter
      },
      limit: 10
    });
    
    if (apartments.length === 0) {
      // No apartments found
      await bot.sendMessage(chatId,
        `🏠 *No ${type.name}s found in ${location.emoji} ${location.name}*\n\n` +
        `Would you like to try another type or location?`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏠 Change Apartment Type', callback_data: `location_${locationId}` }],
              [{ text: '📍 Change Location', callback_data: 'show_locations' }],
              [{ text: '« Menu', callback_data: 'back_to_main' }]
            ]
          }
        }
      );
    } else {
      // Send first result
      await sendApartmentResult(bot, chatId, apartments[0], 0, apartments.length, location, type);
    }
    
  } catch (error) {
    logger.error('Apartment type callback error:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error fetching apartments.' });
  }
};

// Send apartment result
const sendApartmentResult = async (bot, chatId, apartment, index, total, location, type = null) => {
  try {
    // Format amenities if available
    let amenitiesText = '';
    if (apartment.amenities) {
      const amenities = Array.isArray(apartment.amenities) 
        ? apartment.amenities.join(', ') 
        : apartment.amenities;
      amenitiesText = `✨ *Amenities:* ${amenities}\n`;
    }
    
    // Get bedroom emoji based on bedroom count
    let bedroomEmoji = '🛏️';
    if (apartment.bedrooms >= 3) bedroomEmoji = '🏰';
    else if (apartment.bedrooms === 2) bedroomEmoji = '🛏️🛏️';
    else if (apartment.bedrooms === 1) bedroomEmoji = '🛏️';
    else if (apartment.bedrooms === 0) bedroomEmoji = '🏠';
    
    const text = `
${index + 1}/${total} ${location.emoji} *${apartment.title}*

${bedroomEmoji} *Type:* ${apartment.bedrooms === 0 ? 'Studio' : apartment.bedrooms + '-Bedroom'}
📍 *Location:* ${apartment.location}
💰 *Price:* ₦${apartment.pricePerNight?.toLocaleString() || 'N/A'}/night
🛏️ *Bedrooms:* ${apartment.bedrooms || 'N/A'}
🛁 *Bathrooms:* ${apartment.bathrooms || 'N/A'}
📝 *Description:* ${apartment.description || 'No description available'}
${amenitiesText}
    `;
    
    // Create navigation keyboard
    const keyboard = [];
    const navRow = [];
    
    if (index > 0) {
      navRow.push({ text: '« Previous', callback_data: `apt_prev_${index}_${location.id}_${type?.id || 'all'}` });
    }
    
    navRow.push({ text: '📅 Request Booking', callback_data: `book_${apartment.id}` }); // UPDATED: Book Now → Request Booking
    
    if (index < total - 1) {
      navRow.push({ text: 'Next »', callback_data: `apt_next_${index}_${location.id}_${type?.id || 'all'}` });
    }
    
    keyboard.push(navRow);
    keyboard.push([
      { text: '🏠 Change Type', callback_data: `location_${location.id}` },
      { text: '📍 Change Location', callback_data: 'show_locations' },
      { text: '« Menu', callback_data: 'back_to_main' }
    ]);
    
    // Send with photo if available
    if (apartment.images && apartment.images.length > 0) {
      await bot.sendPhoto(chatId, apartment.images[0], {
        caption: text,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } else {
      await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    }
    
  } catch (error) {
    logger.error('Send apartment result error:', error);
  }
};

module.exports = {
  handleLocationSelection,
  handleLocationCallback,
  handleApartmentTypeCallback,
  popularLocations,
  apartmentTypes
};

// src/controllers/locationController.js
const { Apartment } = require('../models');
const logger = require('../config/logger');

// Popular Abuja locations with emojis - UPDATED with sub-locations
const popularLocations = [
  { id: 'asokoro', name: 'Asokoro', emoji: '🏛️' },
  { id: 'maitama', name: 'Maitama', emoji: '🏰' },
  { id: 'central', name: 'Central Area', emoji: '🏛️' },
  { 
    id: 'wuse', 
    name: 'Wuse', 
    emoji: '🏢',
    subLocations: [
      'Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 
      'Zone 5', 'Zone 6', 'Zone 7'
    ]
  },
  { 
    id: 'garki', 
    name: 'Garki', 
    emoji: '🏙️',
    subLocations: [
      'Area 1', 'Area 2', 'Area 3', 'Area 4', 'Area 5',
      'Area 6', 'Area 7', 'Area 8', 'Area 9', 'Area 10', 'Area 11'
    ]
  },
  { id: 'jabi', name: 'Jabi', emoji: '🌳' },
  { id: 'utako', name: 'Utako', emoji: '🏬' },
  { id: 'wuye', name: 'Wuye', emoji: '🏗️' },
  { id: 'life-camp', name: 'Life Camp', emoji: '🏡' },
  { id: 'guzape', name: 'Guzape', emoji: '🏠' },
  { id: 'gwarinpa', name: 'Gwarinpa', emoji: '🏘️' },
  { id: 'kubwa', name: 'Kubwa', emoji: '🏘️' },
  { id: 'apo', name: 'Apo', emoji: '🏠' }
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
    // Extract location ID from callback data
    const locationId = data.replace('location_', '');
    
    // Find the location
    const location = popularLocations.find(loc => loc.id === locationId);
    
    if (!location) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Location not found!' });
      return;
    }
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
    // Check if location has sub-locations
    if (location.subLocations && location.subLocations.length > 0) {
      // Show sub-locations first
      await showSubLocationMenu(bot, chatId, messageId, location);
    } else {
      // No sub-locations, go directly to apartment type selection
      await showApartmentTypeSelection(bot, chatId, messageId, location);
    }
    
  } catch (error) {
    logger.error('Location callback error:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error. Please try again.' });
  }
};

// Show sub-location menu for areas with zones/areas
const showSubLocationMenu = async (bot, chatId, messageId, location) => {
  try {
    // Create keyboard with sub-location buttons
    const subLocationKeyboard = [];
    
    // Group sub-locations in rows of 2 (better for longer names like "Zone 1", "Area 11")
    for (let i = 0; i < location.subLocations.length; i += 2) {
      const row = location.subLocations.slice(i, i + 2).map(sub => ({
        text: `${sub}`,
        callback_data: `subloc_${location.id}_${sub.replace(/ /g, '_')}`
      }));
      subLocationKeyboard.push(row);
    }
    
    // Add "All Areas" button and back button
    subLocationKeyboard.push([
      { text: '📍 All Areas', callback_data: `type_${location.id}_all` }
    ]);
    subLocationKeyboard.push([
      { text: '« Back to Locations', callback_data: 'show_locations' }
    ]);
    
    await bot.editMessageText(
      `📍 *${location.emoji} ${location.name}*\n\n` +
      `Please select a specific area or choose "All Areas" to see everything in ${location.name}:`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: subLocationKeyboard
        }
      }
    );
    
  } catch (error) {
    logger.error('Show sub-location error:', error);
  }
};

// Show apartment type selection after location/sub-location
const showApartmentTypeSelection = async (bot, chatId, messageId, location, subLocation = null) => {
  try {
    // Create keyboard with apartment type buttons
    const typeKeyboard = [];
    
    // Group types in rows of 2
    for (let i = 0; i < apartmentTypes.length; i += 2) {
      const row = apartmentTypes.slice(i, i + 2).map(type => ({
        text: `${type.emoji} ${type.name}`,
        callback_data: subLocation 
          ? `type_${location.id}_${type.id}_${subLocation.replace(/ /g, '_')}`
          : `type_${location.id}_${type.id}`
      }));
      typeKeyboard.push(row);
    }
    
    // Add back button based on whether we came from sub-location or main location
    const backButton = subLocation 
      ? { text: '« Change Area', callback_data: `location_${location.id}` }
      : { text: '« Change Location', callback_data: 'show_locations' };
    
    typeKeyboard.push([
      backButton,
      { text: '« Menu', callback_data: 'back_to_main' }
    ]);
    
    const locationDisplay = subLocation 
      ? `${location.name} - ${subLocation}` 
      : location.name;
    
    await bot.editMessageText(
      `📍 *${location.emoji} ${locationDisplay}*\n\n` +
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

// Handle apartment type selection (updated for sub-locations)
const handleApartmentTypeCallback = async (bot, callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  
  try {
    const parts = data.split('_');
    const locationId = parts[1];
    const typeId = parts[2];
    const subLocation = parts.length > 3 ? parts.slice(3).join('_').replace(/_/g, ' ') : null;
    
    const location = popularLocations.find(loc => loc.id === locationId);
    
    if (!location) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Location not found!' });
      return;
    }
    
    // If this is the "All Areas" option
    if (typeId === 'all') {
      await bot.answerCallbackQuery(callbackQuery.id);
      
      const searchLocation = subLocation || location.name;
      await bot.editMessageText(
        `🔍 *Searching all apartments in ${location.emoji} ${searchLocation}...*`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown'
        }
      );
      
      // Build location filter
      let locationFilter = {};
      if (subLocation) {
        // If searching in a specific sub-location
        locationFilter = {
          [Op.or]: [
            { location: `${location.name} - ${subLocation}` },
            { location: { [Op.like]: `%${subLocation}%` } },
            { address: { [Op.like]: `%${subLocation}%` } }
          ]
        };
      } else {
        locationFilter = { location: location.name };
      }
      
      const { Op } = require('sequelize');
      const apartments = await Apartment.findAll({
        where: {
          ...locationFilter,
          isApproved: true
        },
        limit: 10
      });
      
      if (apartments.length === 0) {
        await bot.sendMessage(chatId,
          `🏠 *No apartments found in ${location.emoji} ${searchLocation}*\n\n` +
          `Would you like to try another location?`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📍 Change Location', callback_data: 'show_locations' }],
                [{ text: '« Menu', callback_data: 'back_to_main' }]
              ]
            }
          }
        );
      } else {
        await sendApartmentResult(bot, chatId, apartments[0], 0, apartments.length, location, null, subLocation);
      }
      return;
    }
    
    // Handle regular apartment type selection
    const type = apartmentTypes.find(t => t.id === typeId);
    
    if (!type) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Type not found!' });
      return;
    }
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
    const searchLocation = subLocation || location.name;
    await bot.editMessageText(
      `🔍 *Searching ${type.emoji} ${type.name}s in ${location.emoji} ${searchLocation}...*`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      }
    );
    
    const { Op } = require('sequelize');
    
    let bedroomFilter = {};
    if (typeId === 'studio') bedroomFilter = { bedrooms: 0 };
    else if (typeId === '1bed') bedroomFilter = { bedrooms: 1 };
    else if (typeId === '2bed') bedroomFilter = { bedrooms: 2 };
    else if (typeId === '3bed') bedroomFilter = { bedrooms: { [Op.gte]: 3 } };
    
    // Build location filter
    let locationFilter = {};
    if (subLocation) {
      // If searching in a specific sub-location
      locationFilter = {
        [Op.or]: [
          { location: `${location.name} - ${subLocation}` },
          { location: { [Op.like]: `%${subLocation}%` } },
          { address: { [Op.like]: `%${subLocation}%` } }
        ]
      };
    } else {
      locationFilter = { location: location.name };
    }
    
    const apartments = await Apartment.findAll({
      where: {
        ...locationFilter,
        isApproved: true,
        ...bedroomFilter
      },
      limit: 10
    });
    
    if (apartments.length === 0) {
      await bot.sendMessage(chatId,
        `🏠 *No ${type.name}s found in ${location.emoji} ${searchLocation}*\n\n` +
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
      await sendApartmentResult(bot, chatId, apartments[0], 0, apartments.length, location, type, subLocation);
    }
    
  } catch (error) {
    logger.error('Apartment type callback error:', error);
  }
};

// Send apartment result (updated for sub-locations)
const sendApartmentResult = async (bot, chatId, apartment, index, total, location, type = null, subLocation = null) => {
  try {
    let amenitiesText = '';
    if (apartment.amenities) {
      const amenities = Array.isArray(apartment.amenities) 
        ? apartment.amenities.join(', ') 
        : apartment.amenities;
      amenitiesText = `✨ *Amenities:* ${amenities}\n`;
    }
    
    let bedroomEmoji = '🛏️';
    if (apartment.bedrooms >= 3) bedroomEmoji = '🏰';
    else if (apartment.bedrooms === 2) bedroomEmoji = '🛏️🛏️';
    else if (apartment.bedrooms === 1) bedroomEmoji = '🛏️';
    else if (apartment.bedrooms === 0) bedroomEmoji = '🏠';
    
    // Determine the display location
    let displayLocation = apartment.location;
    // If we have subLocation but apartment.location doesn't include it, show both
    if (subLocation && !apartment.location.includes(subLocation)) {
      displayLocation = `${location.name} - ${subLocation}`;
    }
    
    const text = `
${index + 1}/${total} ${location.emoji} *${apartment.title}*

${bedroomEmoji} *Type:* ${apartment.bedrooms === 0 ? 'Studio' : apartment.bedrooms + '-Bedroom'}
📍 *Location:* ${displayLocation}
💰 *Price:* ₦${apartment.pricePerNight?.toLocaleString() || 'N/A'}/night
🛏️ *Bedrooms:* ${apartment.bedrooms || 'N/A'}
🛁 *Bathrooms:* ${apartment.bathrooms || 'N/A'}
📝 *Description:* ${apartment.description || 'No description available'}
${amenitiesText}
    `;
    
    const keyboard = [];
    const navRow = [];
    
    // Build callback data for navigation
    const navSubLocation = subLocation ? subLocation.replace(/ /g, '_') : 'none';
    
    if (index > 0) {
      navRow.push({ text: '« Previous', callback_data: `apt_prev_${index}_${location.id}_${type?.id || 'all'}_${navSubLocation}` });
    }
    
    navRow.push({ text: '📅 Request Booking', callback_data: `book_${apartment.id}` });
    
    if (index < total - 1) {
      navRow.push({ text: 'Next »', callback_data: `apt_next_${index}_${location.id}_${type?.id || 'all'}_${navSubLocation}` });
    }
    
    keyboard.push(navRow);
    
    // Back button - return to appropriate menu
    const backButton = subLocation 
      ? { text: '« Back to Area', callback_data: `location_${location.id}` }
      : { text: '« Back to Location', callback_data: 'show_locations' };
    
    keyboard.push([
      backButton,
      { text: '« Menu', callback_data: 'back_to_main' }
    ]);
    
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
  showSubLocationMenu,
  showApartmentTypeSelection,
  popularLocations,
  apartmentTypes
};

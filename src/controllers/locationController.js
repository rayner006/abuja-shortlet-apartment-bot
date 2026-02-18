// src/controllers/locationController.js
const { Apartment } = require('../models');
const logger = require('../config/logger');

// Popular Abuja locations with emojis
const popularLocations = [
  { id: 'asokoro', name: 'Asokoro', emoji: '🏛️' },
  { id: 'maitama', name: 'Maitama', emoji: '🏰' },
  { id: 'wuse2', name: 'Wuse 2', emoji: '🏢' },
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
    
    // Edit the original message to show loading
    await bot.editMessageText(
      `🔍 *Searching apartments in ${location.emoji} ${location.name}...*`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      }
    );
    
    // Fetch apartments in this location
    const apartments = await Apartment.findAll({
      where: {
        location: location.name,
        isAvailable: true,
        isApproved: true
      },
      limit: 10
    });
    
    if (apartments.length === 0) {
      // No apartments found
      await bot.sendMessage(chatId,
        `🏠 *No apartments found in ${location.emoji} ${location.name}*\n\n` +
        `Would you like to try another location?`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📍 Choose Another Location', callback_data: 'show_locations' }],
              [{ text: '« Back to Menu', callback_data: 'back_to_main' }]
            ]
          }
        }
      );
    } else {
      // Send first result
      await sendApartmentResult(bot, chatId, apartments[0], 0, apartments.length, location);
    }
    
  } catch (error) {
    logger.error('Location callback error:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error fetching apartments. Please try again.' });
  }
};

// Send apartment result with navigation
const sendApartmentResult = async (bot, chatId, apartment, index, total, location) => {
  try {
    // Format amenities if available
    let amenitiesText = '';
    if (apartment.amenities) {
      const amenities = Array.isArray(apartment.amenities) 
        ? apartment.amenities.join(', ') 
        : apartment.amenities;
      amenitiesText = `✨ *Amenities:* ${amenities}\n`;
    }
    
    const text = `
${index + 1}/${total} ${location.emoji} *${apartment.title}*

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
      navRow.push({ text: '« Previous', callback_data: `apt_prev_${index}_${location.id}` });
    }
    
    navRow.push({ text: '📅 Book Now', callback_data: `book_${apartment.id}` });
    
    if (index < total - 1) {
      navRow.push({ text: 'Next »', callback_data: `apt_next_${index}_${location.id}` });
    }
    
    keyboard.push(navRow);
    keyboard.push([
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
  popularLocations
};

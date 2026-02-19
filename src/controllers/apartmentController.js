// src/controllers/apartmentController.js
const { Apartment, User, Booking } = require('../models');
const { Op } = require('sequelize');
const { createApartmentKeyboard } = require('../utils/keyboards');
const { formatCurrency } = require('../utils/helpers');
const logger = require('../config/logger');
const redis = require('../config/redis');

// Search states (for conversation)
const searchState = {};

// Popular Abuja locations - COMPLETE LIST
const POPULAR_LOCATIONS = [
  // Premium & Central 🏙
  { id: 'asokoro', name: 'Asokoro', emoji: '🏛️' },
  { id: 'maitama', name: 'Maitama', emoji: '🏰' },
  { id: 'central', name: 'Central Area', emoji: '🏛️' },
  { id: 'cbd', name: 'CBD', emoji: '🏢' },
  { id: 'wuse', name: 'Wuse', emoji: '🏢' },
  { id: 'garki', name: 'Garki', emoji: '🏙️' },
  
  // Mid-Central Areas 🏢
  { id: 'jabi', name: 'Jabi', emoji: '🌳' },
  { id: 'utako', name: 'Utako', emoji: '🏬' },
  { id: 'wuye', name: 'Wuye', emoji: '🏗️' },
  { id: 'mabushi', name: 'Mabushi', emoji: '🏢' },
  { id: 'katampe', name: 'Katampe', emoji: '🏞️' },
  { id: 'jahi', name: 'Jahi', emoji: '🏡' },
  { id: 'life-camp', name: 'Life Camp', emoji: '🏡' },
  { id: 'guzape', name: 'Guzape', emoji: '🏠' },
  { id: 'lokogoma', name: 'Lokogoma', emoji: '🏘️' },
  
  // Outer & Budget Areas 🏘️
  { id: 'gwarinpa', name: 'Gwarinpa', emoji: '🏘️' },
  { id: 'kubwa', name: 'Kubwa', emoji: '🏘️' },
  { id: 'lugbe', name: 'Lugbe', emoji: '🏡' },
  { id: 'apo', name: 'Apo', emoji: '🏠' },
  { id: 'nyanya', name: 'Nyanya', emoji: '🏘️' },
  { id: 'karu', name: 'Karu', emoji: '🏘️' }
];

// Apartment types
const APARTMENT_TYPES = [
  { id: 'studio', name: 'Studio', emoji: '🏠', bedrooms: 0 },
  { id: '1bed', name: '1-Bedroom', emoji: '🛏️', bedrooms: 1 },
  { id: '2bed', name: '2-Bedroom', emoji: '🛏️🛏️', bedrooms: 2 },
  { id: '3bed', name: '3-Bedroom', emoji: '🏰', bedrooms: 3 }
];

// Price ranges
const PRICE_RANGES = [
  { id: 'under50', name: 'Under ₦50,000', min: 0, max: 50000, display: '💰 Under ₦50k' },
  { id: '50_100', name: '₦50,000 - ₦100,000', min: 50000, max: 100000, display: '💰 ₦50k-100k' },
  { id: '100_150', name: '₦100,000 - ₦150,000', min: 100000, max: 150000, display: '💰 ₦100k-150k' },
  { id: '150_200', name: '₦150,000 - ₦200,000', min: 150000, max: 200000, display: '💰 ₦150k-200k' },
  { id: '200plus', name: '₦200,000+', min: 200000, max: null, display: '💰 ₦200k+' }
];

// Amenities
const AMENITIES = [
  { id: 'wifi', name: 'WiFi', emoji: '📶' },
  { id: 'ac', name: 'AC', emoji: '❄️' },
  { id: 'generator', name: 'Generator', emoji: '⚡' },
  { id: 'pool', name: 'Swimming Pool', emoji: '🏊' },
  { id: 'parking', name: 'Parking', emoji: '🅿️' },
  { id: 'security', name: 'Security', emoji: '🛡️' },
  { id: 'kitchen', name: 'Kitchen', emoji: '🍳' },
  { id: 'tv', name: 'Smart TV', emoji: '📺' }
];

// ============================================
// PROFESSIONAL SEARCH INTERFACE
// ============================================

const handleSearch = async (bot, msg) => {
  const chatId = msg.chat.id;
  
  const searchText = `
🔍 *Search Apartments in Abuja*

👇 *Choose how you want to search:*
  `;
  
  const keyboard = {
    inline_keyboard: [
      [{ text: '📍 Search by Location', callback_data: 'search_menu_location' }],
      [{ text: '🏠 Search by Apartment Type', callback_data: 'search_menu_type' }],
      [{ text: '💰 Search by Budget', callback_data: 'search_menu_price' }],
      [{ text: '✨ Search by Amenities', callback_data: 'search_menu_amenities' }],
      [{ text: '🔎 Advanced Search', callback_data: 'search_menu_advanced' }],
      [{ text: '« Back to Main Menu', callback_data: 'back_to_main' }]
    ]
  };

  await bot.sendMessage(chatId, searchText, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
  
  searchState[chatId] = { step: 'menu' };
};

// ============================================
// SEARCH CALLBACK HANDLER
// ============================================

const handleSearchCallback = async (bot, callbackQuery) => {
  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  
  try {
    if (!searchState[chatId]) {
      searchState[chatId] = {
        filters: {
          location: null,
          type: null,
          priceMin: null,
          priceMax: null,
          amenities: []
        },
        step: 'menu'
      };
    }

    if (data === 'search_menu_location') {
      await showLocationMenu(bot, chatId, messageId);
    }
    else if (data === 'search_menu_type') {
      await showTypeMenu(bot, chatId, messageId);
    }
    else if (data === 'search_menu_price') {
      await showPriceMenu(bot, chatId, messageId);
    }
    else if (data === 'search_menu_amenities') {
      await showAmenitiesMenu(bot, chatId, messageId);
    }
    else if (data === 'search_menu_advanced') {
      await showAdvancedSearch(bot, chatId, messageId);
    }
    else if (data.startsWith('search_loc_')) {
      await handleLocationSelection(bot, chatId, messageId, data);
    }
    else if (data.startsWith('search_type_')) {
      await handleTypeSelection(bot, chatId, messageId, data);
    }
    else if (data.startsWith('search_price_')) {
      await handlePriceSelection(bot, chatId, messageId, data);
    }
    else if (data.startsWith('search_amenity_')) {
      await handleAmenitySelection(bot, chatId, messageId, data, callbackQuery);
    }
    else if (data === 'search_apply_amenities') {
      await applyAmenityFilters(bot, chatId, messageId);
    }
    else if (data === 'search_back') {
      await handleSearch(bot, { chat: { id: chatId } });
      await bot.deleteMessage(chatId, messageId).catch(() => {});
    }
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('Search callback error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error processing search' });
  }
};

// ============================================
// MENU DISPLAY FUNCTIONS - UPDATED WITH ALL LOCATIONS
// ============================================

const showLocationMenu = async (bot, chatId, messageId) => {
  const text = `
📍 *Search by Location*

Select a location to find apartments:
  `;
  
  const keyboard = {
    inline_keyboard: [
      // Premium & Central Row 1
      [
        { text: '🏛️ Asokoro', callback_data: 'search_loc_asokoro' },
        { text: '🏰 Maitama', callback_data: 'search_loc_maitama' },
        { text: '🏛️ Central', callback_data: 'search_loc_central' }
      ],
      // Premium & Central Row 2
      [
        { text: '🏢 CBD', callback_data: 'search_loc_cbd' },
        { text: '🏢 Wuse', callback_data: 'search_loc_wuse' },
        { text: '🏙️ Garki', callback_data: 'search_loc_garki' }
      ],
      // Mid-Central Row 1
      [
        { text: '🌳 Jabi', callback_data: 'search_loc_jabi' },
        { text: '🏬 Utako', callback_data: 'search_loc_utako' },
        { text: '🏗️ Wuye', callback_data: 'search_loc_wuye' }
      ],
      // Mid-Central Row 2
      [
        { text: '🏢 Mabushi', callback_data: 'search_loc_mabushi' },
        { text: '🏞️ Katampe', callback_data: 'search_loc_katampe' },
        { text: '🏡 Jahi', callback_data: 'search_loc_jahi' }
      ],
      // Mid-Central Row 3
      [
        { text: '🏡 Life Camp', callback_data: 'search_loc_life-camp' },
        { text: '🏠 Guzape', callback_data: 'search_loc_guzape' },
        { text: '🏘️ Lokogoma', callback_data: 'search_loc_lokogoma' }
      ],
      // Outer Areas Row 1
      [
        { text: '🏘️ Gwarinpa', callback_data: 'search_loc_gwarinpa' },
        { text: '🏘️ Kubwa', callback_data: 'search_loc_kubwa' },
        { text: '🏡 Lugbe', callback_data: 'search_loc_lugbe' }
      ],
      // Outer Areas Row 2
      [
        { text: '🏠 Apo', callback_data: 'search_loc_apo' },
        { text: '🏘️ Nyanya', callback_data: 'search_loc_nyanya' },
        { text: '🏘️ Karu', callback_data: 'search_loc_karu' }
      ],
      [{ text: '📍 All Locations', callback_data: 'search_loc_all' }],
      [{ text: '« Back to Search Menu', callback_data: 'search_back' }]
    ]
  };
  
  await bot.editMessageText(text, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
};

// ============================================
// LOCATION MAP - UPDATED WITH ALL LOCATIONS
// ============================================

const handleLocationSelection = async (bot, chatId, messageId, data) => {
  const locationId = data.replace('search_loc_', '');
  
  let whereClause = {
    isApproved: true
  };
  
  if (locationId === 'all') {
    await performSearch(bot, chatId, messageId, whereClause);
    return;
  }
  
  // Complete location map with all areas
  const locationMap = {
    'asokoro': 'Asokoro',
    'maitama': 'Maitama',
    'central': 'Central Area',
    'cbd': 'CBD',
    'wuse': 'Wuse',
    'garki': 'Garki',
    'jabi': 'Jabi',
    'utako': 'Utako',
    'wuye': 'Wuye',
    'mabushi': 'Mabushi',
    'katampe': 'Katampe',
    'jahi': 'Jahi',
    'life-camp': 'Life Camp',
    'guzape': 'Guzape',
    'lokogoma': 'Lokogoma',
    'gwarinpa': 'Gwarinpa',
    'kubwa': 'Kubwa',
    'lugbe': 'Lugbe',
    'apo': 'Apo',
    'nyanya': 'Nyanya',
    'karu': 'Karu'
  };
  
  const locationName = locationMap[locationId];
  if (locationName) {
    whereClause.location = { [Op.like]: `%${locationName}%` };
  }
  
  await performSearch(bot, chatId, messageId, whereClause);
};

// ============================================
// REST OF THE FILE STAYS THE SAME
// ============================================

// ... (all other functions remain unchanged)

// For brevity, I'm not repeating all the other functions here
// They remain exactly as they were in your original file

module.exports = {
  handleSearch,
  handleSearchCallback,
  processSearch,
  handleApartmentDetails,
  handleAmenities,
  handleAddApartment,
  searchState
};

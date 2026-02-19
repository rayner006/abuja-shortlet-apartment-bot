// src/controllers/apartmentController.js
const { Apartment, User, Booking } = require('../models');
const { Op } = require('sequelize');
const { createApartmentKeyboard } = require('../utils/keyboards');
const { formatCurrency } = require('../utils/helpers');
const logger = require('../config/logger');
const redis = require('../config/redis');

// Search states (for conversation)
const searchState = {};

// Popular Abuja locations
const POPULAR_LOCATIONS = [
  { id: 'asokoro', name: 'Asokoro', emoji: '🏛️' },
  { id: 'maitama', name: 'Maitama', emoji: '🏰' },
  { id: 'wuse2', name: 'Wuse 2', emoji: '🏢' },
  { id: 'garki', name: 'Garki', emoji: '🏙️' },
  { id: 'jabi', name: 'Jabi', emoji: '🌳' },
  { id: 'gwarinpa', name: 'Gwarinpa', emoji: '🏘️' },
  { id: 'utako', name: 'Utako', emoji: '🏬' },
  { id: 'kubwa', name: 'Kubwa', emoji: '🏘️' }
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
    // Initialize search state if not exists
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

    // Handle menu navigation
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
    
    // Handle location selections
    else if (data.startsWith('search_loc_')) {
      await handleLocationSelection(bot, chatId, messageId, data);
    }
    
    // Handle type selections
    else if (data.startsWith('search_type_')) {
      await handleTypeSelection(bot, chatId, messageId, data);
    }
    
    // Handle price selections
    else if (data.startsWith('search_price_')) {
      await handlePriceSelection(bot, chatId, messageId, data);
    }
    
    // Handle amenity selections
    else if (data.startsWith('search_amenity_')) {
      await handleAmenitySelection(bot, chatId, messageId, data, callbackQuery);
    }
    
    // Handle apply amenities
    else if (data === 'search_apply_amenities') {
      await applyAmenityFilters(bot, chatId, messageId);
    }
    
    // Handle back navigation
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
// MENU DISPLAY FUNCTIONS
// ============================================

const showLocationMenu = async (bot, chatId, messageId) => {
  const text = `
📍 *Search by Location*

Select a location to find apartments:
  `;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '🏛️ Asokoro', callback_data: 'search_loc_asokoro' },
        { text: '🏰 Maitama', callback_data: 'search_loc_maitama' }
      ],
      [
        { text: '🏢 Wuse 2', callback_data: 'search_loc_wuse2' },
        { text: '🏙️ Garki', callback_data: 'search_loc_garki' }
      ],
      [
        { text: '🌳 Jabi', callback_data: 'search_loc_jabi' },
        { text: '🏘️ Gwarinpa', callback_data: 'search_loc_gwarinpa' }
      ],
      [
        { text: '🏬 Utako', callback_data: 'search_loc_utako' },
        { text: '🏘️ Kubwa', callback_data: 'search_loc_kubwa' }
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

const showTypeMenu = async (bot, chatId, messageId) => {
  const text = `
🏠 *Search by Apartment Type*

Select the type of apartment you're looking for:
  `;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '🏠 Studio', callback_data: 'search_type_studio' },
        { text: '🛏️ 1-Bedroom', callback_data: 'search_type_1bed' }
      ],
      [
        { text: '🛏️🛏️ 2-Bedroom', callback_data: 'search_type_2bed' },
        { text: '🏰 3-Bedroom', callback_data: 'search_type_3bed' }
      ],
      [{ text: '✨ Any Type', callback_data: 'search_type_any' }],
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

const showPriceMenu = async (bot, chatId, messageId) => {
  const text = `
💰 *Search by Budget*

Select your price range (per night):
  `;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '💰 Under ₦50k', callback_data: 'search_price_under50' },
        { text: '💰 ₦50k-100k', callback_data: 'search_price_50_100' }
      ],
      [
        { text: '💰 ₦100k-150k', callback_data: 'search_price_100_150' },
        { text: '💰 ₦150k-200k', callback_data: 'search_price_150_200' }
      ],
      [
        { text: '💰 ₦200k+', callback_data: 'search_price_200plus' }
      ],
      [{ text: '💰 Any Price', callback_data: 'search_price_any' }],
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

const showAmenitiesMenu = async (bot, chatId, messageId) => {
  // Get current selected amenities from state
  const currentFilters = searchState[chatId]?.filters || { amenities: [] };
  const selectedAmenities = currentFilters.amenities || [];
  
  const text = `
✨ *Search by Amenities*

Select amenities you want (you can select multiple):
${selectedAmenities.length > 0 ? `\n✅ *Selected:* ${selectedAmenities.map(a => {
    const amenity = AMENITIES.find(am => am.id === a);
    return amenity ? `${amenity.emoji} ${amenity.name}` : a;
  }).join(', ')}\n` : ''}
  `;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: `📶 WiFi ${selectedAmenities.includes('wifi') ? '✅' : ''}`, callback_data: 'search_amenity_wifi' },
        { text: `❄️ AC ${selectedAmenities.includes('ac') ? '✅' : ''}`, callback_data: 'search_amenity_ac' }
      ],
      [
        { text: `⚡ Generator ${selectedAmenities.includes('generator') ? '✅' : ''}`, callback_data: 'search_amenity_generator' },
        { text: `🏊 Pool ${selectedAmenities.includes('pool') ? '✅' : ''}`, callback_data: 'search_amenity_pool' }
      ],
      [
        { text: `🅿️ Parking ${selectedAmenities.includes('parking') ? '✅' : ''}`, callback_data: 'search_amenity_parking' },
        { text: `🛡️ Security ${selectedAmenities.includes('security') ? '✅' : ''}`, callback_data: 'search_amenity_security' }
      ],
      [
        { text: `🍳 Kitchen ${selectedAmenities.includes('kitchen') ? '✅' : ''}`, callback_data: 'search_amenity_kitchen' },
        { text: `📺 Smart TV ${selectedAmenities.includes('tv') ? '✅' : ''}`, callback_data: 'search_amenity_tv' }
      ],
      [{ text: '✅ Apply Amenity Filters', callback_data: 'search_apply_amenities' }],
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

const showAdvancedSearch = async (bot, chatId, messageId) => {
  const text = `
🔎 *Advanced Search*

Enter your search criteria in the chat.

Format: *location, max price, guests*
Example: *Maitama, 100000, 4*

Or just type what you're looking for:
• "2-bedroom in Asokoro"
• "Wuse 2 under 50k"
• "Apartment with pool"
  `;
  
  const keyboard = {
    inline_keyboard: [
      [{ text: '« Back to Search Menu', callback_data: 'search_back' }]
    ]
  };
  
  searchState[chatId] = { step: 'awaiting_input' };
  
  await bot.editMessageText(text, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
};

// ============================================
// HANDLE LOCATION SELECTION
// ============================================

const handleLocationSelection = async (bot, chatId, messageId, data) => {
  const locationId = data.replace('search_loc_', '');
  
  let whereClause = {
    isApproved: true
    // isAvailable removed - now handled manually
  };
  
  if (locationId === 'all') {
    // Search all locations
    await performSearch(bot, chatId, messageId, whereClause);
    return;
  }
  
  // Map location ID to actual location name
  const locationMap = {
    'asokoro': 'Asokoro',
    'maitama': 'Maitama',
    'wuse2': 'Wuse 2',
    'garki': 'Garki',
    'jabi': 'Jabi',
    'gwarinpa': 'Gwarinpa',
    'utako': 'Utako',
    'kubwa': 'Kubwa'
  };
  
  const locationName = locationMap[locationId];
  if (locationName) {
    whereClause.location = { [Op.like]: `%${locationName}%` };
  }
  
  await performSearch(bot, chatId, messageId, whereClause);
};

// ============================================
// HANDLE TYPE SELECTION
// ============================================

const handleTypeSelection = async (bot, chatId, messageId, data) => {
  const typeId = data.replace('search_type_', '');
  
  let whereClause = {
    isApproved: true
    // isAvailable removed - now handled manually
  };
  
  if (typeId === 'any') {
    await performSearch(bot, chatId, messageId, whereClause);
    return;
  }
  
  // Map type ID to bedroom count
  const typeMap = {
    'studio': 0,
    '1bed': 1,
    '2bed': 2,
    '3bed': 3
  };
  
  const bedrooms = typeMap[typeId];
  if (bedrooms !== undefined) {
    if (typeId === '3bed') {
      whereClause.bedrooms = { [Op.gte]: 3 };
    } else {
      whereClause.bedrooms = bedrooms;
    }
  }
  
  await performSearch(bot, chatId, messageId, whereClause);
};

// ============================================
// HANDLE PRICE SELECTION
// ============================================

const handlePriceSelection = async (bot, chatId, messageId, data) => {
  const priceId = data.replace('search_price_', '');
  
  let whereClause = {
    isApproved: true
    // isAvailable removed - now handled manually
  };
  
  if (priceId === 'any') {
    await performSearch(bot, chatId, messageId, whereClause);
    return;
  }
  
  // Map price ID to range
  const priceMap = {
    'under50': { min: 0, max: 50000 },
    '50_100': { min: 50000, max: 100000 },
    '100_150': { min: 100000, max: 150000 },
    '150_200': { min: 150000, max: 200000 },
    '200plus': { min: 200000, max: null }
  };
  
  const range = priceMap[priceId];
  if (range) {
    if (range.max) {
      whereClause.pricePerNight = { [Op.between]: [range.min, range.max] };
    } else {
      whereClause.pricePerNight = { [Op.gte]: range.min };
    }
  }
  
  await performSearch(bot, chatId, messageId, whereClause);
};

// ============================================
// HANDLE AMENITY SELECTION
// ============================================

const handleAmenitySelection = async (bot, chatId, messageId, data, callbackQuery) => {
  const amenityId = data.replace('search_amenity_', '');
  
  // Initialize filters if needed
  if (!searchState[chatId]) {
    searchState[chatId] = {
      filters: {
        location: null,
        type: null,
        priceMin: null,
        priceMax: null,
        amenities: []
      }
    };
  }
  
  // Toggle amenity selection
  const amenities = searchState[chatId].filters.amenities || [];
  const index = amenities.indexOf(amenityId);
  if (index === -1) {
    amenities.push(amenityId);
  } else {
    amenities.splice(index, 1);
  }
  searchState[chatId].filters.amenities = amenities;
  
  // Refresh the amenities menu to show selection
  await showAmenitiesMenu(bot, chatId, messageId);
};

// ============================================
// APPLY AMENITY FILTERS
// ============================================

const applyAmenityFilters = async (bot, chatId, messageId) => {
  const filters = searchState[chatId]?.filters || { amenities: [] };
  const selectedAmenities = filters.amenities || [];
  
  let whereClause = {
    isApproved: true
    // isAvailable removed - now handled manually
  };
  
  if (selectedAmenities.length > 0) {
    // This is a simplified approach - in production you might need a more complex query
    // for JSON array containment based on your database structure
    whereClause.amenities = { [Op.contains]: selectedAmenities };
  }
  
  await performSearch(bot, chatId, messageId, whereClause);
};

// ============================================
// SEARCH EXECUTION
// ============================================

const performSearch = async (bot, chatId, messageId, whereClause) => {
  try {
    // Show loading message
    await bot.editMessageText('🔍 *Searching for apartments...*', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });
    
    const apartments = await Apartment.findAll({
      where: whereClause,
      include: [{
        model: User,
        attributes: ['id', 'firstName', 'username']
      }],
      order: [['created_at', 'DESC']]
    });
    
    await bot.deleteMessage(chatId, messageId).catch(() => {});
    
    if (apartments.length === 0) {
      await bot.sendMessage(chatId, 
        '😕 *No apartments found* matching your criteria.\n\n' +
        'Try:\n' +
        '• Using a different location\n' +
        '• Increasing your budget\n' +
        '• Removing some filters\n' +
        '• Checking back later for new listings',
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔍 New Search', callback_data: 'search_back' }],
              [{ text: '« Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        }
      );
    } else {
      await bot.sendMessage(chatId, 
        `✅ Found *${apartments.length}* apartment(s) matching your search:`,
        { parse_mode: 'Markdown' }
      );
      
      for (const apt of apartments) {
        await sendApartmentDetails(bot, chatId, apt);
      }
      
      // Add a new search button at the end
      await bot.sendMessage(chatId, 
        '🔍 *Want to search again?*',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔍 New Search', callback_data: 'search_back' }],
              [{ text: '« Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        }
      );
    }
    
    // Clear search state
    delete searchState[chatId];
    
  } catch (error) {
    logger.error('Search execution error:', error);
    bot.sendMessage(chatId, 'Error performing search. Please try again.');
  }
};

// ============================================
// EXISTING FUNCTIONS (Updated - removed availability)
// ============================================

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
    
    // Build query - removed isAvailable
    const whereClause = {
      isApproved: true
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

// ============================================
// UPDATED: sendApartmentDetails - removed availability
// ============================================

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

// ============================================
// EXPORTS
// ============================================

module.exports = {
  handleSearch,
  handleSearchCallback,
  processSearch,
  handleApartmentDetails,
  handleAmenities,
  handleAddApartment,
  searchState
};

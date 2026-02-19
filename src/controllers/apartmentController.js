// src/controllers/apartmentController.js
const pool = require('../config/database');
const logger = require('../config/logger');

// ============================================
// MAIN APARTMENT LISTING & SEARCH
// ============================================

/**
 * Handle main search menu - called from "Apartments" button and "Search" menu
 */
const handleSearch = async (bot, msg) => {
  const chatId = msg.chat.id;
  
  try {
    // 👇 DEBUG: Added console logs
    console.log('🔍 [DEBUG] handleSearch function STARTED for chat:', chatId);
    console.log('📦 [DEBUG] msg object received:', { 
      chatId: msg.chat.id, 
      from: msg.from ? msg.from.id : 'unknown',
      hasText: !!msg.text
    });
    
    const text = `
🔍 *Search Apartments*

How would you like to search for apartments?
    `;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📍 By Location', callback_data: 'search_menu_location' },
          { text: '🏠 By Type', callback_data: 'search_menu_type' }
        ],
        [
          { text: '💰 By Budget', callback_data: 'search_menu_price' },
          { text: '✨ By Amenities', callback_data: 'search_menu_amenities' }
        ],
        [
          { text: '🔎 Advanced Search', callback_data: 'search_menu_advanced' }
        ],
        [
          { text: '📋 Main Menu', callback_data: 'back_to_main' }
        ]
      ]
    };
    
    console.log('📤 [DEBUG] Attempting to send message to chat:', chatId);
    
    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
    console.log('✅ [DEBUG] Message sent successfully to chat:', chatId);
    
  } catch (error) {
    // 👇 DEBUG: Enhanced error logging
    console.error('❌ [DEBUG] ERROR in handleSearch:', {
      message: error.message,
      stack: error.stack,
      chatId: chatId
    });
    
    logger.error('Handle search error:', error);
    
    try {
      await bot.sendMessage(chatId, 'Error loading search menu. Please try again.');
    } catch (sendError) {
      console.error('❌ [DEBUG] Failed to send error message:', sendError.message);
    }
  }
};

/**
 * Show all apartments (simple listing)
 */
const listAllApartments = async (bot, chatId) => {
  try {
    // ✅ UPDATED: Removed isApproved filter
    const [apartments] = await pool.query(
      'SELECT * FROM apartments ORDER BY createdAt DESC LIMIT 10'
    );
    
    if (apartments.length === 0) {
      return bot.sendMessage(
        chatId,
        '🏠 *No Apartments Available*\n\nThere are no apartments available at the moment. Please check back later or list your property!',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔍 Search Menu', callback_data: 'menu_search' }],
              [{ text: '📋 Main Menu', callback_data: 'back_to_main' }]
            ]
          }
        }
      );
    }
    
    // Send first apartment
    await sendApartmentCard(bot, chatId, apartments[0], 0, apartments.length, 'all');
    
  } catch (error) {
    logger.error('List all apartments error:', error);
    bot.sendMessage(chatId, 'Error loading apartments. Please try again.');
  }
};

// ============================================
// SEARCH MENU DISPLAY FUNCTIONS
// ============================================

/**
 * Show location selection menu
 */
const showLocationMenu = async (bot, chatId, messageId) => {
  const locations = [
    ['🏛️ Asokoro', 'search_loc_asokoro'],
    ['🏰 Maitama', 'search_loc_maitama'],
    ['🏛️ Central Area', 'search_loc_central'],
    ['🏢 Wuse', 'search_loc_wuse'],
    ['🏙️ Garki', 'search_loc_garki'],
    ['🌳 Jabi', 'search_loc_jabi'],
    ['🏬 Utako', 'search_loc_utako'],
    ['🏗️ Wuye', 'search_loc_wuye'],
    ['🏡 Life Camp', 'search_loc_life-camp'],
    ['🏠 Guzape', 'search_loc_guzape'],
    ['🏘️ Gwarinpa', 'search_loc_gwarinpa'],
    ['🏘️ Kubwa', 'search_loc_kubwa'],
    ['🏠 Apo', 'search_loc_apo'],
    ['📍 All Locations', 'search_loc_all']
  ];
  
  const keyboard = {
    inline_keyboard: []
  };
  
  // Group in rows of 3
  for (let i = 0; i < locations.length - 1; i += 3) {
    const row = [];
    for (let j = 0; j < 3 && i + j < locations.length - 1; j++) {
      const loc = locations[i + j];
      row.push({ text: loc[0], callback_data: loc[1] });
    }
    keyboard.inline_keyboard.push(row);
  }
  
  // Add All Locations and back button
  keyboard.inline_keyboard.push([
    { text: locations[locations.length - 1][0], callback_data: locations[locations.length - 1][1] }
  ]);
  keyboard.inline_keyboard.push([
    { text: '« Back to Search', callback_data: 'search_back' }
  ]);
  
  const text = `
📍 *Search by Location*

Select a location to find apartments:
  `;
  
  if (messageId) {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } else {
    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
};

/**
 * Show apartment type menu
 */
const showTypeMenu = async (bot, chatId, messageId) => {
  const text = `
🏠 *Search by Apartment Type*

Select apartment type:
  `;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '🏠 Studio', callback_data: 'search_type_studio' },
        { text: '🛏️ 1-Bedroom', callback_data: 'search_type_1bed' }
      ],
      [
        { text: '🛏️🛏️ 2-Bedroom', callback_data: 'search_type_2bed' },
        { text: '🏰 3-Bedroom+', callback_data: 'search_type_3bed' }
      ],
      [
        { text: '« Back to Search', callback_data: 'search_back' }
      ]
    ]
  };
  
  if (messageId) {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } else {
    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
};

/**
 * Show price range menu
 */
const showPriceMenu = async (bot, chatId, messageId) => {
  const text = `
💰 *Search by Budget*

Select price range (per night):
  `;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '₦10k - ₦20k', callback_data: 'search_price_10-20' },
        { text: '₦20k - ₦30k', callback_data: 'search_price_20-30' }
      ],
      [
        { text: '₦30k - ₦50k', callback_data: 'search_price_30-50' },
        { text: '₦50k - ₦70k', callback_data: 'search_price_50-70' }
      ],
      [
        { text: '₦70k - ₦100k', callback_data: 'search_price_70-100' },
        { text: '₦100k+', callback_data: 'search_price_100+' }
      ],
      [
        { text: '« Back to Search', callback_data: 'search_back' }
      ]
    ]
  };
  
  if (messageId) {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } else {
    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
};

/**
 * Show amenities menu
 */
const showAmenitiesMenu = async (bot, chatId, messageId) => {
  const text = `
✨ *Search by Amenities*

Select amenities you want:
  `;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '⬜ WiFi', callback_data: 'search_amenity_wifi' },
        { text: '⬜ AC', callback_data: 'search_amenity_ac' }
      ],
      [
        { text: '⬜ TV', callback_data: 'search_amenity_tv' },
        { text: '⬜ Kitchen', callback_data: 'search_amenity_kitchen' }
      ],
      [
        { text: '⬜ Parking', callback_data: 'search_amenity_parking' },
        { text: '⬜ Security', callback_data: 'search_amenity_security' }
      ],
      [
        { text: '⬜ Generator', callback_data: 'search_amenity_generator' },
        { text: '⬜ Pool', callback_data: 'search_amenity_pool' }
      ],
      [
        { text: '✅ Apply Filters', callback_data: 'search_apply_amenities' },
        { text: '❌ Clear All', callback_data: 'search_amenity_clear' }
      ],
      [
        { text: '« Back to Search', callback_data: 'search_back' }
      ]
    ]
  };
  
  if (messageId) {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } else {
    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
};

/**
 * Show advanced search menu
 */
const showAdvancedSearch = async (bot, chatId, messageId) => {
  const text = `
🔎 *Advanced Search*

Coming soon! Advanced search features will include:
• Minimum/Maximum bedrooms
• Specific amenities
• Price per night vs per month
• Proximity to landmarks
• Owner ratings
  `;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '« Back to Search', callback_data: 'search_back' }
      ]
    ]
  };
  
  if (messageId) {
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } else {
    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
};

// ============================================
// SEARCH HANDLER FUNCTIONS
// ============================================

/**
 * Handle location selection
 */
const handleLocationSelection = async (bot, chatId, messageId, data) => {
  try {
    const location = data.replace('search_loc_', '');
    const locationName = location.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
    
    await bot.editMessageText(`🔍 Searching in ${locationName}...`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });
    
    // ✅ UPDATED: Removed isApproved filter
    let query = 'SELECT * FROM apartments';
    let params = [];
    
    if (location !== 'all') {
      query += ' WHERE location = ?';
      params.push(locationName);
    }
    
    query += ' ORDER BY createdAt DESC LIMIT 20';
    
    const [apartments] = await pool.query(query, params);
    
    if (apartments.length === 0) {
      await bot.sendMessage(chatId, 
        `🏠 *No apartments found in ${locationName}*\n\nTry another location or search type.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📍 Search by Location', callback_data: 'search_menu_location' }],
              [{ text: '🔍 Back to Search', callback_data: 'search_back' }]
            ]
          }
        }
      );
    } else {
      await sendApartmentCard(bot, chatId, apartments[0], 0, apartments.length, 'location', location);
    }
    
  } catch (error) {
    logger.error('Location selection error:', error);
    bot.sendMessage(chatId, 'Error searching apartments. Please try again.');
  }
};

/**
 * Handle type selection
 */
const handleTypeSelection = async (bot, chatId, messageId, data) => {
  try {
    const type = data.replace('search_type_', '');
    
    let typeText = '';
    let bedroomFilter = '';
    
    if (type === 'studio') {
      typeText = 'Studio Apartments';
      bedroomFilter = 'bedrooms = 0';
    } else if (type === '1bed') {
      typeText = '1-Bedroom Apartments';
      bedroomFilter = 'bedrooms = 1';
    } else if (type === '2bed') {
      typeText = '2-Bedroom Apartments';
      bedroomFilter = 'bedrooms = 2';
    } else if (type === '3bed') {
      typeText = '3+ Bedroom Apartments';
      bedroomFilter = 'bedrooms >= 3';
    }
    
    await bot.editMessageText(`🔍 Searching for ${typeText}...`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });
    
    // ✅ UPDATED: Removed isApproved filter
    const query = `SELECT * FROM apartments WHERE ${bedroomFilter} ORDER BY createdAt DESC LIMIT 20`;
    
    const [apartments] = await pool.query(query);
    
    if (apartments.length === 0) {
      await bot.sendMessage(chatId, 
        `🏠 *No ${typeText} found*\n\nTry another apartment type.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏠 Search by Type', callback_data: 'search_menu_type' }],
              [{ text: '🔍 Back to Search', callback_data: 'search_back' }]
            ]
          }
        }
      );
    } else {
      await sendApartmentCard(bot, chatId, apartments[0], 0, apartments.length, 'type', type);
    }
    
  } catch (error) {
    logger.error('Type selection error:', error);
    bot.sendMessage(chatId, 'Error searching apartments. Please try again.');
  }
};

/**
 * Handle price selection
 */
const handlePriceSelection = async (bot, chatId, messageId, data) => {
  try {
    const priceRange = data.replace('search_price_', '');
    const [min, max] = priceRange.split('-');
    
    let priceText = '';
    // ✅ UPDATED: Removed isApproved filter
    let query = 'SELECT * FROM apartments';
    let params = [];
    
    if (max === '+') {
      priceText = `₦${min}+`;
      query += ' WHERE pricePerNight >= ?';
      params.push(parseInt(min));
    } else {
      priceText = `₦${min} - ₦${max}`;
      query += ' WHERE pricePerNight BETWEEN ? AND ?';
      params.push(parseInt(min), parseInt(max));
    }
    
    query += ' ORDER BY pricePerNight ASC LIMIT 20';
    
    await bot.editMessageText(`🔍 Searching apartments ${priceText}...`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });
    
    const [apartments] = await pool.query(query, params);
    
    if (apartments.length === 0) {
      await bot.sendMessage(chatId, 
        `🏠 *No apartments found in range ${priceText}*\n\nTry a different price range.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Search by Budget', callback_data: 'search_menu_price' }],
              [{ text: '🔍 Back to Search', callback_data: 'search_back' }]
            ]
          }
        }
      );
    } else {
      await sendApartmentCard(bot, chatId, apartments[0], 0, apartments.length, 'price', priceRange);
    }
    
  } catch (error) {
    logger.error('Price selection error:', error);
    bot.sendMessage(chatId, 'Error searching apartments. Please try again.');
  }
};

/**
 * Handle amenity selection (toggles)
 */
const handleAmenitySelection = async (bot, chatId, messageId, data, callbackQuery) => {
  try {
    const amenity = data.replace('search_amenity_', '');
    
    if (amenity === 'clear') {
      await showAmenitiesMenu(bot, chatId, messageId);
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }
    
    // Get current message text and keyboard
    const message = callbackQuery.message;
    const keyboard = message.reply_markup;
    
    // Update the button text (toggle checkbox)
    for (let row of keyboard.inline_keyboard) {
      for (let button of row) {
        if (button.callback_data === data) {
          if (button.text.startsWith('⬜')) {
            button.text = button.text.replace('⬜', '✅');
          } else {
            button.text = button.text.replace('✅', '⬜');
          }
          break;
        }
      }
    }
    
    await bot.editMessageText(message.text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('Amenity selection error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error' });
  }
};

/**
 * Apply amenity filters
 */
const applyAmenityFilters = async (bot, chatId, messageId) => {
  try {
    await bot.editMessageText('🔍 Searching by amenities...', {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });
    
    // For now, just show all apartments
    // In a real implementation, you'd parse the selected amenities from the message
    
    // ✅ UPDATED: Removed isApproved filter
    const [apartments] = await pool.query(
      'SELECT * FROM apartments ORDER BY createdAt DESC LIMIT 20'
    );
    
    if (apartments.length === 0) {
      await bot.sendMessage(chatId, 
        '🏠 *No apartments found*\n\nTry different amenities.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '✨ Search by Amenities', callback_data: 'search_menu_amenities' }],
              [{ text: '🔍 Back to Search', callback_data: 'search_back' }]
            ]
          }
        }
      );
    } else {
      await sendApartmentCard(bot, chatId, apartments[0], 0, apartments.length, 'amenities');
    }
    
  } catch (error) {
    logger.error('Apply amenities error:', error);
    bot.sendMessage(chatId, 'Error searching apartments. Please try again.');
  }
};

// ============================================
// APARTMENT DETAILS & NAVIGATION
// ============================================

/**
 * Handle apartment details view
 */
const handleApartmentDetails = async (bot, callbackQuery, apartmentId) => {
  const chatId = callbackQuery.message.chat.id;
  
  try {
    const [apartments] = await pool.query(
      'SELECT * FROM apartments WHERE id = ?',
      [apartmentId]
    );
    
    if (apartments.length === 0) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Apartment not found' });
      return;
    }
    
    const apartment = apartments[0];
    
    // Increment views
    await pool.query(
      'UPDATE apartments SET views = views + 1 WHERE id = ?',
      [apartmentId]
    );
    
    const text = formatApartmentDetails(apartment);
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📅 Request Booking', callback_data: `book_${apartment.id}` },
          { text: '✨ Amenities', callback_data: `amenities_${apartment.id}` }
        ],
        [
          { text: '📸 Photos', callback_data: `photos_${apartment.id}` },
          { text: '📍 Location', callback_data: `location_apt_${apartment.id}` }
        ],
        [
          { text: '« Back to Search', callback_data: 'back_to_search' }
        ]
      ]
    };
    
    if (apartment.images && apartment.images.length > 0) {
      await bot.sendPhoto(chatId, apartment.images[0], {
        caption: text,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else {
      await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('Apartment details error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error loading details' });
  }
};

/**
 * Handle amenities view
 */
const handleAmenities = async (bot, callbackQuery, apartmentId) => {
  const chatId = callbackQuery.message.chat.id;
  
  try {
    const [apartments] = await pool.query(
      'SELECT * FROM apartments WHERE id = ?',
      [apartmentId]
    );
    
    if (apartments.length === 0) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Apartment not found' });
      return;
    }
    
    const apartment = apartments[0];
    
    let amenitiesList = '';
    if (apartment.amenities) {
      const amenities = Array.isArray(apartment.amenities) 
        ? apartment.amenities 
        : JSON.parse(apartment.amenities || '[]');
      
      if (amenities.length > 0) {
        amenitiesList = amenities.map(a => `✅ ${a}`).join('\n');
      } else {
        amenitiesList = 'No amenities listed';
      }
    } else {
      amenitiesList = 'No amenities listed';
    }
    
    const text = `
✨ *Amenities for ${apartment.title}*

${amenitiesList}
    `;
    
    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Back to Apartment', callback_data: `view_${apartmentId}` }]
        ]
      }
    });
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('Amenities error:', error);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Error loading amenities' });
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Send apartment card with navigation
 */
const sendApartmentCard = async (bot, chatId, apartment, index, total, searchType = 'all', searchParam = null) => {
  try {
    const text = formatApartmentDetails(apartment, index, total);
    
    const keyboard = {
      inline_keyboard: []
    };
    
    // Navigation row
    const navRow = [];
    if (index > 0) {
      navRow.push({ text: '« Previous', callback_data: `apt_prev_${index}_${searchType}_${searchParam || 'none'}` });
    }
    
    navRow.push({ text: '📅 Request Booking', callback_data: `book_${apartment.id}` });
    
    if (index < total - 1) {
      navRow.push({ text: 'Next »', callback_data: `apt_next_${index}_${searchType}_${searchParam || 'none'}` });
    }
    
    keyboard.inline_keyboard.push(navRow);
    
    // Details row
    keyboard.inline_keyboard.push([
      { text: '✨ Amenities', callback_data: `amenities_${apartment.id}` },
      { text: '📸 Photos', callback_data: `photos_${apartment.id}` }
    ]);
    
    // Back button
    keyboard.inline_keyboard.push([
      { text: '« Back to Search', callback_data: 'back_to_search' }
    ]);
    
    if (apartment.images && apartment.images.length > 0) {
      await bot.sendPhoto(chatId, apartment.images[0], {
        caption: text,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    } else {
      await bot.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });
    }
    
  } catch (error) {
    logger.error('Send apartment card error:', error);
    bot.sendMessage(chatId, 'Error displaying apartment. Please try again.');
  }
};

/**
 * Format apartment details for display
 */
const formatApartmentDetails = (apartment, index = null, total = null) => {
  let header = '';
  if (index !== null && total !== null) {
    header = `🏠 *${index + 1}/${total}*\n\n`;
  }
  
  let bedroomEmoji = '🛏️';
  if (apartment.bedrooms >= 3) bedroomEmoji = '🏰';
  else if (apartment.bedrooms === 2) bedroomEmoji = '🛏️🛏️';
  else if (apartment.bedrooms === 1) bedroomEmoji = '🛏️';
  else if (apartment.bedrooms === 0) bedroomEmoji = '🏠';
  
  let amenitiesPreview = '';
  if (apartment.amenities) {
    const amenities = Array.isArray(apartment.amenities) 
      ? apartment.amenities.slice(0, 3) 
      : JSON.parse(apartment.amenities || '[]').slice(0, 3);
    
    if (amenities.length > 0) {
      amenitiesPreview = `✨ *Amenities:* ${amenities.join(', ')}${apartment.amenities.length > 3 ? '...' : ''}\n`;
    }
  }
  
  return `
${header}${bedroomEmoji} *${apartment.title}*

📍 *Location:* ${apartment.location}
💰 *Price:* ₦${apartment.pricePerNight?.toLocaleString() || 'N/A'}/night
🛏️ *Bedrooms:* ${apartment.bedrooms || 'N/A'}
🛁 *Bathrooms:* ${apartment.bathrooms || 'N/A'}
📝 *Description:* ${apartment.description || 'No description available'}
${amenitiesPreview}
  `;
};

module.exports = {
  // Main search
  handleSearch,
  listAllApartments,
  
  // Menu displays
  showLocationMenu,
  showTypeMenu,
  showPriceMenu,
  showAmenitiesMenu,
  showAdvancedSearch,
  
  // Search handlers
  handleLocationSelection,
  handleTypeSelection,
  handlePriceSelection,
  handleAmenitySelection,
  applyAmenityFilters,
  
  // Apartment details
  handleApartmentDetails,
  handleAmenities,
  
  // Helpers (exported for other controllers)
  sendApartmentCard,
  formatApartmentDetails
};

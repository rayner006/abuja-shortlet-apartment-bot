// Keyboard layouts for the bot

/**
 * Main menu keyboard
 */
function getMainMenuKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['🏠 View Apartments'],
        ['📞 Contact Admin'],
        ['ℹ️ About Us']
      ],
      resize_keyboard: true
    }
  };
}

/**
 * Locations keyboard
 */
function getLocationsKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['🏛️ Maitama', '🏛️ Asokoro'],
        ['🏛️ Wuse', '🏛️ Jabi'],
        ['🏛️ Garki', '🏘️ Gwarinpa'],
        ['🏛️ Guzape', '🏛️ Katampe'],
        ['🏘️ Jahi', '💰 Utako'],
        ['🏘️ Wuye', '🏘️ Life Camp'],
        ['🏘️ Apo', '🏘️ Lokogoma'],
        ['🏘️ Kubwa', '🏘️ Lugbe'],
        ['🏘️ Durumi', '🏭 Gwagwalada'],
        ['⬅️ Back to Main Menu']
      ],
      resize_keyboard: true
    }
  };
}

/**
 * Apartment types keyboard
 * @param {string} location - Selected location
 */
function getApartmentTypesKeyboard(location) {
  return {
    reply_markup: {
      keyboard: [
        ['🛏️ Self Contain', '🛏️ 1-Bedroom'],
        ['🛏️ 2-Bedroom', '🛏️ 3-Bedroom'],
        ['🔍 Search Again', '⬅️ Back to Main Menu']
      ],
      resize_keyboard: true
    }
  };
}

/**
 * Inline keyboard for apartment actions
 * @param {number} apartmentId - Apartment ID
 */
function getApartmentActionsKeyboard(apartmentId) {
  return {
    inline_keyboard: [
      [{ text: '📅 Book Now', callback_data: `book_${apartmentId}` }]
    ]
  };
}

/**
 * Inline keyboard for owner actions
 * @param {string} bookingCode - Booking code
 */
function getOwnerActionsKeyboard(bookingCode) {
  return {
    inline_keyboard: [
      [{ text: '✅ Confirm Booking', callback_data: `confirm_owner_${bookingCode}` }],
      [{ text: '📞 Guest Contacted', callback_data: `contacted_${bookingCode}` }]
    ]
  };
}

/**
 * Inline keyboard for admin actions
 * @param {string} bookingCode - Booking code
 */
function getAdminActionsKeyboard(bookingCode) {
  return {
    inline_keyboard: [
      [{ text: '📊 View Dashboard', callback_data: 'admin_dashboard' }],
      [{ text: '💰 Check Commission', callback_data: `admin_commission_${bookingCode}` }]
    ]
  };
}

/**
 * Back button only keyboard
 */
function getBackKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['⬅️ Back to Main Menu']
      ],
      resize_keyboard: true
    }
  };
}

/**
 * Search options keyboard
 */
function getSearchOptionsKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['🔍 Search Again'],
        ['⬅️ Back to Main Menu']
      ],
      resize_keyboard: true
    }
  };
}

module.exports = {
  getMainMenuKeyboard,
  getLocationsKeyboard,
  getApartmentTypesKeyboard,
  getApartmentActionsKeyboard,
  getOwnerActionsKeyboard,
  getAdminActionsKeyboard,
  getBackKeyboard,
  getSearchOptionsKeyboard
};

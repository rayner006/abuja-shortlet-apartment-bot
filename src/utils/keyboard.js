const { LOCATIONS, APARTMENT_TYPES } = require('../config/constants');

// Main menu keyboard
function getMainMenuKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['🏠 View Apartments'],
        ['📞 Contact Admin', 'ℹ️ About Us']
      ],
      resize_keyboard: true
    }
  };
}

// Locations keyboard
function getLocationsKeyboard() {
  const locationButtons = Object.keys(LOCATIONS).map(location => [location]);
  
  // Split into rows of 2
  const keyboard = [];
  for (let i = 0; i < locationButtons.length; i += 2) {
    const row = [];
    row.push(locationButtons[i][0]);
    if (i + 1 < locationButtons.length) {
      row.push(locationButtons[i + 1][0]);
    }
    keyboard.push(row);
  }
  
  // Add back button
  keyboard.push(['⬅️ Back to Main Menu']);
  
  return {
    reply_markup: {
      keyboard,
      resize_keyboard: true
    }
  };
}

// Apartment types keyboard
function getApartmentTypesKeyboard(location) {
  const keyboard = APARTMENT_TYPES.map(type => [type]);
  keyboard.push(['⬅️ Back to Main Menu']);
  
  return {
    reply_markup: {
      keyboard,
      resize_keyboard: true
    }
  };
}

// Apartment actions keyboard (inline)
function getApartmentActionsKeyboard(apartmentId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📅 Book Now', callback_data: `book_${apartmentId}` }]
      ]
    }
  };
}

// Owner actions keyboard (inline)
function getOwnerActionsKeyboard(bookingCode) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Confirm Booking', callback_data: `confirm_owner_${bookingCode}` },
          { text: '📞 Contacted Guest', callback_data: `contacted_${bookingCode}` }
        ],
        [
          { text: '🔐 Confirm with PIN', callback_data: `confirm_property_owner_${bookingCode}` }
        ]
      ]
    }
  };
}

// Admin actions keyboard (inline)
function getAdminActionsKeyboard(bookingCode) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '💰 View Commission', callback_data: `admin_commission_${bookingCode}` },
          { text: '📊 Dashboard', callback_data: 'admin_dashboard' }
        ]
      ]
    }
  };
}

// Search options keyboard
function getSearchOptionsKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['🔍 Search Again'],
        ['🏠 View Apartments'],
        ['⬅️ Back to Main Menu']
      ],
      resize_keyboard: true
    }
  };
}

// Back button only
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

module.exports = {
  getMainMenuKeyboard,
  getLocationsKeyboard,
  getApartmentTypesKeyboard,
  getApartmentActionsKeyboard,
  getOwnerActionsKeyboard,
  getAdminActionsKeyboard,
  getSearchOptionsKeyboard,
  getBackKeyboard
};
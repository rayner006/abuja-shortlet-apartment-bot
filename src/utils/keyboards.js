// src/utils/keyboards.js
const { InlineKeyboardButton, KeyboardButton } = require('node-telegram-bot-api');

const createMainMenuKeyboard = (userRole) => {
  const keyboard = [
    [{ text: '🔍 Search Apartments', callback_data: 'menu_search' }],
    [{ text: '📅 My Bookings', callback_data: 'menu_bookings' }]
  ];
  
  if (userRole === 'owner' || userRole === 'admin') {
    keyboard.push(
      [{ text: '🏠 My Apartments', callback_data: 'menu_my_apartments' }],
      [{ text: '➕ Add Apartment', callback_data: 'menu_add_apartment' }],
      [{ text: '📊 Dashboard', callback_data: 'menu_owner_dashboard' }]
    );
  }
  
  if (userRole === 'admin') {
    keyboard.push([{ text: '⚙️ Admin Panel', callback_data: 'menu_admin' }]);
  }
  
  keyboard.push([{ text: '❓ Help', callback_data: 'menu_help' }]);
  
  return {
    inline_keyboard: keyboard
  };
};

const createApartmentKeyboard = (apartmentId) => {
  return {
    inline_keyboard: [
      [
        { text: '📅 Book Now', callback_data: `book_${apartmentId}` },
        { text: '📸 View Photos', callback_data: `photos_${apartmentId}` }
      ],
      [
        { text: '⭐ Amenities', callback_data: `amenities_${apartmentId}` },
        { text: '📍 Location', callback_data: `location_${apartmentId}` }
      ],
      [{ text: '🔙 Back to Search', callback_data: 'back_to_search' }]
    ]
  };
};

const createOwnerApartmentKeyboard = (apartmentId) => {
  return {
    inline_keyboard: [
      [
        { text: '✏️ Edit', callback_data: `edit_${apartmentId}` },
        { text: '📸 Update Photos', callback_data: `update_photos_${apartmentId}` }
      ],
      [
        { text: '📊 Bookings', callback_data: `apartment_bookings_${apartmentId}` },
        { text: '📈 Stats', callback_data: `apartment_stats_${apartmentId}` }
      ],
      [
        { text: '🔁 Toggle Availability', callback_data: `toggle_${apartmentId}` }
      ],
      [{ text: '🔙 Back', callback_data: 'back_to_my_apartments' }]
    ]
  };
};

const createAdminKeyboard = () => {
  return {
    inline_keyboard: [
      [{ text: '📋 Pending Approvals', callback_data: 'admin_pending' }],
      [{ text: '👥 Users', callback_data: 'admin_users' }],
      [{ text: '🏢 All Apartments', callback_data: 'admin_apartments' }],
      [{ text: '📊 Statistics', callback_data: 'admin_stats' }],
      [{ text: '⚙️ Settings', callback_data: 'admin_settings' }],
      [{ text: '🔙 Back to Menu', callback_data: 'back_to_main' }]
    ]
  };
};

const createBookingKeyboard = (bookingId, status) => {
  const keyboard = [];
  
  if (status === 'pending') {
    keyboard.push([{ text: '❌ Cancel Booking', callback_data: `cancel_booking_${bookingId}` }]);
  }
  
  keyboard.push([{ text: '🔙 Back', callback_data: 'back_to_bookings' }]);
  
  return { inline_keyboard: keyboard };
};

const createConfirmationKeyboard = (action, data) => {
  return {
    inline_keyboard: [
      [
        { text: '✅ Confirm', callback_data: `confirm_${action}_${data}` },
        { text: '❌ Cancel', callback_data: `cancel_${action}` }
      ]
    ]
  };
};

const createYesNoKeyboard = (callbackPrefix) => {
  return {
    inline_keyboard: [
      [
        { text: '✅ Yes', callback_data: `${callbackPrefix}_yes` },
        { text: '❌ No', callback_data: `${callbackPrefix}_no` }
      ]
    ]
  };
};

const createPaginationKeyboard = (currentPage, totalPages, prefix) => {
  const keyboard = [];
  const buttons = [];
  
  if (currentPage > 1) {
    buttons.push({ text: '◀️ Prev', callback_data: `${prefix}_page_${currentPage - 1}` });
  }
  
  buttons.push({ text: `📄 ${currentPage}/${totalPages}`, callback_data: 'noop' });
  
  if (currentPage < totalPages) {
    buttons.push({ text: 'Next ▶️', callback_data: `${prefix}_page_${currentPage + 1}` });
  }
  
  keyboard.push(buttons);
  keyboard.push([{ text: '🔙 Back', callback_data: 'back_to_main' }]);
  
  return { inline_keyboard: keyboard };
};

module.exports = {
  createMainMenuKeyboard,
  createApartmentKeyboard,
  createOwnerApartmentKeyboard,
  createAdminKeyboard,
  createBookingKeyboard,
  createConfirmationKeyboard,
  createYesNoKeyboard,
  createPaginationKeyboard
};

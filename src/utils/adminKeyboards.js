// src/utils/adminKeyboards.js

const createAdminMainKeyboard = () => {
  return {
    inline_keyboard: [
      [{ text: '⏳ Pending Approvals', callback_data: 'admin_pending_1' }],  // 👈 Added page number
      [{ text: '🏢 All Apartments', callback_data: 'admin_apartments_1' }],  // 👈 Added page number
      [{ text: '👥 All Users', callback_data: 'admin_users_1' }],            // 👈 Added page number
      [{ text: '💰 Revenue', callback_data: 'admin_stats' }],                // 👈 Changed to stats for now
      [{ text: '📊 Statistics', callback_data: 'admin_stats' }],
      [{ text: '⚙️ Settings', callback_data: 'admin_settings' }],
      [{ text: '🔙 Back to Menu', callback_data: 'menu_admin' }]             // 👈 Added back button
    ]
  };
};

const createApartmentManageKeyboard = (apartmentId) => {
  return {
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: `approve_${apartmentId}` },      // ✅ Matches adminController
        { text: '❌ Reject', callback_data: `reject_${apartmentId}` }         // ✅ Matches adminController
      ],
      [
        { text: '✏️ Edit', callback_data: `admin_edit_apt_${apartmentId}` },  // 👈 Updated format
        { text: '📸 Photos', callback_data: `admin_apt_photos_${apartmentId}` } // 👈 Updated format
      ],
      [
        { text: '🔄 Toggle Availability', callback_data: `admin_toggle_apt_${apartmentId}` }, // 👈 Updated
        { text: '❌ Delete', callback_data: `admin_delete_apt_${apartmentId}` } // 👈 Updated
      ],
      [{ text: '« Back to Apartments', callback_data: 'admin_apartments_1' }] // 👈 Updated
    ]
  };
};

const createUserManageKeyboard = (userId) => {
  return {
    inline_keyboard: [
      [
        { text: '📋 Listings', callback_data: `user_listings_${userId}` },    // ✅ Matches adminController
        { text: '📅 Bookings', callback_data: `user_bookings_${userId}` }     // ✅ Matches adminController
      ],
      [
        { text: '✏️ Edit', callback_data: `user_edit_${userId}` },             // ✅ Matches adminController
        { text: '👑 Change Role', callback_data: `user_role_${userId}` }       // ✅ Matches adminController
      ],
      [
        { text: '💬 Message', callback_data: `user_message_${userId}` },       // ✅ Matches adminController
        { text: '🔄 Toggle Status', callback_data: `user_toggle_${userId}` }   // ✅ Matches adminController
      ],
      [
        { text: '❌ Delete', callback_data: `user_delete_${userId}` }          // ✅ Matches adminController
      ],
      [{ text: '« Back to Users', callback_data: 'admin_users_1' }]            // 👈 Updated
    ]
  };
};

const createRevenueKeyboard = () => {
  return {
    inline_keyboard: [
      [
        { text: '💰 Commission Report', callback_data: 'admin_stats' },       // 👈 Redirect to stats
        { text: '📅 Monthly Fees', callback_data: 'admin_stats' }             // 👈 Redirect to stats
      ],
      [
        { text: '📤 Process Payouts', callback_data: 'admin_stats' }          // 👈 Redirect to stats
      ],
      [{ text: '« Back to Admin', callback_data: 'menu_admin' }]              // 👈 Updated
    ]
  };
};

const createPaginationKeyboard = (currentPage, totalPages, prefix) => {
  const buttons = [];
  
  if (currentPage > 1) {
    buttons.push({ text: '◀️ Prev', callback_data: `${prefix}_${currentPage - 1}` });
  }
  
  buttons.push({ text: `📄 ${currentPage}/${totalPages}`, callback_data: 'noop' });
  
  if (currentPage < totalPages) {
    buttons.push({ text: 'Next ▶️', callback_data: `${prefix}_${currentPage + 1}` });
  }
  
  return {
    inline_keyboard: [buttons, [{ text: '« Back to Admin', callback_data: 'menu_admin' }]]
  };
};

// 👇 ADD THIS - User card keyboard (for individual user management)
const createUserCardKeyboard = (userId, isActive) => {
  return {
    inline_keyboard: [
      [
        { text: '✏️ Edit', callback_data: `user_edit_${userId}` },
        { text: isActive ? '🔴 Deactivate' : '🟢 Activate', callback_data: `user_toggle_${userId}` },
        { text: '💬 Message', callback_data: `user_message_${userId}` }
      ],
      [
        { text: '👑 Change Role', callback_data: `user_role_${userId}` },
        { text: '📋 Listings', callback_data: `user_listings_${userId}` },
        { text: '📅 Bookings', callback_data: `user_bookings_${userId}` }
      ],
      [
        { text: '❌ Delete User', callback_data: `user_delete_${userId}` }
      ]
    ]
  };
};

module.exports = {
  createAdminMainKeyboard,
  createApartmentManageKeyboard,
  createUserManageKeyboard,
  createRevenueKeyboard,
  createPaginationKeyboard,
  createUserCardKeyboard  // 👈 Export the new function
};

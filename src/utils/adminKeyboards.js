// src/utils/adminKeyboards.js

const createAdminMainKeyboard = () => {
  return {
    inline_keyboard: [
      [{ text: '📋 Pending Approvals', callback_data: 'admin_pending' }],
      [{ text: '🏢 All Apartments', callback_data: 'admin_apartments' }],
      [{ text: '👥 All Users', callback_data: 'admin_users' }],
      [{ text: '💰 Revenue', callback_data: 'admin_revenue' }],
      [{ text: '📊 Statistics', callback_data: 'admin_stats' }],
      [{ text: '⚙️ Settings', callback_data: 'admin_settings' }]
    ]
  };
};

const createApartmentManageKeyboard = (apartmentId) => {
  return {
    inline_keyboard: [
      [
        { text: '✅ Approve', callback_data: `approve_${apartmentId}` },
        { text: '❌ Reject', callback_data: `reject_${apartmentId}` }
      ],
      [
        { text: '✏️ Edit', callback_data: `edit_${apartmentId}` },
        { text: '📸 Photos', callback_data: `photos_${apartmentId}` }
      ],
      [
        { text: '🔴 Toggle Availability', callback_data: `toggle_${apartmentId}` },
        { text: '❌ Delete', callback_data: `delete_${apartmentId}` }
      ],
      [{ text: '« Back', callback_data: 'admin_apartments' }]
    ]
  };
};

const createUserManageKeyboard = (userId) => {
  return {
    inline_keyboard: [
      [
        { text: '📊 View Stats', callback_data: `user_stats_${userId}` },
        { text: '📋 Listings', callback_data: `user_listings_${userId}` }
      ],
      [
        { text: '💬 Message', callback_data: `message_user_${userId}` },
        { text: '⚡ Change Role', callback_data: `change_role_${userId}` }
      ],
      [{ text: '« Back', callback_data: 'admin_users' }]
    ]
  };
};

const createRevenueKeyboard = () => {
  return {
    inline_keyboard: [
      [
        { text: '💰 Commissions', callback_data: 'admin_commissions' },
        { text: '📅 Monthly Fees', callback_data: 'admin_monthly_fees' }
      ],
      [
        { text: '📊 Revenue Chart', callback_data: 'admin_revenue_chart' },
        { text: '📤 Process Payouts', callback_data: 'admin_payouts' }
      ],
      [{ text: '« Back', callback_data: 'menu_admin' }]
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
    inline_keyboard: [buttons, [{ text: '« Back', callback_data: 'menu_admin' }]]
  };
};

module.exports = {
  createAdminMainKeyboard,
  createApartmentManageKeyboard,
  createUserManageKeyboard,
  createRevenueKeyboard,
  createPaginationKeyboard
};

/* ================= BOT TEXT ================= */
const BOT_TEXT = {
  WELCOME: 'Welcome to Abuja Shortlet Apartment Bot 🏠',
  HELP: 'Use the menu below to browse apartments or make a booking.',
  ERROR: 'Something went wrong. Please try again later.',
  NOT_FOUND: 'No result found.',
  BOOKING_SUCCESS: 'Your booking request has been sent to the owner.',
  PAYMENT_PENDING: 'Waiting for owner confirmation...',
};

/* ================= CALLBACK KEYS ================= */
const CALLBACKS = {
  VIEW_APARTMENTS: 'VIEW_APARTMENTS',
  VIEW_LOCATIONS: 'VIEW_LOCATIONS',
  BOOK_NOW: 'BOOK_NOW',
  CONFIRM_BOOKING: 'CONFIRM_BOOKING',
  CANCEL_BOOKING: 'CANCEL_BOOKING',
  ADMIN_PANEL: 'ADMIN_PANEL',
};

/* ================= USER ROLES ================= */
const ROLES = {
  USER: 'user',
  OWNER: 'owner',
  ADMIN: 'admin',
};

/* ================= BOOKING STATUS ================= */
const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  PAID: 'paid',
};

/* ================= COMMISSION ================= */
const COMMISSION = {
  ADMIN_PERCENT: 10, // 10%
};

/* ================= REDIS KEYS ================= */
const REDIS_KEYS = {
  USER_SESSION: 'USER_SESSION',
  BOOKING_FLOW: 'BOOKING_FLOW',
};

/* ================= EXPORT ================= */
module.exports = {
  BOT_TEXT,
  CALLBACKS,
  ROLES,
  BOOKING_STATUS,
  COMMISSION,
  REDIS_KEYS,
};

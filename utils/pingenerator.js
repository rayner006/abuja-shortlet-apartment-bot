// PIN Generator Utility
// This file handles all PIN generation for the bot

/**
 * Generate a 5-digit access PIN
 * @returns {string} 5-digit PIN as string
 */
function generateaccesspin() {
  // Generate a random 5-digit number (10000-99999)
  const pin = Math.floor(10000 + Math.random() * 90000).toString();
  
  // Log for debugging (can be removed in production)
  console.log('🔐 Generated PIN:', pin, 'Length:', pin.length);
  
  return pin;
}

/**
 * Validate if a PIN is correctly formatted
 * @param {string} pin - The PIN to validate
 * @returns {boolean} True if valid 5-digit PIN
 */
function validatePIN(pin) {
  return /^\d{5}$/.test(pin);
}

/**
 * Generate a unique booking code
 * @returns {string} Unique booking code
 */
function generateBookingCode() {
  return 'BOOK' + Date.now().toString().slice(-8);
}

module.exports = { 
  generateaccesspin,
  validatePIN,
  generateBookingCode
};

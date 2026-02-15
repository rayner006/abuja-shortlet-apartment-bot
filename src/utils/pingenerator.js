const crypto = require('crypto');

// Generate a 5-digit PIN
function generateaccesspin() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

// Validate PIN format (5 digits)
function validatePIN(pin) {
  return /^\d{5}$/.test(pin);
}

// Generate booking code (e.g., ABJ-12345678)
function generateBookingCode() {
  const prefix = 'ABJ';
  const random = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `${prefix}-${random}`;
}

module.exports = {
  generateaccesspin,
  validatePIN,
  generateBookingCode
};
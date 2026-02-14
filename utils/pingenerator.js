// In your processBookingWithUserInfo function, replace the PIN generation line:

// Old line (problematic):
// const pin = Math.floor(100000 + Math.random() * 900000).toString().slice(0, 5);

// New improved PIN generation:
function generateSecurePIN() {
  // Generate a random 5-digit number (10000-99999)
  const pin = Math.floor(10000 + Math.random() * 90000).toString();
  console.log('🔐 Generated PIN:', pin);
  return pin;
}

// Then use it in your query:
const pin = generateSecurePIN();

// Also add PIN validation
function isValidPIN(pin) {
  return /^\d{5}$/.test(pin); // Exactly 5 digits
}

// When verifying PIN, add validation
bot.onText(/\/verify_pin (\d{5})/, (msg, match) => {
  const pin = match[1];
  console.log('🔍 Verifying PIN:', pin);
  // Your verification logic here
});

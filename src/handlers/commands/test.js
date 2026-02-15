const { generateaccesspin, validatePIN } = require('../../utils/pinGenerator');
const NotificationService = require('../../services/notificationService');
const { isAdmin } = require('../../middleware/auth');

module.exports = (bot) => {
  // Test PIN generation
  bot.onText(/\/test_pin/, (msg) => {
    const testPin = generateaccesspin();
    bot.sendMessage(msg.chat.id, `🔐 *Test PIN:* \`${testPin}\`\n📏 *Length:* ${testPin.length}`, {
      parse_mode: 'Markdown'
    });
  });
  
  // Test notifications
  bot.onText(/\/test_notify/, (msg) => {
    const chatId = msg.chat.id;
    
    if (isAdmin(chatId)) {
      const testBooking = {
        bookingCode: 'TEST' + Date.now().toString().slice(-8),
        bookingId: 999,
        guestName: 'Test User',
        guestUsername: 'testuser',
        guestPhone: '08000000000',
        apartmentName: 'Test Apartment',
        location: 'Test Location',
        type: 'Test Type',
        price: 50000,
        ownerId: 1
      };
      
      NotificationService.notifyAdmins(testBooking);
      bot.sendMessage(chatId, '📨 *Test notification sent!*\nCheck if you received it.', {
        parse_mode: 'Markdown'
      });
    } else {
      bot.sendMessage(chatId, '❌ Only admin can use this command.');
    }
  });
};
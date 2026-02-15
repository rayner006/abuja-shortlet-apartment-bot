const BookingService = require('../../services/bookingService');
const { getRedis } = require('../../config/redis');
const logger = require('../../middleware/logger');
const { getMainMenuKeyboard } = require('../../utils/keyboard');

module.exports = (bot) => {
  // Handle phone number input during booking
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Skip if no text or it's a command
    if (!text || text.startsWith('/')) return;
    
    try {
      const redis = getRedis();
      
      // Check if user is in booking session
      const sessionData = await redis.get(`session:${chatId}`);
      
      if (!sessionData) return;
      
      const session = JSON.parse(sessionData);
      
      if (session.step === 'awaiting_phone') {
        // Process phone number
        const result = await BookingService.processBooking(chatId, text, msg, session);
        
        if (result.success) {
          const message = `
✅ *Booking Request Received!*

🔑 *Your Booking Code:* \`${result.bookingCode}\`
🔐 *Your PIN:* \`${result.pin}\`

👤 *Your Details:*
• Name: ${result.fullName}
• Username: @${result.username}
• Phone: ${result.phoneNumber}
• Apartment: ${result.apartmentName}
• Amount: ₦${result.amount}

📌 *Next Steps:*
1. Our team will contact you shortly
2. Use the PIN above for verification
3. Send the PIN when asked to confirm

Thank you for choosing Abuja Shortlet Apartments! 🏠
          `;
          
          await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: {
              keyboard: [
                ['🏠 View Apartments'],
                ['📞 Contact Admin']
              ],
              resize_keyboard: true
            }
          });
        } else {
          await bot.sendMessage(chatId, result.message);
        }
        
        // Clear session
        await redis.del(`session:${chatId}`);
      }
    } catch (error) {
      logger.error('Error in booking message handler:', error);
      bot.sendMessage(chatId, '❌ Error processing your request. Please try again.');
    }
  });
};
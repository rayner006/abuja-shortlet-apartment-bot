const { showMainMenu } = require('../../utils/messageHelpers');
const SessionManager = require('../../services/sessionManager');
const logger = require('../../middleware/logger');

// Add cooldown map to prevent duplicates
const messageCooldown = new Map();

module.exports = (bot) => {
  bot.on('message', async (msg) => {
    // Ignore commands
    if (msg.text && msg.text.startsWith('/')) return;
    
    // 🚫 IMPORTANT: Skip ALL menu commands - let specific handlers process them
    const menuCommands = [
      '🏠 View Apartments', 
      '📞 Contact Admin', 
      'ℹ️ About Us', 
      '⬅️ Back to Main Menu', 
      '🔍 Search Again'
    ];
    
    if (msg.text && menuCommands.includes(msg.text)) {
      console.log('📋 Menu command detected in unhandledMessages, skipping:', msg.text);
      return; // Let specific handlers (like locations.js) process these
    }
    
    // 🚫 Skip location selections (start with location emojis)
    if (msg.text && msg.text.match(/^[🏛️🏘️💰🏭]/)) {
      console.log('📍 Location selection detected in unhandledMessages, skipping:', msg.text);
      return; // Let locations.js handle these
    }
    
    // 🚫 Skip apartment type selections (start with bed emoji)
    if (msg.text && msg.text.match(/^🛏️/)) {
      console.log('🏠 Apartment type detected in unhandledMessages, skipping:', msg.text);
      return; // Let apartmentTypes.js handle these
    }
    
    // Ignore common callback-related texts
    const callbackPatterns = ['✅', '❌', '💰', '📅', '🔍', '📞', 'ℹ️', '⬅️'];
    if (msg.text && callbackPatterns.some(pattern => msg.text.includes(pattern))) return;
    
    try {
      const chatId = msg.chat.id;
      
      // Check cooldown - prevent duplicate messages within 5 seconds
      const lastMessage = messageCooldown.get(chatId);
      if (lastMessage && Date.now() - lastMessage < 5000) {
        logger.info(`⏱️ Cooldown active for ${chatId} - skipping duplicate`);
        return;
      }
      
      const userInput = msg.text;
      logger.info(`Unhandled message from ${chatId}: "${userInput}"`);
      
      const { hasSession, message, action } = await SessionManager.getWelcomeBackMessage(chatId);
      
      // Send appropriate response based on session state
      if (action === 'show_resume_options') {
        await bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🔄 Continue where I left off', callback_data: 'resume_session' },
                { text: '🆕 Start fresh', callback_data: 'start_fresh' }
              ]
            ]
          }
        });
        messageCooldown.set(chatId, Date.now());
      } else {
        // THIS IS THE WELCOME MESSAGE FOR USERS WITH CLEARED HISTORY
        const welcomeMessage = `
👋 *Welcome Back!*

🏠 *Abuja Shortlet Apartments*

👇 *Click On Any Menu Below To Continue*
        `;
        
        await showMainMenu(bot, chatId, welcomeMessage);
        messageCooldown.set(chatId, Date.now());
      }
      
    } catch (error) {
      logger.error('Error in unhandled messages handler:', error);
    }
  });
};

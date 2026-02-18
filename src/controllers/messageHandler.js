// controllers/messageHandler.js

/**
 * Natural Language Message Handler for Abuja Shortlet Bot
 * Handles all non-command text messages from users
 */

const areaList = {
  'asokoro': 'Asokoro',
  'maitama': 'Maitama',
  'wuse': 'Wuse',
  'wuse 2': 'Wuse 2',
  'garki': 'Garki',
  'jabi': 'Jabi',
  'gwarinpa': 'Gwarinpa',
  'utako': 'Utako',
  'central': 'Central Area',
  'life camp': 'Life Camp',
  'guzape': 'Guzape',
  'katampe': 'Katampe',
  'durumi': 'Durumi',
  'galadimawa': 'Galadimawa',
  'kubwa': 'Kubwa',
  'lugbe': 'Lugbe'
};

const handleMessage = async (bot, msg) => {
  const text = msg.text;
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || "there";
  
  // Skip commands (messages starting with /)
  if (text.startsWith('/')) return;
  
  const lowerText = text.toLowerCase().trim();
  
  // ============================================
  // GREETINGS
  // ============================================
  if (lowerText.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
    return bot.sendMessage(chatId, 
      `👋 Hello ${firstName}! Welcome to Abuja Shortlet Apartment Bot.\n\n` +
      `I can help you find Studio, 1, 2, & 3 bedroom apartments in popular Abuja areas like:\n` +
      `• Asokoro • Maitama • Wuse 2 • Garki • Jabi • Gwarinpa\n\n` +
      `Try: "Show apartments in Asokoro" or type /help for all commands`
    );
  }
  
  // ============================================
  // APARTMENT SEARCH BY LOCATION
  // ============================================
  // Check if message contains any area name
  for (const [key, area] of Object.entries(areaList)) {
    if (lowerText.includes(key)) {
      return bot.sendMessage(chatId, 
        `📍 *Looking for apartments in ${area}?*\n\n` +
        `I have Studio, 1, 2, & 3 bedroom apartments available there.\n\n` +
        `Use: /search ${area}\n` +
        `Or tell me: "2 bedroom in ${area}" for specific search.`,
        { parse_mode: 'Markdown' }
      );
    }
  }
  
  // ============================================
  // APARTMENT TYPE SEARCH
  // ============================================
  if (lowerText.includes('studio') || lowerText.includes('self contain')) {
    return bot.sendMessage(chatId,
      `🏠 *Studio Apartments*\n\n` +
      `I have studio apartments in:\n` +
      `• Asokoro (₦50k-₦80k/night)\n` +
      `• Maitama (₦60k-₦90k/night)\n` +
      `• Wuse 2 (₦45k-₦70k/night)\n` +
      `• Garki (₦40k-₦65k/night)\n\n` +
      `Which area interests you?`,
      { parse_mode: 'Markdown' }
    );
  }
  
  if (lowerText.includes('1 bedroom') || lowerText.includes('one bedroom')) {
    return bot.sendMessage(chatId,
      `🛏️ *1-Bedroom Apartments*\n\n` +
      `Available in all major areas:\n` +
      `• Asokoro/Maitama (₦80k-₦150k/night)\n` +
      `• Wuse 2/Jabi (₦70k-₦120k/night)\n` +
      `• Garki/Utako (₦60k-₦100k/night)\n\n` +
      `Use /search 1bedroom [area] to see options!`,
      { parse_mode: 'Markdown' }
    );
  }
  
  if (lowerText.includes('2 bedroom') || lowerText.includes('two bedroom')) {
    return bot.sendMessage(chatId,
      `🛏️🛏️ *2-Bedroom Apartments*\n\n` +
      `Perfect for families and groups:\n` +
      `• Luxury in Asokoro (₦150k-₦250k/night)\n` +
      `• Comfort in Wuse 2 (₦120k-₦200k/night)\n` +
      `• Value in Gwarinpa (₦80k-₦150k/night)\n\n` +
      `Try: /search 2bedroom asokoro`,
      { parse_mode: 'Markdown' }
    );
  }
  
  if (lowerText.includes('3 bedroom') || lowerText.includes('three bedroom')) {
    return bot.sendMessage(chatId,
      `🏰 *3-Bedroom Executive Apartments*\n\n` +
      `Spacious luxury apartments:\n` +
      `• Maitama (₦200k-₦350k/night)\n` +
      `• Asokoro (₦180k-₦300k/night)\n` +
      `• Jabi (₦150k-₦250k/night)\n\n` +
      `Use: /search 3bedroom [area]`,
      { parse_mode: 'Markdown' }
    );
  }
  
  // ============================================
  // PRICE/BUDGET QUERIES
  // ============================================
  if (lowerText.includes('how much') || lowerText.includes('price') || lowerText.includes('cost')) {
    return bot.sendMessage(chatId,
      `💰 *Price Ranges*\n\n` +
      `• *Studio/Self Contain:* ₦40k - ₦90k/night\n` +
      `• *1-Bedroom:* ₦60k - ₦150k/night\n` +
      `• *2-Bedroom:* ₦80k - ₦250k/night\n` +
      `• *3-Bedroom:* ₦150k - ₦350k/night\n\n` +
      `Prices vary by location and season. Use /search with filters!`,
      { parse_mode: 'Markdown' }
    );
  }
  
  if (lowerText.includes('budget') || lowerText.includes('cheap') || lowerText.includes('affordable')) {
    return bot.sendMessage(chatId,
      `💰 *Budget-Friendly Options*\n\n` +
      `• Studios in Garki/Gwarinpa: ₦40k-₦60k\n` +
      `• 1-bedroom in Utako: ₦60k-₦80k\n` +
      `• 2-bedroom in Kubwa: ₦70k-₦90k\n\n` +
      `Use /search with min_price and max_price to filter!`,
      { parse_mode: 'Markdown' }
    );
  }
  
  if (lowerText.includes('luxury') || lowerText.includes('executive')) {
    return bot.sendMessage(chatId,
      `✨ *Luxury Apartments*\n\n` +
      `Premium options in:\n` +
      `• Maitama: 3-bedroom exec (₦250k-₦350k)\n` +
      `• Asokoro: 2-bedroom luxury (₦200k-₦300k)\n` +
      `• Jabi: Waterfront (₦180k-₦280k)\n\n` +
      `All with AC, generator, WiFi, and security!`,
      { parse_mode: 'Markdown' }
    );
  }
  
  // ============================================
  // SHORTLET/RENTAL DURATION
  // ============================================
  if (lowerText.includes('daily') || lowerText.includes('per night') || lowerText.includes('one day')) {
    return bot.sendMessage(chatId,
      `📅 *Daily/Shortlet Rates*\n\n` +
      `We offer flexible daily rates:\n` +
      `• Studio: ₦40k-₦70k/night\n` +
      `• 1-bedroom: ₦60k-₦100k/night\n` +
      `• 2-bedroom: ₦80k-₦150k/night\n\n` +
      `Use /search to find specific apartments!`
    );
  }
  
  if (lowerText.includes('weekly') || lowerText.includes('week')) {
    return bot.sendMessage(chatId,
      `📆 *Weekly Rates (7 nights)*\n\n` +
      `• Studio: ₦250k-₦450k/week\n` +
      `• 1-bedroom: ₦380k-₦600k/week\n` +
      `• 2-bedroom: ₦500k-₦900k/week\n\n` +
      `Ask about monthly rates for longer stays!`
    );
  }
  
  if (lowerText.includes('monthly')) {
    return bot.sendMessage(chatId,
      `📅 *Monthly Shortlet*\n\n` +
      `Special monthly rates available!\n` +
      `• Studios from ₦1.2M/month\n` +
      `• 1-bedroom from ₦1.8M/month\n` +
      `• 2-bedroom from ₦2.5M/month\n\n` +
      `Contact support for long-stay discounts!`
    );
  }
  
  // ============================================
  // AMENITIES
  // ============================================
  if (lowerText.includes('ac') || lowerText.includes('air condition')) {
    return bot.sendMessage(chatId,
      `❄️ *All our apartments have AC!*\n\n` +
      `• Central AC in luxury units\n` +
      `• Split units in standard apartments\n` +
      `• 24/7 cooling guaranteed\n\n` +
      `Use /search and filter by amenities!`
    );
  }
  
  if (lowerText.includes('light') || lowerText.includes('generator') || lowerText.includes('power')) {
    return bot.sendMessage(chatId,
      `⚡ *Power Supply*\n\n` +
      `All apartments have:\n` +
      `• Backup generators\n` +
      `• Inverters in some units\n` +
      `• 24/7 electricity guaranteed\n\n` +
      `No light issues with our apartments!`
    );
  }
  
  if (lowerText.includes('wifi') || lowerText.includes('internet')) {
    return bot.sendMessage(chatId,
      `🌐 *Internet/WiFi*\n\n` +
      `• High-speed fiber optic\n` +
      `• Unlimited data in most units\n` +
      `• 24/7 customer support\n\n` +
      `Perfect for remote work!`
    );
  }
  
  if (lowerText.includes('security')) {
    return bot.sendMessage(chatId,
      `🛡️ *Security*\n\n` +
      `All our apartments feature:\n` +
      `• 24/7 security guards\n` +
      `• CCTV surveillance\n` +
      `• Secure access control\n` +
      `• Safe neighborhoods\n\n` +
      `Your safety is our priority!`
    );
  }
  
  if (lowerText.includes('parking')) {
    return bot.sendMessage(chatId,
      `🚗 *Parking*\n\n` +
      `• Dedicated parking spaces\n` +
      `• Secure car parks\n` +
      `• Valet at select locations\n` +
      `• Easy access\n\n` +
      `Perfect for guests with cars!`
    );
  }
  
  // ============================================
  // OWNER/REGISTRATION QUERIES
  // ============================================
  if (lowerText.includes('become owner') || lowerText.includes('register owner') || lowerText.includes('list apartment')) {
    return bot.sendMessage(chatId,
      `🏢 *Become an Owner*\n\n` +
      `List your apartment with us!\n\n` +
      `• Reach thousands of guests\n` +
      `• Professional management\n` +
      `• Secure payments\n` +
      `• Best rates in Abuja\n\n` +
      `Type /register_owner to get started!`
    );
  }
  
  // ============================================
  // HELP/SUPPORT
  // ============================================
  if (lowerText.includes('help') || lowerText.includes('support') || lowerText.includes('contact')) {
    // You can import and call your help function here
    return bot.sendMessage(chatId, 
      `Need help? Type /help to see all available commands, or contact support @support_username`
    );
  }
  
  // ============================================
  // DEFAULT RESPONSE (when nothing matches)
  // ============================================
  // Only respond if message is short (likely a real query)
  if (lowerText.split(' ').length < 8) {
    bot.sendMessage(chatId,
      `🤔 I'm not sure I understand. Try:\n\n` +
      `• "Apartments in Maitama"\n` +
      `• "2 bedroom price"\n` +
      `• "Studio in Asokoro"\n` +
      `• "Luxury apartments"\n\n` +
      `Or type /help for all commands.`
    );
  }
};

module.exports = handleMessage;
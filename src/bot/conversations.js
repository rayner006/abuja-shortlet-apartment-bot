// src/bot/conversations.js
const logger = require('../config/logger');
const redis = require('../config/redis');
const stateManager = require('../services/stateManager');
const { processSearch } = require('../controllers/apartmentController');
const { processBookingDates, processBookingGuests } = require('../controllers/bookingController');
const { handleLocationSelection } = require('../controllers/locationController');
const { Apartment } = require('../models');  // 👈 ADD THIS

// Popular Abuja areas for quick responses
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

// ============================================
// ENHANCED KEYWORD DETECTION
// ============================================

// Apartment type keywords
const apartmentTypeKeywords = {
  'studio': ['studio', 'self contain', 'self contained', 'studio apartment'],
  '1bed': ['1 bedroom', 'one bedroom', '1 bed', 'one bed', '1bedroom', '1-bed'],
  '2bed': ['2 bedroom', 'two bedroom', '2 bed', 'two bed', '2bedroom', '2-bed'],
  '3bed': ['3 bedroom', 'three bedroom', '3 bed', 'three bed', '3bedroom', '3-bed'],
  'general': [
    'apartment', 'apartments', 
    'shortlet', 'shortlets', 
    'flat', 'flats',
    'property', 'properties',
    'accommodation', 'place to stay',
    'rental', 'vacation rental',
    'listing', 'listings'
  ]
};

// Amenity keywords
const amenityKeywords = {
  'wifi': ['wifi', 'internet', 'wi-fi', 'broadband', 'wireless', 'online'],
  'ac': ['ac', 'air conditioning', 'air condition', 'cooling', 'aircon', 'air conditioner'],
  'generator': ['generator', 'power', 'light', 'electricity', 'backup', 'lighting'],
  'pool': ['pool', 'swimming pool', 'swimming', 'poolside', 'swim'],
  'parking': ['parking', 'car park', 'parking space', 'garage', 'car parking'],
  'security': ['security', 'cctv', 'guard', 'safe', 'secure', '24/7 security'],
  'kitchen': ['kitchen', 'kitchenette', 'cooking', 'fully equipped kitchen', 'cook'],
  'tv': ['tv', 'television', 'cable tv', 'dstv', 'smart tv', 'satellite']
};

// Price/budget keywords
const priceKeywords = {
  'budget': ['budget', 'cheap', 'affordable', 'economy', 'low cost', 'inexpensive', 'discount'],
  'luxury': ['luxury', 'luxurious', 'high end', 'premium', 'expensive', 'executive', 'deluxe'],
  'midrange': ['moderate', 'mid-range', 'average', 'reasonable']
};

// Greeting keywords (expanded)
const greetingKeywords = [
  'hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
  'morning', 'evening', 'howdy', 'greetings', 'what\'s up', 'sup',
  'how are you', 'howdy', 'good day'
];

// Help/Support keywords
const helpKeywords = [
  'help', 'assist', 'support', 'guide', 'tutorial',
  'contact', 'reach', 'call', 'phone', 'email',
  'problem', 'issue', 'error', 'not working', 'bug',
  'how to', 'how do i', 'what is'
];

// Rental duration keywords
const durationKeywords = {
  'daily': ['daily', 'per night', 'one day', '1 night', 'nightly'],
  'weekly': ['weekly', 'per week', '7 days', 'one week'],
  'monthly': ['monthly', 'per month', '30 days', 'one month', 'long stay']
};

// ============================================
// HELPER FUNCTION TO EXTRACT LOCATION
// ============================================

const extractLocation = (text) => {
  for (const [key, area] of Object.entries(areaList)) {
    if (text.includes(key)) {
      return area;
    }
  }
  return null;
};

// ============================================
// HELPER FUNCTION TO FORMAT APARTMENT LISTING
// ============================================

const formatApartmentListing = (apartment, index) => {
  let amenities = [];
  try {
    amenities = JSON.parse(apartment.amenities) || [];
  } catch (e) {
    amenities = [];
  }
  
  const amenitiesPreview = amenities.slice(0, 3).join(' • ');
  
  return `*${index}. ${apartment.title}*\n` +
         `📍 ${apartment.address}\n` +
         `💰 ₦${apartment.price_per_night}/night\n` +
         `🚽 ${apartment.bathrooms} bathroom(s) | 👥 Max ${apartment.max_guests} guests\n` +
         `✨ ${amenitiesPreview}\n`;
};

// ============================================
// MAIN MESSAGE HANDLER
// ============================================

const handleMessage = async (bot, msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const firstName = msg.from.first_name || "there";
  
  try {
    // ============================================
    // PRIORITY 1: Check active conversations FIRST
    // ============================================
    
    // Check if user is in a search conversation
    const searchState = stateManager.getSearchState(userId);
    if (searchState && searchState.step === 'awaiting_input') {
      await processSearch(bot, msg);
      return;
    }
    
    // Check if user is in a booking conversation
    const bookingState = stateManager.getBookingState(userId);
    if (bookingState) {
      if (bookingState.step === 'dates') {
        await processBookingDates(bot, msg);
        return;
      } else if (bookingState.step === 'guests') {
        await processBookingGuests(bot, msg);
        return;
      }
    }
    
    // ============================================
    // PRIORITY 2: Handle media messages
    // ============================================
    
    // Handle contact sharing
    if (msg.contact) {
      const { User } = require('../models');
      const user = await User.findOne({ where: { telegramId: userId } });
      
      if (user) {
        user.phone = msg.contact.phone_number;
        await user.save();
        await bot.sendMessage(chatId, '✅ Phone number saved successfully!');
      }
      return;
    }
    
    // Handle location sharing
    if (msg.location) {
      await bot.sendMessage(chatId, 
        '📍 Location received! Use /search to find apartments near you.'
      );
      return;
    }
    
    // ============================================
    // PRIORITY 3: Handle button clicks from keyboard
    // ============================================
    
    // 🔍 Handle "Apartments" button
    if (text === '🔍 Apartments') {
      await handleLocationSelection(bot, msg);
      return;
    }
    
    // 📅 Handle "My Bookings" button
    if (text === '📅 My Bookings') {
      const { handleMyBookings } = require('../controllers/bookingController');
      await handleMyBookings(bot, { 
        chat: { id: chatId }, 
        from: msg.from 
      });
      return;
    }
    
    // 📋 Handle "List Property" button
    if (text === '📋 List Property') {
      const { User } = require('../models');
      const user = await User.findOne({ where: { telegramId: userId } });
      
      if (user && (user.role === 'owner' || user.role === 'admin')) {
        // User is already an owner
        await bot.sendMessage(chatId, 
          '📋 *List Your Property*\n\n' +
          'Use /add_apartment to list a new property or /my_apartments to manage existing ones.',
          { parse_mode: 'Markdown' }
        );
      } else {
        // User needs to register as owner
        await bot.sendMessage(chatId,
          '🏠 *Become a Property Owner*\n\n' +
          'To list your property, you need to register as an owner first.\n\n' +
          'Type /register_owner to get started!',
          { parse_mode: 'Markdown' }
        );
      }
      return;
    }
    
    // ❓ Handle "Help" button
    if (text === '❓ Help') {
      const helpText = `
🤖 *Abuja Shortlet Apartment Bot - Help*

*Available Commands:*
/start - Start the bot
/menu - Show main menu
/search - Search for apartments
/my\\_bookings - View your bookings
/help - Show this help message

*For Property Owners:*
/register\\_owner - Register to list your property
/add\\_apartment - Add a new apartment listing
/my\\_apartments - Manage your listings
      `;
      await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
      return;
    }
    
    // ============================================
    // PRIORITY 4: Skip commands
    // ============================================
    if (text.startsWith('/')) return;
    
    // ============================================
    // PRIORITY 5: Natural language processing with REAL DATABASE QUERIES
    // ============================================
    
    const lowerText = text.toLowerCase().trim();
    
    // ----- GREETINGS (Enhanced) -----
    if (greetingKeywords.some(greeting => lowerText.includes(greeting))) {
      return bot.sendMessage(chatId, 
        `👋 Hello ${firstName}! Welcome to Abuja Shortlet Apartment Bot.\n\n` +
        `I can help you find Studio, 1, 2, & 3 bedroom apartments in popular Abuja areas like:\n` +
        `• Asokoro • Maitama • Wuse 2 • Garki • Jabi • Gwarinpa\n\n` +
        `Try: "Show apartments in Asokoro" or type /menu to see all options`
      );
    }
    
    // ----- HELP/SUPPORT (Enhanced) -----
    if (helpKeywords.some(keyword => lowerText.includes(keyword))) {
      return bot.sendMessage(chatId, 
        `🆘 *Need Help?*\n\n` +
        `Here's how I can assist you:\n\n` +
        `🔍 *Search for apartments* - Tell me location (e.g., "Asokoro")\n` +
        `🏠 *Apartment types* - Studio, 1-Bed, 2-Bed, 3-Bed\n` +
        `💰 *Budget* - "Under ₦100k", "Luxury apartments"\n` +
        `✨ *Amenities* - "Apartments with pool", "WiFi"\n\n` +
        `Type /help for all commands or /menu to see options.`
      );
    }
    
    // ----- AREA/LOCATION SEARCH WITH APARTMENT TYPE -----
    const detectedLocation = extractLocation(lowerText);
    
    // Check for STUDIO apartments
    if (apartmentTypeKeywords.studio.some(keyword => lowerText.includes(keyword))) {
      if (detectedLocation) {
        try {
          const apartments = await Apartment.findAll({
            where: {
              location: detectedLocation,
              bedrooms: 0,
              is_available: 1
            }
          });
          
          if (apartments.length > 0) {
            let response = `🏠 *Studio Apartments in ${detectedLocation}*\n\n`;
            apartments.forEach((apt, index) => {
              response += formatApartmentListing(apt, index + 1);
            });
            response += `\nUse /search to see more options or book!`;
            return bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
          } else {
            return bot.sendMessage(chatId,
              `😔 Sorry, no studio apartments found in ${detectedLocation} right now.\n\n` +
              `Try:\n` +
              `• A different location\n` +
              `• 1-Bedroom apartments\n` +
              `• Check back later\n\n` +
              `Use /search to explore other options.`
            );
          }
        } catch (error) {
          logger.error('Database query error:', error);
          return bot.sendMessage(chatId, 'Error searching for apartments. Please try again.');
        }
      } else {
        return bot.sendMessage(chatId,
          `🏠 *Studio Apartments*\n\n` +
          `I have studio apartments in:\n` +
          `• Asokoro\n` +
          `• Maitama\n` +
          `• Wuse Zone 1-7\n` +
          `• Garki Area 1-11\n` +
          `• Jabi\n` +
          `• Gwarinpa\n\n` +
          `Tell me which area you're interested in!\n` +
          `Example: "studio in kubwa"`,
          { parse_mode: 'Markdown' }
        );
      }
    }
    
    // Check for 1-BEDROOM apartments
    if (apartmentTypeKeywords['1bed'].some(keyword => lowerText.includes(keyword))) {
      if (detectedLocation) {
        try {
          const apartments = await Apartment.findAll({
            where: {
              location: detectedLocation,
              bedrooms: 1,
              is_available: 1
            }
          });
          
          if (apartments.length > 0) {
            let response = `🛏️ *1-Bedroom Apartments in ${detectedLocation}*\n\n`;
            apartments.forEach((apt, index) => {
              response += formatApartmentListing(apt, index + 1);
            });
            response += `\nUse /search to see more options or book!`;
            return bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
          } else {
            return bot.sendMessage(chatId,
              `😔 Sorry, no 1-bedroom apartments found in ${detectedLocation} right now.\n\n` +
              `Try:\n` +
              `• A different location\n` +
              `• Studio or 2-Bedroom apartments\n` +
              `• Check back later\n\n` +
              `Use /search to explore other options.`
            );
          }
        } catch (error) {
          logger.error('Database query error:', error);
          return bot.sendMessage(chatId, 'Error searching for apartments. Please try again.');
        }
      } else {
        return bot.sendMessage(chatId,
          `🛏️ *1-Bedroom Apartments*\n\n` +
          `I have 1-bedroom apartments in:\n` +
          `• Asokoro\n` +
          `• Maitama\n` +
          `• Wuse Zone 1-7\n` +
          `• Garki Area 1-11\n` +
          `• Jabi\n` +
          `• Gwarinpa\n\n` +
          `Tell me which area you're interested in!\n` +
          `Example: "1 bedroom in maitama"`,
          { parse_mode: 'Markdown' }
        );
      }
    }
    
    // Check for 2-BEDROOM apartments (FIX FOR KUBWA!)
    if (apartmentTypeKeywords['2bed'].some(keyword => lowerText.includes(keyword))) {
      if (detectedLocation) {
        try {
          const apartments = await Apartment.findAll({
            where: {
              location: detectedLocation,
              bedrooms: 2,
              is_available: 1
            }
          });
          
          if (apartments.length > 0) {
            let response = `🛏️🛏️ *2-Bedroom Apartments in ${detectedLocation}*\n\n`;
            apartments.forEach((apt, index) => {
              response += formatApartmentListing(apt, index + 1);
            });
            response += `\nUse /search to see more options or book!`;
            return bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
          } else {
            return bot.sendMessage(chatId,
              `😔 Sorry, no 2-bedroom apartments found in ${detectedLocation} right now.\n\n` +
              `Try:\n` +
              `• A different location\n` +
              `• 1-Bedroom or 3-Bedroom apartments\n` +
              `• Check back later\n\n` +
              `Use /search to explore other options.`
            );
          }
        } catch (error) {
          logger.error('Database query error:', error);
          return bot.sendMessage(chatId, 'Error searching for apartments. Please try again.');
        }
      } else {
        return bot.sendMessage(chatId,
          `🛏️🛏️ *2-Bedroom Apartments*\n\n` +
          `I have 2-bedroom apartments in:\n` +
          `• Asokoro\n` +
          `• Maitama\n` +
          `• Wuse Zone 1-7\n` +
          `• Garki Area 1-11\n` +
          `• Jabi\n` +
          `• Gwarinpa\n` +
          `• Kubwa\n\n` +
          `Tell me which area you're interested in!\n` +
          `Example: "2 bedroom in kubwa"`,
          { parse_mode: 'Markdown' }
        );
      }
    }
    
    // Check for 3-BEDROOM apartments
    if (apartmentTypeKeywords['3bed'].some(keyword => lowerText.includes(keyword))) {
      if (detectedLocation) {
        try {
          const apartments = await Apartment.findAll({
            where: {
              location: detectedLocation,
              bedrooms: 3,
              is_available: 1
            }
          });
          
          if (apartments.length > 0) {
            let response = `🏰 *3-Bedroom Apartments in ${detectedLocation}*\n\n`;
            apartments.forEach((apt, index) => {
              response += formatApartmentListing(apt, index + 1);
            });
            response += `\nUse /search to see more options or book!`;
            return bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
          } else {
            return bot.sendMessage(chatId,
              `😔 Sorry, no 3-bedroom apartments found in ${detectedLocation} right now.\n\n` +
              `Try:\n` +
              `• A different location\n` +
              `• 2-Bedroom apartments\n` +
              `• Check back later\n\n` +
              `Use /search to explore other options.`
            );
          }
        } catch (error) {
          logger.error('Database query error:', error);
          return bot.sendMessage(chatId, 'Error searching for apartments. Please try again.');
        }
      } else {
        return bot.sendMessage(chatId,
          `🏰 *3-Bedroom Executive Apartments*\n\n` +
          `I have 3-bedroom apartments in:\n` +
          `• Asokoro\n` +
          `• Maitama\n` +
          `• Jabi\n` +
          `• Gwarinpa\n\n` +
          `Tell me which area you're interested in!\n` +
          `Example: "3 bedroom in asokoro"`,
          { parse_mode: 'Markdown' }
        );
      }
    }
    
    // ----- GENERAL APARTMENT SEARCH -----
    if (apartmentTypeKeywords.general.some(keyword => lowerText.includes(keyword))) {
      if (detectedLocation) {
        try {
          const apartments = await Apartment.findAll({
            where: {
              location: detectedLocation,
              is_available: 1
            },
            limit: 10
          });
          
          if (apartments.length > 0) {
            let response = `🔍 *Apartments in ${detectedLocation}*\n\n`;
            apartments.forEach((apt, index) => {
              let type = '';
              if (apt.bedrooms === 0) type = 'Studio';
              else if (apt.bedrooms === 1) type = '1-Bed';
              else if (apt.bedrooms === 2) type = '2-Bed';
              else if (apt.bedrooms === 3) type = '3-Bed';
              
              response += `*${index + 1}. ${apt.title}* (${type})\n`;
              response += `💰 ₦${apt.price_per_night}/night\n`;
            });
            response += `\nTell me which type you prefer: studio, 1-bed, 2-bed, or 3-bed!`;
            return bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
          } else {
            return bot.sendMessage(chatId,
              `😔 No apartments found in ${detectedLocation} right now.\n\n` +
              `Try another location!`
            );
          }
        } catch (error) {
          logger.error('Database query error:', error);
          return bot.sendMessage(chatId, 'Error searching for apartments.');
        }
      } else {
        return bot.sendMessage(chatId,
          `🔍 *Looking for apartments?*\n\n` +
          `Tell me which area you're interested in:\n` +
          `• Asokoro\n• Maitama\n• Wuse\n• Garki\n• Jabi\n• Gwarinpa\n• Kubwa\n\n` +
          `Example: "Apartments in Kubwa"`,
          { parse_mode: 'Markdown' }
        );
      }
    }
    
    // ----- PRICE/BUDGET QUERIES -----
    if (lowerText.includes('how much') || lowerText.includes('price') || lowerText.includes('cost')) {
      return bot.sendMessage(chatId,
        `💰 *Price Ranges*\n\n` +
        `• *Studio/Self Contain:* ₦20k - ₦50k/night\n` +
        `• *1-Bedroom:* ₦30k - ₦75k/night\n` +
        `• *2-Bedroom:* ₦45k - ₦100k/night\n` +
        `• *3-Bedroom:* ₦80k - ₦150k/night\n\n` +
        `Prices vary by location and season. Use /search with filters!`,
        { parse_mode: 'Markdown' }
      );
    }
    
    if (priceKeywords.budget.some(keyword => lowerText.includes(keyword))) {
      return bot.sendMessage(chatId,
        `💰 *Budget-Friendly Options*\n\n` +
        `• Studios in Garki/Gwarinpa: ₦20k-₦35k\n` +
        `• 1-bedroom in Utako/Kubwa: ₦28k-₦40k\n` +
        `• 2-bedroom in Kubwa: ₦45k-₦60k\n\n` +
        `Use /search with min_price and max_price to filter!`,
        { parse_mode: 'Markdown' }
      );
    }
    
    if (priceKeywords.luxury.some(keyword => lowerText.includes(keyword))) {
      return bot.sendMessage(chatId,
        `✨ *Luxury Apartments*\n\n` +
        `Premium options in:\n` +
        `• Maitama: 3-bedroom (₦120k-₦150k)\n` +
        `• Asokoro: 2-bedroom (₦80k-₦100k)\n` +
        `• Jabi: Waterfront (₦70k-₦90k)\n\n` +
        `All with AC, generator, WiFi, and security!`,
        { parse_mode: 'Markdown' }
      );
    }
    
    // ----- AMENITIES -----
    if (amenityKeywords.wifi.some(keyword => lowerText.includes(keyword))) {
      return bot.sendMessage(chatId,
        `📶 *WiFi Availability*\n\n` +
        `✅ All our apartments have high-speed WiFi!\n` +
        `• Fiber optic connection\n` +
        `• Unlimited data in most units\n` +
        `• Perfect for remote work`,
        { parse_mode: 'Markdown' }
      );
    }
    
    if (amenityKeywords.ac.some(keyword => lowerText.includes(keyword))) {
      return bot.sendMessage(chatId,
        `❄️ *Air Conditioning*\n\n` +
        `✅ All our apartments have AC!\n` +
        `• Central AC in luxury units\n` +
        `• Split units in standard apartments\n` +
        `• 24/7 cooling guaranteed`,
        { parse_mode: 'Markdown' }
      );
    }
    
    if (amenityKeywords.generator.some(keyword => lowerText.includes(keyword))) {
      return bot.sendMessage(chatId,
        `⚡ *Power Supply*\n\n` +
        `All apartments have:\n` +
        `• Backup generators\n` +
        `• Inverters in some units\n` +
        `• 24/7 electricity guaranteed`,
        { parse_mode: 'Markdown' }
      );
    }
    
    if (amenityKeywords.pool.some(keyword => lowerText.includes(keyword))) {
      return bot.sendMessage(chatId,
        `🏊 *Swimming Pool*\n\n` +
        `Luxury apartments with pools available in:\n` +
        `• Maitama\n` +
        `• Asokoro\n` +
        `• Jabi\n\n` +
        `Use /search and filter by "pool" to find them!`,
        { parse_mode: 'Markdown' }
      );
    }
    
    if (amenityKeywords.parking.some(keyword => lowerText.includes(keyword))) {
      return bot.sendMessage(chatId,
        `🅿️ *Parking*\n\n` +
        `• Dedicated parking spaces\n` +
        `• Secure car parks\n` +
        `• Valet at select locations`,
        { parse_mode: 'Markdown' }
      );
    }
    
    if (amenityKeywords.security.some(keyword => lowerText.includes(keyword))) {
      return bot.sendMessage(chatId,
        `🛡️ *Security*\n\n` +
        `All our apartments feature:\n` +
        `• 24/7 security guards\n` +
        `• CCTV surveillance\n` +
        `• Secure access control`,
        { parse_mode: 'Markdown' }
      );
    }
    
    if (amenityKeywords.kitchen.some(keyword => lowerText.includes(keyword))) {
      return bot.sendMessage(chatId,
        `🍳 *Kitchen Facilities*\n\n` +
        `• Fully equipped kitchens\n` +
        `• Modern appliances\n` +
        `• Cooking utensils provided`,
        { parse_mode: 'Markdown' }
      );
    }
    
    if (amenityKeywords.tv.some(keyword => lowerText.includes(keyword))) {
      return bot.sendMessage(chatId,
        `📺 *Entertainment*\n\n` +
        `• Smart TVs in all apartments\n` +
        `• Cable TV (DSTV/GOtv)\n` +
        `• Netflix available in some units`,
        { parse_mode: 'Markdown' }
      );
    }
    
    // ----- RENTAL DURATION -----
    if (durationKeywords.daily.some(keyword => lowerText.includes(keyword))) {
      return bot.sendMessage(chatId,
        `📅 *Daily/Shortlet Rates*\n\n` +
        `We offer flexible daily rates:\n` +
        `• Studio: ₦20k-₦50k/night\n` +
        `• 1-bedroom: ₦30k-₦75k/night\n` +
        `• 2-bedroom: ₦45k-₦100k/night\n\n` +
        `Use /search to find specific apartments!`
      );
    }
    
    if (durationKeywords.weekly.some(keyword => lowerText.includes(keyword))) {
      return bot.sendMessage(chatId,
        `📆 *Weekly Rates (7 nights)*\n\n` +
        `• Studio: ₦120k-₦300k/week\n` +
        `• 1-bedroom: ₦180k-₦450k/week\n` +
        `• 2-bedroom: ₦270k-₦600k/week\n\n` +
        `Ask about monthly rates for longer stays!`
      );
    }
    
    if (durationKeywords.monthly.some(keyword => lowerText.includes(keyword))) {
      return bot.sendMessage(chatId,
        `📅 *Monthly Shortlet*\n\n` +
        `Special monthly rates available!\n` +
        `• Studios from ₦500k/month\n` +
        `• 1-bedroom from ₦800k/month\n` +
        `• 2-bedroom from ₦1.2M/month\n\n` +
        `Contact support for long-stay discounts!`
      );
    }
    
    // ----- LIST APARTMENT (OWNER REGISTRATION) -----
    if (lowerText.includes('list apartment') || lowerText.includes('become owner') || lowerText.includes('register owner') || lowerText.includes('list my apartment')) {
      return bot.sendMessage(chatId,
        `📋 *List Your Apartment*\n\n` +
        `Ready to earn from your property?\n\n` +
        `✅ *Benefits:*\n` +
        `• Reach thousands of potential guests\n` +
        `• Professional property management\n` +
        `• Secure payment processing\n` +
        `• Best rates in Abuja\n\n` +
        `Type /register_owner to get started!`,
        { parse_mode: 'Markdown' }
      );
    }
    
    // ============================================
    // DEFAULT RESPONSE (when nothing matches)
    // ============================================
    // Only respond if message is short (likely a real query)
    if (lowerText.split(' ').length < 8) {
      await bot.sendMessage(chatId, 
        "I didn't understand that command. Use /menu to see available options or /help for assistance."
      );
    }
    
  } catch (error) {
    logger.error('Message handler error:', error);
    bot.sendMessage(chatId, 'An error occurred. Please try again.');
  }
};

// Conversation cancellation handler
const cancelConversation = async (bot, msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  // Clear any active conversations
  stateManager.clearAllStates(userId);
  
  await bot.sendMessage(chatId, 
    '❌ Conversation cancelled. Use /menu to start over.'
  );
};

module.exports = {
  handleMessage,
  cancelConversation
};

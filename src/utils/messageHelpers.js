const fs = require('fs');
const path = require('path');
const { getMainMenuKeyboard, getLocationsKeyboard, getApartmentTypesKeyboard, 
        getApartmentActionsKeyboard, getSearchOptionsKeyboard, getBackKeyboard } = require('./keyboard');
const Apartment = require('../models/Apartment');
const { getUploadPath } = require('../config/uploads');
const { getRedis } = require('../config/redis');
const logger = require('../middleware/logger');

async function showMainMenu(bot, chatId, text = '*Welcome To* 👋\n\n*Abuja Shortlet Apartments* 🏠\n\n👇 *Click On Any Menu Below*') {
  const keyboard = getMainMenuKeyboard();
  await bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard.reply_markup
  });
}

async function showWelcomeBack(bot, chatId) {
  const welcomeBackText = '*Welcome Back!* 👋\n\n*Abuja Shortlet Apartments* 🏠\n\n👇 *Click On Any Menu Below To Continue*';
  await showMainMenu(bot, chatId, welcomeBackText);
}

async function showLocations(bot, chatId) {
  const keyboard = getLocationsKeyboard();
  await bot.sendMessage(chatId, '📍 *Select a location:*', {
    parse_mode: 'Markdown',
    reply_markup: keyboard.reply_markup
  });
}

async function showApartmentTypes(bot, chatId, location) {
  const redis = getRedis();
  await redis.setex(`selected_location:${chatId}`, 3600, JSON.stringify({ location }));
  
  const keyboard = getApartmentTypesKeyboard(location);
  await bot.sendMessage(chatId, `📍 *Location:* ${location.replace(/[🏛️🏘️💰🏭]/g, '').trim()}\n\n🏠 *Select Apartment Type:*`, {
    parse_mode: 'Markdown',
    reply_markup: keyboard.reply_markup
  });
}

async function showApartmentsByLocationAndType(bot, chatId, location, apartmentType) {
  try {
    // Log what we're searching for
    console.log('🔍 Searching apartments:', { 
      location: location.replace(/[🏛️🏘️💰🏭]/g, '').trim(), 
      apartmentType: apartmentType.replace('🛏️ ', '').trim() 
    });
    
    const apartments = await Apartment.findByLocationAndType(location, apartmentType, true);
    
    console.log(`📊 Found ${apartments.length} apartments`);
    
    if (apartments.length === 0) {
      const keyboard = getSearchOptionsKeyboard();
      return bot.sendMessage(chatId, `😔 No ${apartmentType.replace('🛏️ ', '')} apartments available in ${location.replace(/[🏛️🏘️💰🏭]/g, '')} right now.\nTry another apartment type or location!`, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    }
    
    for (const apt of apartments) {
      await sendApartmentWithPhotos(bot, chatId, apt);
    }
    
    setTimeout(async () => {
      const keyboard = getSearchOptionsKeyboard();
      await bot.sendMessage(chatId, '🔍 *What would you like to do next?*', {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    }, 3000);
    
  } catch (error) {
    logger.error('Error showing apartments:', error);
    bot.sendMessage(chatId, '❌ Error fetching apartments. Please try again.');
  }
}

async function sendApartmentWithPhotos(bot, chatId, apt) {
  console.log('📸 Sending apartment:', apt.name);
  console.log('🔍 ===== BOOK NOW BUTTON DEBUG =====');
  console.log('🔑 Apartment ID:', apt.id);
  console.log('🔑 Apartment ID type:', typeof apt.id);
  console.log('🔑 Apartment ID exists:', !!apt.id);
  console.log('📊 Full apartment object:', JSON.stringify(apt, null, 2));
  
  const photoPaths = Apartment.processPhotos(apt);
  console.log('📸 Photo paths count:', photoPaths.length);
  
  if (photoPaths.length > 0) {
    const mediaGroup = [];
    const photosToSend = photoPaths.slice(0, 10);
    
    for (let i = 0; i < photosToSend.length; i++) {
      const fullPath = getUploadPath(photosToSend[i]);
      
      if (fullPath && fs.existsSync(fullPath)) {
        mediaGroup.push({
          type: 'photo',
          media: fullPath,
          caption: undefined,
          parse_mode: 'Markdown'
        });
      } else {
        logger.warn(`Photo not found: ${photosToSend[i]}`);
      }
    }
    
    if (mediaGroup.length > 0) {
      try {
        await bot.sendMediaGroup(chatId, mediaGroup);
        console.log('✅ Photos sent successfully');
      } catch (err) {
        logger.error('Error sending media group:', err);
        for (let i = 0; i < photosToSend.length; i++) {
          const fullPath = getUploadPath(photosToSend[i]);
          
          setTimeout(async () => {
            try {
              await bot.sendPhoto(chatId, fullPath, {
                caption: undefined,
                parse_mode: 'Markdown'
              });
            } catch (e) {
              logger.error(`Error sending photo ${i + 1}:`, e.message);
            }
          }, i * 500);
        }
      }
    }
  } else {
    console.log('📸 No photos for this apartment');
  }
  
  setTimeout(async () => {
    const message = `
🏠 *Name:* ${apt.name}
📍 *Location:* ${apt.location}
📌 *Address:* ${apt.address || 'Contact admin for address'}
🏷️ *Type:* ${apt.type}
💰 *Price:* ₦${apt.price}/night
🛏️ *Bedrooms:* ${apt.bedrooms || 0}
🚿 *Bathrooms:* ${apt.bathrooms || 1}
📝 *Description:* ${apt.description}
    `;
    
    console.log('🔍 Creating keyboard for apartment ID:', apt.id);
    
    // TEST 1: Try with hardcoded keyboard first
    console.log('📋 TEST 1: Sending with HARDCODED keyboard');
    const hardcodedKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📅 TEST BOOK NOW BUTTON', callback_data: 'test_book_button' }]
        ]
      }
    };
    
    try {
      const sent1 = await bot.sendMessage(chatId, message + '\n\n_[Test Mode - Hardcoded Button]_', {
        parse_mode: 'Markdown',
        reply_markup: hardcodedKeyboard
      });
      console.log('✅ TEST 1 SUCCESS: Message sent with hardcoded button. Message ID:', sent1.message_id);
    } catch (error) {
      console.error('❌ TEST 1 FAILED:', error);
    }
    
    // TEST 2: Try with actual keyboard function
    console.log('📋 TEST 2: Getting actual keyboard from getApartmentActionsKeyboard()');
    const actualKeyboard = getApartmentActionsKeyboard(apt.id);
    console.log('📋 Actual keyboard output:', JSON.stringify(actualKeyboard, null, 2));
    
    try {
      const sent2 = await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: actualKeyboard
      });
      console.log('✅ TEST 2 SUCCESS: Message sent with actual keyboard. Message ID:', sent2.message_id);
    } catch (error) {
      console.error('❌ TEST 2 FAILED:', error);
    }
    
    console.log('🔍 ===== END DEBUG =====');
    
  }, 1500);
}

async function contactAdmin(bot, chatId) {
  const message = `
📞 *Contact Admin*

For inquiries and bookings:
📱 *Phone:* +234 800 000 0000
📧 *Email:* admin@abujashortlet.com
💬 *WhatsApp:* +234 800 000 0000

🌟 Our team is available 24/7 to assist you!
  `;
  
  const keyboard = getBackKeyboard();
  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard.reply_markup
  });
}

async function aboutUs(bot, chatId) {
  const message = `
ℹ️ *About Abuja Shortlet Apartments*

We provide premium short-let apartments across Abuja's finest locations:

🏛️ *Our Locations:*
Maitama • Asokoro • Wuse • Jabi • Garki • Gwarinpa
Guzape • Katampe • Jahi • Utako • Wuye • Life Camp
Apo • Lokogoma • Kubwa • Lugbe • Durumi • Gwagwalada

🏠 *Apartment Types:*
Self Contain • 1-Bedroom • 2-Bedroom • 3-Bedroom

✨ *Why choose us?*
• Verified properties ✅
• Secure payments 🔒
• 24/7 customer support 🎧
• Best price guarantee 💰

Book your stay today! 🏠
  `;
  
  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [
        ['🏠 View Apartments'],
        ['⬅️ Back to Main Menu']
      ],
      resize_keyboard: true
    }
  });
}

module.exports = {
  showMainMenu,
  showWelcomeBack,
  showLocations,
  showApartmentTypes,
  showApartmentsByLocationAndType,
  contactAdmin,
  aboutUs
};

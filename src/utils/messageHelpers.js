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
  
  const photoPaths = Apartment.processPhotos(apt);
  
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
  
  // Send apartment details with button IMMEDIATELY (no delay)
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
  
  // ========== ADD THIS DEBUG BLOCK ==========
  console.log('🔍 BOOK NOW BUTTON DEBUG:');
  console.log('📋 Apartment object:', {
    id: apt.id,
    name: apt.name,
    hasId: !!apt.id,
    idType: typeof apt.id,
    idValue: apt.id
  });
  
  const keyboard = getApartmentActionsKeyboard(apt.id);
  console.log('📋 Keyboard from getApartmentActionsKeyboard:', JSON.stringify(keyboard, null, 2));
  console.log('📋 Does keyboard have inline_keyboard?', !!(keyboard.reply_markup && keyboard.reply_markup.inline_keyboard));
  console.log('📋 Inline keyboard content:', keyboard.reply_markup?.inline_keyboard);
  // ==========================================
  
  try {
    const sent = await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    console.log('✅ Apartment details with Book Now button sent, message ID:', sent.message_id);
  } catch (error) {
    console.error('❌ Error sending apartment details with button:', error);
  }
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

const fs = require('fs');
const path = require('path');
const {
  getMainMenuKeyboard,
  getLocationsKeyboard,
  getApartmentTypesKeyboard,
  getApartmentActionsKeyboard,
  getSearchOptionsKeyboard,
  getBackKeyboard
} = require('./keyboard');

const Apartment = require('../models/Apartment');
const { getUploadPath } = require('../config/uploads');
const { getRedis } = require('../config/redis');
const logger = require('../middleware/logger');

/* ================= MAIN MENU ================= */
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

/* ================= LOCATIONS ================= */
async function showLocations(bot, chatId) {
  const keyboard = getLocationsKeyboard();
  await bot.sendMessage(chatId, '📍 *Select a location:*', {
    parse_mode: 'Markdown',
    reply_markup: keyboard.reply_markup
  });
}

/* ================= APARTMENT TYPES ================= */
async function showApartmentTypes(bot, chatId, location) {
  const redis = getRedis();
  await redis.setex(`selected_location:${chatId}`, 3600, JSON.stringify({ location }));

  const keyboard = getApartmentTypesKeyboard(location);
  await bot.sendMessage(
    chatId,
    `📍 *Location:* ${location.replace(/[🏛️🏘️💰🏭]/g, '').trim()}\n\n🏠 *Select Apartment Type:*`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    }
  );
}

/* ================= SHOW APARTMENTS ================= */
async function showApartmentsByLocationAndType(bot, chatId, location, apartmentType) {
  try {
    const apartments = await Apartment.findByLocationAndType(location, apartmentType, true);

    if (apartments.length === 0) {
      const keyboard = getSearchOptionsKeyboard();
      return bot.sendMessage(
        chatId,
        `😔 No ${apartmentType.replace('🛏️ ', '')} apartments available in ${location.replace(/[🏛️🏘️💰🏭]/g, '')} right now.`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup
        }
      );
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

/* ================= SEND APARTMENT + BUTTON ================= */
async function sendApartmentWithPhotos(bot, chatId, apt) {
  const photoPaths = Apartment.processPhotos(apt);

  // ---- SEND PHOTOS ----
  if (photoPaths.length > 0) {
    const mediaGroup = [];
    const photosToSend = photoPaths.slice(0, 10);

    for (let p of photosToSend) {
      const fullPath = getUploadPath(p);
      if (fullPath && fs.existsSync(fullPath)) {
        mediaGroup.push({ type: 'photo', media: fullPath });
      }
    }

    if (mediaGroup.length > 0) {
      try {
        await bot.sendMediaGroup(chatId, mediaGroup);
      } catch {
        for (let i = 0; i < photosToSend.length; i++) {
          const fullPath = getUploadPath(photosToSend[i]);
          setTimeout(() => bot.sendPhoto(chatId, fullPath), i * 500);
        }
      }
    }
  }

  // ---- DETAILS MESSAGE ----
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

  const keyboard = getApartmentActionsKeyboard(apt.id);

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard.reply_markup   // ✅ FIXED
  });
}

/* ================= CONTACT ADMIN ================= */
async function contactAdmin(bot, chatId) {
  const keyboard = getBackKeyboard();
  await bot.sendMessage(chatId, '📞 *Contact Admin*\n\nPhone: +234 800 000 0000', {
    parse_mode: 'Markdown',
    reply_markup: keyboard.reply_markup
  });
}

/* ================= ABOUT US ================= */
async function aboutUs(bot, chatId) {
  await bot.sendMessage(chatId, 'ℹ️ *About Abuja Shortlet Apartments*', {
    parse_mode: 'Markdown',
    reply_markup: {
      keyboard: [['🏠 View Apartments'], ['⬅️ Back to Main Menu']],
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

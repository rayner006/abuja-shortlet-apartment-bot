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
          caption: i === 0 ? `📸 *${apt.name}*` : undefined,  // 👈 REMOVED photo count
          parse_mode: 'Markdown'
        });
      } else {
        logger.warn(`Photo not found: ${photosToSend[i]}`);
      }
    }
    
    if (mediaGroup.length > 0) {
      try {
        await bot.sendMediaGroup(chatId, mediaGroup);
      } catch (err) {
        logger.error('Error sending media group:', err);
        for (let i = 0; i < photosToSend.length; i++) {
          const fullPath = getUploadPath(photosToSend[i]);
          
          setTimeout(async () => {
            try {
              await bot.sendPhoto(chatId, fullPath, {
                caption: i === 0 ? `📸 *${apt.name}*` : undefined,  // 👈 REMOVED photo count here too
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
    
    const keyboard = getApartmentActionsKeyboard(apt.id);
    
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }, 1500);
}

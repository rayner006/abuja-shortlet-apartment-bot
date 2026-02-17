const { executeQuery } = require('../../../config/database');
const logger = require('../../../middleware/logger');
const Apartment = require('../../../models/Apartment');
const { getRedis } = require('../../../config/redis');
const fs = require('fs');
const { getUploadPath } = require('../../../config/uploads');
const fetch = require('node-fetch');
const path = require('path');

module.exports = {
  handle: async (bot, cb, chatId, data) => {
    
    // View all locations
    if (data === 'admin_apartments_all') {
      await handleViewLocations(bot, cb, chatId);
    }
    
    // View apartments in location
    else if (data.startsWith('admin_apartments_location_')) {
      await handleApartmentsByLocation(bot, cb, chatId, data);
    }
    
    // View apartment details
    else if (data.startsWith('admin_apartment_detail_')) {
      await handleApartmentDetail(bot, cb, chatId, data);
    }
    
    // Add new apartment
    else if (data === 'admin_apartments_add') {
      await handleAddApartment(bot, cb, chatId);
    }
    
    // Delete apartment
    else if (data.startsWith('admin_apartment_delete_')) {
      await handleDeleteApartment(bot, cb, chatId, data);
    }
    
    // Confirm delete apartment
    else if (data.startsWith('admin_apartment_confirm_delete_')) {
      await handleConfirmDeleteApartment(bot, cb, chatId, data);
    }
    
    // Toggle apartment status
    else if (data.startsWith('admin_apartment_toggle_')) {
      await handleToggleApartment(bot, cb, chatId, data);
    }
    
    // Edit apartment
    else if (data.startsWith('admin_apartment_edit_')) {
      await handleEditApartment(bot, cb, chatId, data);
    }
    
    // Manage photos
    else if (data.startsWith('admin_apartment_photos_')) {
      await handleManagePhotos(bot, cb, chatId, data);
    }
    
    // Delete single photo
    else if (data.startsWith('admin_photo_delete_')) {
      await handleDeletePhoto(bot, cb, chatId, data);
    }
    
    // Add photos mode
    else if (data.startsWith('admin_photo_add_')) {
      await handleAddPhotos(bot, cb, chatId, data);
    }
    
    // Delete all photos
    else if (data.startsWith('admin_photo_deleteall_')) {
      await handleDeleteAllPhotos(bot, cb, chatId, data);
    }
    
    // Confirm delete all photos
    else if (data.startsWith('admin_photo_confirm_deleteall_')) {
      await handleConfirmDeleteAllPhotos(bot, cb, chatId, data);
    }
  }
};

// ==================== HANDLER FUNCTIONS ====================

async function handleViewLocations(bot, cb, chatId) {
  try {
    const locations = await executeQuery('SELECT DISTINCT location FROM apartments ORDER BY location');
    
    if (!locations || locations.length === 0) {
      const keyboard = {
        inline_keyboard: [
          [{ text: '➕ Add First Apartment', callback_data: 'admin_apartments_add' }],
          [{ text: '« Back', callback_data: 'admin_menu_apartments' }]
        ]
      };
      return bot.sendMessage(chatId, '🏠 No apartments found. Add your first apartment!', { 
        reply_markup: keyboard 
      });
    }
    
    let message = '📍 *Select Location*\n\nChoose a location to view apartments:';
    
    const locationButtons = [];
    for (let i = 0; i < locations.length; i += 2) {
      const row = [];
      row.push({ text: `📍 ${locations[i].location}`, callback_data: `admin_apartments_location_${locations[i].location}` });
      if (i + 1 < locations.length) {
        row.push({ text: `📍 ${locations[i+1].location}`, callback_data: `admin_apartments_location_${locations[i+1].location}` });
      }
      locationButtons.push(row);
    }
    
    locationButtons.push([{ text: '« Back to Apartments Menu', callback_data: 'admin_menu_apartments' }]);
    
    const keyboard = {
      inline_keyboard: locationButtons
    };
    
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    });
    
  } catch (error) {
    logger.error('Error fetching locations:', error);
    bot.sendMessage(chatId, '❌ Error loading locations.');
  }
}

async function handleApartmentsByLocation(bot, cb, chatId, data) {
  const location = data.replace('admin_apartments_location_', '');
  
  try {
    const apartments = await executeQuery(
      'SELECT id, name FROM apartments WHERE location = ? ORDER BY name',
      [location]
    );
    
    if (!apartments || apartments.length === 0) {
      const keyboard = {
        inline_keyboard: [
          [{ text: '« Back to Locations', callback_data: 'admin_apartments_all' }]
        ]
      };
      return bot.sendMessage(chatId, `🏠 No apartments found in ${location}.`, { 
        reply_markup: keyboard 
      });
    }
    
    let message = `📍 *${location}*\n\nSelect an apartment:`;
    
    const aptButtons = [];
    for (let i = 0; i < apartments.length; i += 2) {
      const row = [];
      row.push({ text: `🏠 ${apartments[i].name}`, callback_data: `admin_apartment_detail_${apartments[i].id}` });
      if (i + 1 < apartments.length) {
        row.push({ text: `🏠 ${apartments[i+1].name}`, callback_data: `admin_apartment_detail_${apartments[i+1].id}` });
      }
      aptButtons.push(row);
    }
    
    aptButtons.push([{ text: '« Back to Locations', callback_data: 'admin_apartments_all' }]);
    
    const keyboard = {
      inline_keyboard: aptButtons
    };
    
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    });
    
  } catch (error) {
    logger.error('Error fetching apartments by location:', error);
    bot.sendMessage(chatId, '❌ Error loading apartments.');
  }
}

async function handleApartmentDetail(bot, cb, chatId, data) {
  const apartmentId = data.replace('admin_apartment_detail_', '');
  
  try {
    const [apt] = await executeQuery(`
      SELECT a.*, 
             (SELECT COUNT(*) FROM bookings WHERE apartment_id = a.id) as total_bookings
      FROM apartments a 
      WHERE a.id = ?
    `, [apartmentId]);
    
    if (!apt) {
      return bot.sendMessage(chatId, '❌ Apartment not found.');
    }
    
    const status = apt.verified ? '✅ Active' : '⏸️ Inactive';
    const photoCount = Apartment.processPhotos(apt).length;
    
    const message = 
      `🏠 *${apt.name}*\n\n` +
      `📍 *Location:* ${apt.location}\n` +
      `📫 *Address:* ${apt.address || 'N/A'}\n` +
      `🏷️ *Type:* ${apt.type}\n` +
      `💰 *Price:* ₦${Number(apt.price).toLocaleString()}/night\n` +
      `🛏️ *Bedrooms:* ${apt.bedrooms}\n` +
      `🚿 *Bathrooms:* ${apt.bathrooms}\n` +
      `📝 *Description:* ${apt.description || 'N/A'}\n` +
      `👤 *Owner ID:* ${apt.owner_id || 'Not assigned'}\n` +
      `📊 *Total Bookings:* ${apt.total_bookings || 0}\n` +
      `📸 *Photos:* ${photoCount}\n` +
      `📌 *Status:* ${status}`;
    
    const keyboard = {
      inline_keyboard: [
        [
          { text: '📝 Edit', callback_data: `admin_apartment_edit_${apt.id}` },
          { text: '🗑️ Delete', callback_data: `admin_apartment_delete_${apt.id}` },
          { text: apt.verified ? '⏸️ Deactivate' : '✅ Activate', callback_data: `admin_apartment_toggle_${apt.id}` }
        ],
        [{ text: '📸 Manage Photos', callback_data: `admin_apartment_photos_${apt.id}` }],
        [{ text: '« Back to Apartments', callback_data: `admin_apartments_location_${apt.location}` }]
      ]
    };
    
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    });
    
  } catch (error) {
    logger.error('Error fetching apartment details:', error);
    bot.sendMessage(chatId, '❌ Error loading apartment details.');
  }
}

async function handleAddApartment(bot, cb, chatId) {
  const message = 
    `🏠 *Add New Apartment*\n\n` +
    `Please send me the apartment details in this format:\n\n` +
    `Name|Location|Address|Type|Price|Bedrooms|Bathrooms|Description|OwnerID\n\n` +
    `Example:\n` +
    `Cozy Studio|Kubwa|No 12 Peace Estate|Studio Apartment|45000|1|1|Fully furnished studio|1\n\n` +
    `After that, you can upload photos.`;
  
  const keyboard = {
    inline_keyboard: [
      [{ text: '« Cancel', callback_data: 'admin_menu_apartments' }]
    ]
  };
  
  await bot.sendMessage(chatId, message, { 
    parse_mode: 'Markdown',
    reply_markup: keyboard 
  });
}

async function handleDeleteApartment(bot, cb, chatId, data) {
  const apartmentId = data.replace('admin_apartment_delete_', '');
  
  const message = `⚠️ *Confirm Delete*\n\nAre you sure you want to delete this apartment?\n\nThis action cannot be undone.`;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Yes, Delete', callback_data: `admin_apartment_confirm_delete_${apartmentId}` },
        { text: '❌ No', callback_data: 'admin_apartments_all' }
      ]
    ]
  };
  
  await bot.sendMessage(chatId, message, { 
    parse_mode: 'Markdown',
    reply_markup: keyboard 
  });
}

async function handleConfirmDeleteApartment(bot, cb, chatId, data) {
  const apartmentId = data.replace('admin_apartment_confirm_delete_', '');
  
  try {
    await executeQuery("DELETE FROM apartments WHERE id = ?", [apartmentId]);
    
    const message = `🗑️ *Apartment Deleted*\n\nApartment has been permanently deleted.`;
    
    const keyboard = {
      inline_keyboard: [
        [{ text: '📋 Back to Apartments', callback_data: 'admin_apartments_all' }],
        [{ text: '« Main Menu', callback_data: 'admin_main_menu' }]
      ]
    };
    
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    });
    
  } catch (error) {
    logger.error('Error deleting apartment:', error);
    bot.sendMessage(chatId, '❌ Error deleting apartment.');
  }
}

async function handleToggleApartment(bot, cb, chatId, data) {
  const apartmentId = data.replace('admin_apartment_toggle_', '');
  
  try {
    const [apt] = await executeQuery("SELECT verified FROM apartments WHERE id = ?", [apartmentId]);
    
    const newStatus = apt.verified ? 0 : 1;
    await executeQuery("UPDATE apartments SET verified = ? WHERE id = ?", [newStatus, apartmentId]);
    
    const statusText = newStatus ? '✅ Activated' : '⏸️ Deactivated';
    
    const message = `${statusText}\n\nApartment status has been updated.`;
    
    const keyboard = {
      inline_keyboard: [
        [{ text: '📋 Back to Apartments', callback_data: 'admin_apartments_all' }]
      ]
    };
    
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    });
    
  } catch (error) {
    logger.error('Error toggling apartment:', error);
    bot.sendMessage(chatId, '❌ Error updating apartment status.');
  }
}

async function handleEditApartment(bot, cb, chatId, data) {
  const apartmentId = data.replace('admin_apartment_edit_', '');
  
  try {
    const [apt] = await executeQuery('SELECT * FROM apartments WHERE id = ?', [apartmentId]);
    
    if (!apt) {
      return bot.sendMessage(chatId, '❌ Apartment not found.');
    }
    
    const message = 
      `✏️ *Edit Apartment*\n\n` +
      `Current details:\n` +
      `Name: ${apt.name}\n` +
      `Location: ${apt.location}\n` +
      `Address: ${apt.address}\n` +
      `Type: ${apt.type}\n` +
      `Price: ₦${apt.price}\n` +
      `Bedrooms: ${apt.bedrooms}\n` +
      `Bathrooms: ${apt.bathrooms}\n` +
      `Description: ${apt.description}\n` +
      `Owner ID: ${apt.owner_id}\n\n` +
      `Please send the updated details in this format:\n\n` +
      `Name|Location|Address|Type|Price|Bedrooms|Bathrooms|Description|OwnerID\n\n` +
      `Or send /cancel to cancel.`;
    
    const keyboard = {
      inline_keyboard: [
        [{ text: '« Cancel', callback_data: `admin_apartment_detail_${apartmentId}` }]
      ]
    };
    
    await bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_markup: keyboard 
    });
    
    const redis = getRedis();
    await redis.setex(`editing_apartment:${chatId}`, 3600, apartmentId);
    
  } catch (error) {
    logger.error('Error loading apartment for edit:', error);
    bot.sendMessage(chatId, '❌ Error loading apartment details.');
  }
}

async function handleManagePhotos(bot, cb, chatId, data) {
  const apartmentId = data.replace('admin_apartment_photos_', '');
  
  try {
    const [apt] = await executeQuery('SELECT * FROM apartments WHERE id = ?', [apartmentId]);
    
    if (!apt) {
      return bot.sendMessage(chatId, '❌ Apartment not found.');
    }
    
    const photoPaths = Apartment.processPhotos(apt);
    
    if (photoPaths.length > 0) {
      await bot.sendMessage(chatId, `📸 *${apt.name} - Photos*\n\nTotal: ${photoPaths.length}`, {
        parse_mode: 'Markdown'
      });
      
      for (let i = 0; i < photoPaths.length; i++) {
        const photo = photoPaths[i];
        const fullPath = getUploadPath(photo);
        
        if (fullPath && fs.existsSync(fullPath)) {
          const keyboard = {
            inline_keyboard: [
              [{ text: `🗑️ Delete Photo ${i+1}`, callback_data: `admin_photo_delete_${apartmentId}_${i}` }]
            ]
          };
          
          await bot.sendPhoto(chatId, fullPath, {
            caption: `Photo ${i+1}`,
            reply_markup: keyboard
          });
        }
      }
    } else {
      await bot.sendMessage(chatId, '📸 No photos yet. Send photos to add them.');
    }
    
    const actionKeyboard = {
      inline_keyboard: [
        [{ text: '➕ Add More Photos', callback_data: `admin_photo_add_${apartmentId}` }],
        [{ text: '🗑️ Delete All Photos', callback_data: `admin_photo_deleteall_${apartmentId}` }],
        [{ text: '« Back to Apartment', callback_data: `admin_apartment_detail_${apartmentId}` }]
      ]
    };
    
    await bot.sendMessage(chatId, '📸 *Photo Actions*', {
      parse_mode: 'Markdown',
      reply_markup: actionKeyboard
    });
    
    const redis = getRedis();
    await redis.setex(`managing_photos:${chatId}`, 3600, apartmentId);
    
  } catch (error) {
    logger.error('Error loading photos:', error);
    bot.sendMessage(chatId, '❌ Error loading photos.');
  }
}

async function handleDeletePhoto(bot, cb, chatId, data) {
  const parts = data.split('_');
  const apartmentId = parts[3];
  const photoIndex = parseInt(parts[4]);
  
  try {
    const [apt] = await executeQuery('SELECT * FROM apartments WHERE id = ?', [apartmentId]);
    
    if (!apt) {
      return bot.sendMessage(chatId, '❌ Apartment not found.');
    }
    
    let photoPaths = Apartment.processPhotos(apt);
    
    if (photoIndex >= 0 && photoIndex < photoPaths.length) {
      photoPaths.splice(photoIndex, 1);
      
      const photoPathsJson = JSON.stringify(photoPaths);
      await executeQuery('UPDATE apartments SET photo_paths = ? WHERE id = ?', [photoPathsJson, apartmentId]);
      
      await bot.sendMessage(chatId, '✅ Photo deleted successfully!');
    }
    
    bot.emit('callback_query', { 
      ...cb, 
      data: `admin_apartment_photos_${apartmentId}` 
    });
    
  } catch (error) {
    logger.error('Error deleting photo:', error);
    bot.sendMessage(chatId, '❌ Error deleting photo.');
  }
}

async function handleAddPhotos(bot, cb, chatId, data) {
  const apartmentId = data.replace('admin_photo_add_', '');
  
  await bot.sendMessage(chatId, 
    `📸 *Add Photos*\n\n` +
    `Send me the photos you want to add.\n` +
    `You can send multiple photos one by one.\n\n` +
    `Send /done when finished.`,
    { parse_mode: 'Markdown' }
  );
  
  const redis = getRedis();
  await redis.setex(`adding_photos:${chatId}`, 3600, apartmentId);
}

async function handleDeleteAllPhotos(bot, cb, chatId, data) {
  const apartmentId = data.replace('admin_photo_deleteall_', '');
  
  const message = `⚠️ *Confirm*\n\nAre you sure you want to delete ALL photos?`;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Yes, Delete All', callback_data: `admin_photo_confirm_deleteall_${apartmentId}` },
        { text: '❌ No', callback_data: `admin_apartment_photos_${apartmentId}` }
      ]
    ]
  };
  
  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

async function handleConfirmDeleteAllPhotos(bot, cb, chatId, data) {
  const apartmentId = data.replace('admin_photo_confirm_deleteall_', '');
  
  try {
    await executeQuery('UPDATE apartments SET photo_paths = ? WHERE id = ?', [JSON.stringify([]), apartmentId]);
    
    await bot.sendMessage(chatId, '✅ All photos deleted successfully!');
    
    bot.emit('callback_query', { 
      ...cb, 
      data: `admin_apartment_photos_${apartmentId}` 
    });
    
  } catch (error) {
    logger.error('Error deleting all photos:', error);
    bot.sendMessage(chatId, '❌ Error deleting photos.');
  }
}

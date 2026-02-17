const Booking = require('../../models/Booking');
const Commission = require('../../models/Commission');
const { isAdmin } = require('../../middleware/auth');
const logger = require('../../middleware/logger');
const Apartment = require('../../models/Apartment');
const { getRedis } = require('../../config/redis');
const fs = require('fs');
const { getUploadPath } = require('../../config/uploads');

module.exports = (bot) => {
  bot.on('callback_query', async (cb) => {
    const chatId = cb.message.chat.id;
    const data = cb.data;
    const messageId = cb.message.message_id;
    
    // ONLY handle admin-specific callbacks
    if (data.startsWith('admin_')) {
      
      // Check authorization
      if (!isAdmin(chatId)) {
        await bot.answerCallbackQuery(cb.id, { text: 'Unauthorized' });
        return bot.sendMessage(chatId, '❌ You are not authorized.');
      }
      
      // Handle main menu buttons
      if (data === 'admin_menu_bookings') {
        await bot.answerCallbackQuery(cb.id, { text: 'Opening Bookings...' });
        
        const message = '📋 *Bookings Management*\n\nSelect an option:';
        
        const keyboard = {
          inline_keyboard: [
            [{ text: '📅 All Bookings', callback_data: 'admin_bookings_all' }],
            [{ text: '⏳ Pending Verification', callback_data: 'admin_bookings_pending' }],
            [{ text: '✅ Verified', callback_data: 'admin_bookings_verified' }],
            [{ text: '💰 Commission Due', callback_data: 'admin_bookings_commission_due' }],
            [{ text: '💵 Paid Commissions', callback_data: 'admin_bookings_commission_paid' }],
            [{ text: '🔍 Search Booking', callback_data: 'admin_bookings_search' }],
            [{ text: '« Back to Admin', callback_data: 'admin_main_menu' }]
          ]
        };
        
        await bot.sendMessage(chatId, message, { 
          parse_mode: 'Markdown',
          reply_markup: keyboard 
        });
      }
      
      else if (data === 'admin_menu_apartments') {
        await bot.answerCallbackQuery(cb.id, { text: 'Opening Apartments...' });
        
        const message = '🏠 *Apartments Management*\n\nSelect an option:';
        
        const keyboard = {
          inline_keyboard: [
            [{ text: '📍 View by Location', callback_data: 'admin_apartments_all' }],
            [{ text: '➕ Add New Apartment', callback_data: 'admin_apartments_add' }],
            [{ text: '« Back to Admin', callback_data: 'admin_main_menu' }]
          ]
        };
        
        await bot.sendMessage(chatId, message, { 
          parse_mode: 'Markdown',
          reply_markup: keyboard 
        });
      }
      
      else if (data === 'admin_menu_owners') {
        await bot.answerCallbackQuery(cb.id, { text: 'Opening Owners...' });
        // Add owners functionality here
        bot.sendMessage(chatId, '👥 *Owners Menu*\n\nComing soon...', { parse_mode: 'Markdown' });
      }
      
      else if (data === 'admin_menu_reports') {
        await bot.answerCallbackQuery(cb.id, { text: 'Opening Reports...' });
        // Add reports functionality here
        bot.sendMessage(chatId, '📊 *Reports Menu*\n\nComing soon...', { parse_mode: 'Markdown' });
      }
      
      else if (data === 'admin_menu_settings') {
        await bot.answerCallbackQuery(cb.id, { text: 'Opening Settings...' });
        // Add settings functionality here
        bot.sendMessage(chatId, '⚙️ *Settings Menu*\n\nComing soon...', { parse_mode: 'Markdown' });
      }
      
      // Bookings submenu handlers
      else if (data === 'admin_bookings_all') {
        await bot.answerCallbackQuery(cb.id, { text: 'Fetching all bookings...' });
        
        try {
          const { executeQuery } = require('../../config/database');
          const bookings = await executeQuery('SELECT * FROM bookings ORDER BY id DESC LIMIT 10');
          
          if (!bookings || bookings.length === 0) {
            return bot.sendMessage(chatId, '📭 No bookings found.');
          }
          
          // Send each booking as a separate message
          for (const booking of bookings) {
            // Format dates properly
            const startDate = new Date(booking.start_date).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });
            
            const endDate = new Date(booking.end_date).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });
            
            const message = 
              `📋 *Booking ${booking.booking_code}*\n` +
              `👤 Guest: ${booking.user_name || 'N/A'}\n` +
              `📅 Dates: ${startDate} to ${endDate}\n` +
              `💰 Amount: ₦${Number(booking.amount).toLocaleString()}\n` +
              `📊 Status: ${booking.status || 'Pending'}`;
            
            const keyboard = {
              inline_keyboard: [
                [{ text: `🗑️ Delete Booking`, callback_data: `admin_delete_${booking.booking_code}` }]
              ]
            };
            
            await bot.sendMessage(chatId, message, { 
              parse_mode: 'Markdown',
              reply_markup: keyboard 
            });
          }
          
          // Send back button
          const backKeyboard = {
            inline_keyboard: [
              [{ text: '« Back to Bookings Menu', callback_data: 'admin_menu_bookings' }]
            ]
          };
          
          await bot.sendMessage(chatId, '------------------\nSelect an option:', { 
            reply_markup: backKeyboard 
          });
          
        } catch (error) {
          logger.error('Error fetching bookings:', error);
          bot.sendMessage(chatId, '❌ Error fetching bookings.');
        }
      }
      
      else if (data === 'admin_bookings_pending') {
        await bot.answerCallbackQuery(cb.id, { text: 'Fetching pending verifications...' });
        
        try {
          const { executeQuery } = require('../../config/database');
          
          const pendingBookings = await executeQuery(
            "SELECT * FROM bookings WHERE status = 'pending' ORDER BY id DESC LIMIT 10"
          );
          
          if (!pendingBookings || pendingBookings.length === 0) {
            const keyboard = {
              inline_keyboard: [
                [{ text: '« Back to Bookings', callback_data: 'admin_menu_bookings' }]
              ]
            };
            return bot.sendMessage(chatId, '✅ No pending verifications found.', { 
              reply_markup: keyboard 
            });
          }
          
          let message = '⏳ *Pending Verifications*\n\n';
          
          pendingBookings.forEach((booking, index) => {
            message += `${index+1}. *Booking ${booking.booking_code}*\n`;
            message += `   👤 Guest: ${booking.user_name || 'N/A'}\n`;
            message += `   📅 Dates: ${booking.start_date} to ${booking.end_date}\n`;
            message += `   💰 Amount: ₦${booking.amount || 0}\n`;
            message += `   🔑 Code: \`${booking.booking_code}\`\n\n`;
          });
          
          message += 'Select a booking to verify payment:';
          
          const buttons = pendingBookings.map(booking => {
            return [{ text: `✅ Verify: ${booking.booking_code}`, callback_data: `admin_verify_${booking.booking_code}` }];
          });
          
          buttons.push([{ text: '« Back to Bookings', callback_data: 'admin_menu_bookings' }]);
          
          const keyboard = {
            inline_keyboard: buttons
          };
          
          await bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            reply_markup: keyboard 
          });
          
        } catch (error) {
          logger.error('Error fetching pending bookings:', error);
          bot.sendMessage(chatId, '❌ Error fetching pending verifications.');
        }
      }

      else if (data === 'admin_bookings_verified') {
        await bot.answerCallbackQuery(cb.id, { text: 'Fetching verified bookings...' });
        bot.sendMessage(chatId, '✅ *Verified Bookings*\n\nComing soon...', { parse_mode: 'Markdown' });
      }

      else if (data === 'admin_bookings_commission_due') {
        await bot.answerCallbackQuery(cb.id, { text: 'Fetching commissions due...' });
        bot.sendMessage(chatId, '💰 *Commissions Due*\n\nComing soon...', { parse_mode: 'Markdown' });
      }

      else if (data === 'admin_bookings_commission_paid') {
        await bot.answerCallbackQuery(cb.id, { text: 'Fetching paid commissions...' });
        bot.sendMessage(chatId, '💵 *Paid Commissions*\n\nComing soon...', { parse_mode: 'Markdown' });
      }

      else if (data === 'admin_bookings_search') {
        await bot.answerCallbackQuery(cb.id, { text: 'Search feature...' });
        bot.sendMessage(chatId, '🔍 *Search Booking*\n\nPlease enter booking code or guest name:', { parse_mode: 'Markdown' });
      }
      
      else if (data.startsWith('admin_verify_')) {
        await bot.answerCallbackQuery(cb.id, { text: 'Opening verification...' });
        
        const bookingCode = data.replace('admin_verify_', '');
        
        try {
          const { executeQuery } = require('../../config/database');
          const [booking] = await executeQuery("SELECT * FROM bookings WHERE booking_code = ?", [bookingCode]);
          
          if (!booking) {
            return bot.sendMessage(chatId, '❌ Booking not found.');
          }
          
          const message = 
            `✅ *Verify Payment*\n\n` +
            `*Booking Code:* ${booking.booking_code}\n` +
            `*Guest:* ${booking.user_name}\n` +
            `*Amount Paid to Owner:* ₦${booking.amount || 0}\n` +
            `*Your Commission (10%):* ₦${booking.amount ? booking.amount * 0.1 : 0}\n\n` +
            `Has the guest confirmed they paid the owner?`;
          
          const keyboard = {
            inline_keyboard: [
              [
                { text: '✅ Yes, Mark Verified', callback_data: `admin_confirm_verify_${bookingCode}` },
                { text: '❌ No', callback_data: 'admin_bookings_pending' }
              ],
              [{ text: '« Back', callback_data: 'admin_bookings_pending' }]
            ]
          };
          
          await bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            reply_markup: keyboard 
          });
          
        } catch (error) {
          logger.error('Error in verify booking:', error);
          bot.sendMessage(chatId, '❌ Error opening verification.');
        }
      }

      else if (data.startsWith('admin_confirm_verify_')) {
        await bot.answerCallbackQuery(cb.id, { text: 'Verifying...' });
        
        const bookingCode = data.replace('admin_confirm_verify_', '');
        
        try {
          const { executeQuery } = require('../../config/database');
          
          await executeQuery(
            "UPDATE bookings SET status = 'verified', verified_at = NOW(), verified_by = ? WHERE booking_code = ?",
            [chatId, bookingCode]
          );
          
          const [booking] = await executeQuery("SELECT * FROM bookings WHERE booking_code = ?", [bookingCode]);
          
          const message = 
            `✅ *Payment Verified Successfully!*\n\n` +
            `Booking *${bookingCode}* has been marked as verified.\n` +
            `Amount: ₦${booking.amount}\n` +
            `Commission (10%): ₦${booking.amount * 0.1}\n\n` +
            `Commission is now due from the owner.`;
          
          const keyboard = {
            inline_keyboard: [
              [{ text: '📋 Back to Pending', callback_data: 'admin_bookings_pending' }],
              [{ text: '💰 Commission Due', callback_data: 'admin_bookings_commission_due' }],
              [{ text: '« Main Menu', callback_data: 'admin_main_menu' }]
            ]
          };
          
          await bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            reply_markup: keyboard 
          });
          
        } catch (error) {
          logger.error('Error confirming verification:', error);
          bot.sendMessage(chatId, '❌ Error verifying booking.');
        }
      }
      
      else if (data.startsWith('admin_delete_')) {
        await bot.answerCallbackQuery(cb.id, { text: 'Preparing delete...' });
        
        const bookingCode = data.replace('admin_delete_', '');
        
        const message = `⚠️ *Confirm Delete*\n\nAre you sure you want to delete booking *${bookingCode}*?\n\nThis action cannot be undone.`;
        
        const keyboard = {
          inline_keyboard: [
            [
              { text: '✅ Yes, Delete', callback_data: `admin_confirm_delete_${bookingCode}` },
              { text: '❌ No', callback_data: 'admin_bookings_all' }
            ]
          ]
        };
        
        await bot.sendMessage(chatId, message, { 
          parse_mode: 'Markdown',
          reply_markup: keyboard 
        });
      }

      else if (data.startsWith('admin_confirm_delete_')) {
        await bot.answerCallbackQuery(cb.id, { text: 'Deleting...' });
        
        const bookingCode = data.replace('admin_confirm_delete_', '');
        
        try {
          const { executeQuery } = require('../../config/database');
          
          await executeQuery("DELETE FROM bookings WHERE booking_code = ?", [bookingCode]);
          
          const message = `🗑️ *Booking Deleted*\n\nBooking *${bookingCode}* has been permanently deleted.`;
          
          const keyboard = {
            inline_keyboard: [
              [{ text: '📋 Back to Bookings', callback_data: 'admin_bookings_all' }],
              [{ text: '« Main Menu', callback_data: 'admin_main_menu' }]
            ]
          };
          
          await bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            reply_markup: keyboard 
          });
          
        } catch (error) {
          logger.error('Error deleting booking:', error);
          bot.sendMessage(chatId, '❌ Error deleting booking.');
        }
      }
      
      // Apartments submenu handlers
      else if (data === 'admin_apartments_all') {
        await bot.answerCallbackQuery(cb.id, { text: 'Loading locations...' });
        
        try {
          const { executeQuery } = require('../../config/database');
          
          // Get unique locations
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
          
          // Create location buttons (2 per row)
          const locationButtons = [];
          for (let i = 0; i < locations.length; i += 2) {
            const row = [];
            row.push({ text: `📍 ${locations[i].location}`, callback_data: `admin_apartments_location_${locations[i].location}` });
            if (i + 1 < locations.length) {
              row.push({ text: `📍 ${locations[i+1].location}`, callback_data: `admin_apartments_location_${locations[i+1].location}` });
            }
            locationButtons.push(row);
          }
          
          // Add back button
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
      
      else if (data.startsWith('admin_apartments_location_')) {
        const location = data.replace('admin_apartments_location_', '');
        
        await bot.answerCallbackQuery(cb.id, { text: `Loading apartments in ${location}...` });
        
        try {
          const { executeQuery } = require('../../config/database');
          
          // Get apartments in this location
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
          
          // Create apartment name buttons (2 per row)
          const aptButtons = [];
          for (let i = 0; i < apartments.length; i += 2) {
            const row = [];
            row.push({ text: `🏠 ${apartments[i].name}`, callback_data: `admin_apartment_detail_${apartments[i].id}` });
            if (i + 1 < apartments.length) {
              row.push({ text: `🏠 ${apartments[i+1].name}`, callback_data: `admin_apartment_detail_${apartments[i+1].id}` });
            }
            aptButtons.push(row);
          }
          
          // Add back button
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
      
      else if (data.startsWith('admin_apartment_detail_')) {
        const apartmentId = data.replace('admin_apartment_detail_', '');
        
        await bot.answerCallbackQuery(cb.id, { text: 'Loading apartment details...' });
        
        try {
          const { executeQuery } = require('../../config/database');
          
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
      
      else if (data === 'admin_apartments_add') {
        await bot.answerCallbackQuery(cb.id, { text: 'Starting add process...' });
        
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
      
      else if (data.startsWith('admin_apartment_delete_')) {
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
      
      else if (data.startsWith('admin_apartment_confirm_delete_')) {
        await bot.answerCallbackQuery(cb.id, { text: 'Deleting...' });
        
        const apartmentId = data.replace('admin_apartment_confirm_delete_', '');
        
        try {
          const { executeQuery } = require('../../config/database');
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
      
      else if (data.startsWith('admin_apartment_toggle_')) {
        const apartmentId = data.replace('admin_apartment_toggle_', '');
        
        try {
          const { executeQuery } = require('../../config/database');
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
      
      // Edit apartment - Start edit process
      else if (data.startsWith('admin_apartment_edit_')) {
        const apartmentId = data.replace('admin_apartment_edit_', '');
        
        await bot.answerCallbackQuery(cb.id, { text: 'Loading edit form...' });
        
        try {
          const { executeQuery } = require('../../config/database');
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
          
          // Store in Redis that we're editing this apartment
          const redis = getRedis();
          await redis.setex(`editing_apartment:${chatId}`, 3600, apartmentId);
          
        } catch (error) {
          logger.error('Error loading apartment for edit:', error);
          bot.sendMessage(chatId, '❌ Error loading apartment details.');
        }
      }
      
      // Manage Photos - Simplified with buttons
      else if (data.startsWith('admin_apartment_photos_')) {
        const apartmentId = data.replace('admin_apartment_photos_', '');
        
        await bot.answerCallbackQuery(cb.id, { text: 'Loading photos...' });
        
        try {
          const { executeQuery } = require('../../config/database');
          const [apt] = await executeQuery('SELECT * FROM apartments WHERE id = ?', [apartmentId]);
          
          if (!apt) {
            return bot.sendMessage(chatId, '❌ Apartment not found.');
          }
          
          const photoPaths = Apartment.processPhotos(apt);
          
          // Send each photo with delete button
          if (photoPaths.length > 0) {
            await bot.sendMessage(chatId, `📸 *${apt.name} - Photos*\n\nTotal: ${photoPaths.length}`, {
              parse_mode: 'Markdown'
            });
            
            // Send each photo with a delete button
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
          
          // Action buttons
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
          
          // Store in Redis that we're managing photos
          const redis = getRedis();
          await redis.setex(`managing_photos:${chatId}`, 3600, apartmentId);
          
        } catch (error) {
          logger.error('Error loading photos:', error);
          bot.sendMessage(chatId, '❌ Error loading photos.');
        }
      }
      
      // Delete single photo
      else if (data.startsWith('admin_photo_delete_')) {
        const parts = data.split('_');
        const apartmentId = parts[3];
        const photoIndex = parseInt(parts[4]);
        
        await bot.answerCallbackQuery(cb.id, { text: 'Deleting photo...' });
        
        try {
          const { executeQuery } = require('../../config/database');
          const [apt] = await executeQuery('SELECT * FROM apartments WHERE id = ?', [apartmentId]);
          
          if (!apt) {
            return bot.sendMessage(chatId, '❌ Apartment not found.');
          }
          
          let photoPaths = Apartment.processPhotos(apt);
          
          if (photoIndex >= 0 && photoIndex < photoPaths.length) {
            // Remove the photo from array
            photoPaths.splice(photoIndex, 1);
            
            // Update database
            const photoPathsJson = JSON.stringify(photoPaths);
            await executeQuery('UPDATE apartments SET photo_paths = ? WHERE id = ?', [photoPathsJson, apartmentId]);
            
            await bot.sendMessage(chatId, '✅ Photo deleted successfully!');
          }
          
          // Show updated photos
          bot.emit('callback_query', { 
            ...cb, 
            data: `admin_apartment_photos_${apartmentId}` 
          });
          
        } catch (error) {
          logger.error('Error deleting photo:', error);
          bot.sendMessage(chatId, '❌ Error deleting photo.');
        }
      }
      
      // Add photos mode
      else if (data.startsWith('admin_photo_add_')) {
        const apartmentId = data.replace('admin_photo_add_', '');
        
        await bot.answerCallbackQuery(cb.id, { text: 'Ready to receive photos...' });
        
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
      
      // Delete all photos
      else if (data.startsWith('admin_photo_deleteall_')) {
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
      
      // Confirm delete all photos
      else if (data.startsWith('admin_photo_confirm_deleteall_')) {
        const apartmentId = data.replace('admin_photo_confirm_deleteall_', '');
        
        await bot.answerCallbackQuery(cb.id, { text: 'Deleting all photos...' });
        
        try {
          const { executeQuery } = require('../../config/database');
          
          // Set photo_paths to empty array
          await executeQuery('UPDATE apartments SET photo_paths = ? WHERE id = ?', [JSON.stringify([]), apartmentId]);
          
          await bot.sendMessage(chatId, '✅ All photos deleted successfully!');
          
          // Go back to photos menu
          bot.emit('callback_query', { 
            ...cb, 
            data: `admin_apartment_photos_${apartmentId}` 
          });
          
        } catch (error) {
          logger.error('Error deleting all photos:', error);
          bot.sendMessage(chatId, '❌ Error deleting photos.');
        }
      }
      
      else if (data === 'admin_main_menu') {
        await bot.answerCallbackQuery(cb.id, { text: 'Returning to admin...' });
        
        const keyboard = {
          inline_keyboard: [
            [
              { text: '📋 Bookings', callback_data: 'admin_menu_bookings' },
              { text: '🏠 Apartments', callback_data: 'admin_menu_apartments' }
            ],
            [
              { text: '👥 Owners', callback_data: 'admin_menu_owners' },
              { text: '📊 Reports', callback_data: 'admin_menu_reports' }
            ],
            [
              { text: '⚙️ Settings', callback_data: 'admin_menu_settings' }
            ]
          ]
        };
        
        await bot.sendMessage(chatId, '🛠 *Admin Control Center*', {
          parse_mode: 'Markdown',
          reply_markup: keyboard
        });
      }
      
      // Admin commission details
      else if (data.startsWith('admin_commission_')) {
        await bot.answerCallbackQuery(cb.id, { text: 'Fetching commission...' });
        
        const bookingCode = data.replace('admin_commission_', '');
        
        try {
          const booking = await Booking.findByCode(bookingCode);
          
          if (!booking) {
            return bot.sendMessage(chatId, '❌ Booking not found');
          }
          
          const commission = booking.amount * 0.1;
          
          const message = 
            `💰 *Commission Details for ${bookingCode}*\n\n` +
            `• Apartment: ${booking.apartment_name}\n` +
            `• Amount: ₦${booking.amount}\n` +
            `• Commission (10%): ₦${commission}\n` +
            `• Owner ID: ${booking.owner_id || 'Not assigned'}\n` +
            `• Status: ${booking.owner_confirmed ? '✅ Owner Confirmed' : '⏳ Pending'}\n\n` +
            `Use /pay_commission [id] when paid`;
          
          await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
          
        } catch (error) {
          logger.error('Error in admin commission callback:', error);
          bot.sendMessage(chatId, '❌ Error fetching commission details.');
        }
      }
      
      // Admin dashboard shortcut
      else if (data === 'admin_dashboard') {
        await bot.answerCallbackQuery(cb.id, { text: 'Opening dashboard...' });
        bot.sendMessage(chatId, '/dashboard');
      }
      
    }
    // Otherwise, do NOTHING - let other handlers process it
  });
};

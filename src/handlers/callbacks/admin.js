const Booking = require('../../models/Booking');
const Commission = require('../../models/Commission');
const { isAdmin } = require('../../middleware/auth');
const logger = require('../../middleware/logger');
const Apartment = require('../../models/Apartment');

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
        await bot.answerCallbackQuery(cb.id, { text: 'Fetching apartments...' });
        
        try {
          const { executeQuery } = require('../../config/database');
          const apartments = await executeQuery(`
            SELECT a.*, 
                   (SELECT COUNT(*) FROM bookings WHERE apartment_id = a.id) as total_bookings
            FROM apartments a 
            ORDER BY a.id DESC 
            LIMIT 10
          `);
          
          if (!apartments || apartments.length === 0) {
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
          
          for (const apt of apartments) {
            const status = apt.verified ? '✅ Active' : '⏸️ Inactive';
            const photoCount = Apartment.processPhotos(apt).length;
            
            const message = 
              `🏠 *${apt.name || 'Unnamed Apartment'}*\n` +
              `📍 Location: ${apt.location || 'N/A'}\n` +
              `🏷️ Type: ${apt.type || 'N/A'}\n` +
              `💰 Price: ₦${Number(apt.price).toLocaleString()}/night\n` +
              `👤 Owner ID: ${apt.owner_id || 'Not assigned'}\n` +
              `📊 Bookings: ${apt.total_bookings || 0}\n` +
              `📸 Photos: ${photoCount}\n` +
              `📌 Status: ${status}`;
            
            const keyboard = {
              inline_keyboard: [
                [
                  { text: '📝 Edit', callback_data: `admin_apartment_edit_${apt.id}` },
                  { text: '🗑️ Delete', callback_data: `admin_apartment_delete_${apt.id}` },
                  { text: apt.verified ? '⏸️ Deactivate' : '✅ Activate', callback_data: `admin_apartment_toggle_${apt.id}` }
                ],
                [{ text: '📸 Manage Photos', callback_data: `admin_apartment_photos_${apt.id}` }]
              ]
            };
            
            await bot.sendMessage(chatId, message, { 
              parse_mode: 'Markdown',
              reply_markup: keyboard 
            });
          }
          
          const navKeyboard = {
            inline_keyboard: [
              [{ text: '➕ Add New Apartment', callback_data: 'admin_apartments_add' }],
              [{ text: '« Back to Apartments Menu', callback_data: 'admin_menu_apartments' }]
            ]
          };
          
          await bot.sendMessage(chatId, '------------------\nSelect an option:', { 
            reply_markup: navKeyboard 
          });
          
        } catch (error) {
          logger.error('Error fetching apartments:', error);
          bot.sendMessage(chatId, '❌ Error fetching apartments.');
        }
      }
      
      else if (data === 'admin_apartments_add') {
        await bot.answerCallbackQuery(cb.id, { text: 'Starting add process...' });
        
        const message = 
          `🏠 *Add New Apartment*\n\n` +
          `Please send me the apartment details in this format:\n\n` +
          `Name|Location|Address|Type|Price|Bedrooms|Bathrooms|Description|OwnerID\n\n` +
          `Example:\n` +
          `Cozy Studio|Kubwa|No 12 Peace Estate|Self Contain|45000|1|1|Fully furnished studio|1\n\n` +
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

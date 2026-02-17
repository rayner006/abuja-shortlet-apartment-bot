const { executeQuery } = require('../../../config/database');
const logger = require('../../../middleware/logger');

module.exports = {
  handle: async (bot, cb, chatId, data) => {
    
    // All Bookings
    if (data === 'admin_bookings_all') {
      await handleAllBookings(bot, cb, chatId);
    }
    
    // Pending Verification
    else if (data === 'admin_bookings_pending') {
      await handlePendingBookings(bot, cb, chatId);
    }
    
    // Verify single booking
    else if (data.startsWith('admin_verify_')) {
      await handleVerifyBooking(bot, cb, chatId, data);
    }
    
    // Confirm verification
    else if (data.startsWith('admin_confirm_verify_')) {
      await handleConfirmVerify(bot, cb, chatId, data);
    }
    
    // Delete booking
    else if (data.startsWith('admin_delete_')) {
      await handleDeleteBooking(bot, cb, chatId, data);
    }
    
    // Confirm delete
    else if (data.startsWith('admin_confirm_delete_')) {
      await handleConfirmDelete(bot, cb, chatId, data);
    }
    
    // Verified bookings (placeholder)
    else if (data === 'admin_bookings_verified') {
      await bot.answerCallbackQuery(cb.id, { text: 'Coming soon...' });
      await bot.sendMessage(chatId, '✅ *Verified Bookings*\n\nComing soon...', { parse_mode: 'Markdown' });
    }
    
    // Commission due (placeholder)
    else if (data === 'admin_bookings_commission_due') {
      await bot.answerCallbackQuery(cb.id, { text: 'Coming soon...' });
      await bot.sendMessage(chatId, '💰 *Commissions Due*\n\nComing soon...', { parse_mode: 'Markdown' });
    }
    
    // Paid commissions (placeholder)
    else if (data === 'admin_bookings_commission_paid') {
      await bot.answerCallbackQuery(cb.id, { text: 'Coming soon...' });
      await bot.sendMessage(chatId, '💵 *Paid Commissions*\n\nComing soon...', { parse_mode: 'Markdown' });
    }
    
    // Search booking (placeholder)
    else if (data === 'admin_bookings_search') {
      await bot.answerCallbackQuery(cb.id, { text: 'Coming soon...' });
      await bot.sendMessage(chatId, '🔍 *Search Booking*\n\nComing soon...', { parse_mode: 'Markdown' });
    }
  }
};

// ==================== HANDLER FUNCTIONS ====================

async function handleAllBookings(bot, cb, chatId) {
  await bot.answerCallbackQuery(cb.id, { text: 'Fetching all bookings...' });
  
  try {
    const bookings = await executeQuery('SELECT * FROM bookings ORDER BY id DESC LIMIT 10');
    
    if (!bookings || bookings.length === 0) {
      return bot.sendMessage(chatId, '📭 No bookings found.');
    }
    
    for (const booking of bookings) {
      const startDate = new Date(booking.start_date).toLocaleDateString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
      
      const endDate = new Date(booking.end_date).toLocaleDateString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric'
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

async function handlePendingBookings(bot, cb, chatId) {
  await bot.answerCallbackQuery(cb.id, { text: 'Fetching pending verifications...' });
  
  try {
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

async function handleVerifyBooking(bot, cb, chatId, data) {
  await bot.answerCallbackQuery(cb.id, { text: 'Opening verification...' });
  
  const bookingCode = data.replace('admin_verify_', '');
  
  try {
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

async function handleConfirmVerify(bot, cb, chatId, data) {
  await bot.answerCallbackQuery(cb.id, { text: 'Verifying...' });
  
  const bookingCode = data.replace('admin_confirm_verify_', '');
  
  try {
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

async function handleDeleteBooking(bot, cb, chatId, data) {
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

async function handleConfirmDelete(bot, cb, chatId, data) {
  await bot.answerCallbackQuery(cb.id, { text: 'Deleting...' });
  
  const bookingCode = data.replace('admin_confirm_delete_', '');
  
  try {
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

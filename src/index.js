require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { initDatabase } = require('./models');
const logger = require('./config/logger');
const redis = require('./config/redis');
const { setupCommands } = require('./bot/commands');
const { setupAdminCommands } = require('./bot/adminCommands');
const { handleCallback } = require('./bot/callbacks');
const { handleMessage } = require('./bot/conversations');

// ✅ 1. FIRST initialize the bot
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: false
});

// ✅ 2. THEN import and create AdminController with the bot
const AdminController = require('./controllers/admin');
const adminController = new AdminController(bot);

const app = express();
app.use(express.json());

app.set('bot', bot);

// Initialize database
initDatabase().catch(err => {
  logger.error('Database initialization failed:', err);
  process.exit(1);
});

// Setup bot commands - PASS the adminController
setupCommands(bot);
setupAdminCommands(bot, adminController);

// --- START BOT SAFELY ---
(async () => {
  try {
    // Stop any previous polling just in case
    await bot.stopPolling().catch(() => {});

    // Delete webhook before polling
    await bot.deleteWebHook();
    logger.info('Webhook deleted successfully');

    // Start polling manually
    await bot.startPolling({
      interval: 300,
      params: { timeout: 10 }
    });

    logger.info('Bot polling started');
  } catch (error) {
    logger.error('Bot startup error:', error.message);
  }
})();

// Bot error handling
bot.on('polling_error', (error) => {
  logger.error('Polling error:', error.message);
});

bot.on('webhook_error', (error) => {
  logger.error('Webhook error:', error.message);
});

bot.on('error', (error) => {
  logger.error('Bot error:', error.message);
});

// Message handler
bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    console.log(`\n📨 [DEBUG] Message received from chat ${chatId}:`, msg.text ? `"${msg.text}"` : '📸 Photo');
    
    // ============================================
    // STEP 1: Check if user is in apartment addition flow
    // ============================================
    if (global.apartmentStates && global.apartmentStates[chatId]) {
      const state = global.apartmentStates[chatId];
      console.log(`🏠 [DEBUG] User in apartment flow. Current step: "${state.step}"`);
      console.log(`📊 [DEBUG] State data:`, JSON.stringify(state.data, null, 2));
      
      // ============================================
      // HANDLE PHOTOS
      // ============================================
      if (msg.photo && state.step === 'photos') {
        console.log('📸 [DEBUG] Processing photo for apartment addition');
        
        // Get the largest photo (best quality)
        const photo = msg.photo[msg.photo.length - 1];
        const fileId = photo.file_id;
        
        // Add to images array
        if (!state.data.images) state.data.images = [];
        state.data.images.push(fileId);
        
        // Save state back to global
        global.apartmentStates[chatId] = state;
        
        await bot.sendMessage(chatId, 
          `✅ Photo received! (${state.data.images.length} so far)\n\n` +
          `Send more photos or type *done* to finish.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      // ============================================
      // HANDLE "DONE" COMMAND DURING PHOTO UPLOAD
      // ============================================
      if (msg.text && msg.text.toLowerCase() === 'done' && state.step === 'photos') {
        console.log('✅ [DEBUG] "done" received during photo upload');
        
        if (!state.data.images || state.data.images.length === 0) {
          await bot.sendMessage(chatId, '❌ Please send at least one photo first.');
          return;
        }
        
        // Move to description step
        state.step = 'description';
        global.apartmentStates[chatId] = state;
        
        console.log('✅ [DEBUG] State updated to step: "description"');
        
        await bot.sendMessage(chatId, 
          '✅ Photos saved!\n\n' +
          'Please send a *description* for this apartment:',
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      // ============================================
      // HANDLE NON-PHOTO STEPS (description, amenities, etc.)
      // ============================================
      if (state.step !== 'photos') {
        console.log(`📝 [DEBUG] Passing to adminController for step: "${state.step}"`);
        
        // Pass to admin controller and wait for response
        const handled = await adminController.apartments.handleAddApartmentMessage(chatId, msg.text);
        
        if (handled) {
          console.log('✅ [DEBUG] adminController handled the message');
          
          // Get updated state after handling
          const updatedState = global.apartmentStates[chatId];
          if (updatedState) {
            console.log(`🔄 [DEBUG] New step after handling: "${updatedState.step}"`);
          } else {
            console.log('✅ [DEBUG] Apartment addition flow completed (state cleared)');
          }
          return;
        } else {
          console.log('⚠️ [DEBUG] adminController did NOT handle the message');
        }
      }
    }
    
    // ============================================
    // STEP 2: Check if message is a command
    // ============================================
    if (msg.text && msg.text.startsWith('/')) {
      console.log('📟 [DEBUG] Command detected, skipping regular handlers');
      return;
    }
    
    // ============================================
    // STEP 3: Check for edit states
    // ============================================
    if (global.editStates && global.editStates[chatId]) {
      const state = global.editStates[chatId];
      console.log(`✏️ [DEBUG] User in edit flow. Action: "${state.action}"`);
      
      if (state.action === 'editing_user') {
        // Handle user field editing
        const { User } = require('./models');
        const user = await User.findByPk(state.userId);
        
        if (user) {
          // Update the field
          user[state.field] = msg.text;
          await user.save();
          
          delete global.editStates[chatId];
          
          await bot.sendMessage(chatId, 
            `✅ ${state.field} updated successfully!`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '« Back to User', callback_data: `manage_${state.userId}` }]
                ]
              }
            }
          );
          return;
        }
      } else if (state.action === 'sending_message') {
        // Handle sending message to user
        await bot.sendMessage(state.targetTelegramId, 
          `📨 *Message from Admin:*\n\n${msg.text}`,
          { parse_mode: 'Markdown' }
        );
        
        delete global.editStates[chatId];
        
        await bot.sendMessage(chatId, 
          '✅ Message sent successfully!',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '« Back to User', callback_data: `manage_${state.targetUserId}` }]
              ]
            }
          }
        );
        return;
      } else if (state.action === 'sending_message_to_owner') {
        // Handle sending message to apartment owner
        await bot.sendMessage(state.targetTelegramId,
          `📨 *Message from Admin regarding your apartment listing:*\n\n${msg.text}`,
          { parse_mode: 'Markdown' }
        );
        
        delete global.editStates[chatId];
        
        await bot.sendMessage(chatId,
          '✅ Message sent to owner successfully!',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '« Back to Pending', callback_data: state.returnTo || 'admin_pending_1' }]
              ]
            }
          }
        );
        return;
      }
    }
    
    // ============================================
    // STEP 4: Regular message handling (conversations)
    // ============================================
    console.log('💬 [DEBUG] Passing to regular conversation handler');
    await handleMessage(bot, msg);
    
  } catch (error) {
    logger.error('Message handler error:', error);
    console.error('❌ [DEBUG] Error in message handler:', error);
  }
});

// Callback query handler
bot.on('callback_query', async (callbackQuery) => {
  try {
    const data = callbackQuery.data;
    const chatId = callbackQuery.message.chat.id;
    
    console.log(`\n🔄 [DEBUG] Callback received: "${data}" from chat ${chatId}`);
    
    // Route ALL admin callbacks to the new admin controller
    if (data.startsWith('admin_') || 
        data.startsWith('user_') || 
        data.startsWith('manage_') || 
        data.startsWith('approve_') ||
        data.startsWith('reject_') || 
        data.startsWith('edit_') ||
        data.startsWith('set_role_') || 
        data.startsWith('confirm_delete_') ||
        data.startsWith('apt_') ||                
        data.startsWith('confirm_delete_apt_') || 
        data.startsWith('filter_') ||             
        data.startsWith('sort_') ||               
        data === 'menu_admin' || 
        data === 'admin_back' ||
        data === 'admin_add_apartment') {
      
      console.log('👑 [DEBUG] Routing to admin controller');
      await adminController.handleCallback(callbackQuery);
    }
    // Route non-admin callbacks to original handler
    else {
      console.log('👤 [DEBUG] Routing to user callback handler');
      await handleCallback(bot, callbackQuery);
    }
    
  } catch (error) {
    logger.error('Callback handler error:', error);
    console.error('❌ [DEBUG] Callback handler error:', error);
    bot.answerCallbackQuery(callbackQuery.id, {
      text: 'An error occurred. Please try again.'
    }).catch(() => {});
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
    bot: 'running'
  });
});

// Start server
const PORT = process.env.PORT || 8888;
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info('Bot server ready...');
});

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down gracefully...');
  try {
    await bot.stopPolling().catch(() => {});
    if (redis) await redis.quit().catch(() => {});
  } catch (e) {
    logger.error('Shutdown error:', e);
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  console.error('❌ [DEBUG] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('❌ [DEBUG] Unhandled Rejection:', reason);
});

module.exports = { bot, app, server };

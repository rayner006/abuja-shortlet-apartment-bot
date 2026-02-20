require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { initDatabase } = require('./models');
const logger = require('./config/logger');
const redis = require('./config/redis');  // This already imports Redis!
const { setupCommands } = require('./bot/commands');
const { setupAdminCommands } = require('./bot/adminCommands');
const { handleCallback } = require('./bot/callbacks');
const { handleMessage } = require('./bot/conversations');

// ✅ 1. FIRST initialize the bot
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: false
});

// ✅ 2. THEN import and create AdminController with the bot AND redis
const AdminController = require('./controllers/admin');
const adminController = new AdminController(bot, redis);  // 👈 PASS REDIS HERE!

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

// Admin panel command - WITH STATE CLEARING FIX
bot.onText(/\/admin/, async (msg) => {
  try {
    const chatId = msg.chat.id;
    
    // 🧹 FIX: Clear any existing apartment state before showing admin panel
    // For the new wizard, we'll use Redis instead of global
    try {
      await redis.del(`apt_wizard:${chatId}`);
      console.log('🧹 Cleared Redis wizard state');
    } catch (e) {}
    
    if (global.apartmentStates && global.apartmentStates[chatId]) {
      console.log('🧹 Clearing old apartment state before showing admin panel');
      delete global.apartmentStates[chatId];
    }
    
    // Check if user is admin
    const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id)) : [];
    if (!adminIds.includes(msg.from.id)) {
      await bot.sendMessage(msg.chat.id, '⛔ This command is for admins only.');
      return;
    }
    
    // Show admin panel
    await adminController.showAdminPanel(msg.chat.id, msg);
    
  } catch (error) {
    logger.error('Admin command error:', error);
    bot.sendMessage(msg.chat.id, 'Error accessing admin panel.');
  }
});

// Quick stats command
bot.onText(/\/stats/, async (msg) => {
  try {
    // Check if user is admin
    const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id)) : [];
    if (!adminIds.includes(msg.from.id)) {
      await bot.sendMessage(msg.chat.id, '⛔ This command is for admins only.');
      return;
    }
    
    // Create a mock callback query for the stats
    const mockCallback = {
      id: 'stats',
      message: msg,
      from: msg.from,
      data: 'admin_stats'
    };
    
    await adminController.handleCallback(mockCallback);
  } catch (error) {
    logger.error('Stats command error:', error);
    bot.sendMessage(msg.chat.id, 'Error loading stats.');
  }
});

// Quick pending approvals
bot.onText(/\/pending/, async (msg) => {
  try {
    // Check if user is admin
    const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id)) : [];
    if (!adminIds.includes(msg.from.id)) {
      await bot.sendMessage(msg.chat.id, '⛔ This command is for admins only.');
      return;
    }
    
    // Create a mock callback query for pending approvals
    const mockCallback = {
      id: 'pending',
      message: msg,
      from: msg.from,
      data: 'admin_pending_1'
    };
    
    await adminController.handleCallback(mockCallback);
  } catch (error) {
    logger.error('Pending command error:', error);
    bot.sendMessage(msg.chat.id, 'Error loading pending approvals.');
  }
});

// Quick users list
bot.onText(/\/users/, async (msg) => {
  try {
    // Check if user is admin
    const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id)) : [];
    if (!adminIds.includes(msg.from.id)) {
      await bot.sendMessage(msg.chat.id, '⛔ This command is for admins only.');
      return;
    }
    
    // Create a mock callback query for users list
    const mockCallback = {
      id: 'users',
      message: msg,
      from: msg.from,
      data: 'admin_users_1'
    };
    
    await adminController.handleCallback(mockCallback);
  } catch (error) {
    logger.error('Users command error:', error);
    bot.sendMessage(msg.chat.id, 'Error loading users.');
  }
});

// Quick apartments list
bot.onText(/\/allapartments/, async (msg) => {
  try {
    // Check if user is admin
    const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id)) : [];
    if (!adminIds.includes(msg.from.id)) {
      await bot.sendMessage(msg.chat.id, '⛔ This command is for admins only.');
      return;
    }
    
    // Create a mock callback query for apartments list
    const mockCallback = {
      id: 'allapartments',
      message: msg,
      from: msg.from,
      data: 'admin_apartments_1'
    };
    
    await adminController.handleCallback(mockCallback);
  } catch (error) {
    logger.error('Apartments command error:', error);
    bot.sendMessage(msg.chat.id, 'Error loading apartments.');
  }
});

// Message handler
bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    console.log(`\n📨 [DEBUG] Message received from chat ${chatId}:`, msg.text ? `"${msg.text}"` : '📸 Photo');
    
    // ============================================
    // STEP 1: ALWAYS check if user is in apartment wizard (NEW - Redis-based)
    // ============================================
    try {
      // Check Redis for wizard state
      const wizardStateRaw = await redis.get(`apt_wizard:${chatId}`);
      
      if (wizardStateRaw) {
        console.log('🏠 [DEBUG] User in new wizard flow (Redis)');
        
        // Handle photo messages in wizard
        if (msg.photo) {
          console.log('📸 [DEBUG] Photo in wizard flow');
          
          // Pass to adminController's wizard photo handler
          const handled = await adminController.apartments.wizard.handleWizardPhoto(chatId, msg.photo);
          if (handled) return;
        }
        
        // Handle text messages in wizard
        if (msg.text) {
          const handled = await adminController.apartments.wizard.handleWizardMessage(chatId, msg.text);
          if (handled) return;
        }
      }
    } catch (e) {
      console.log('Redis check error:', e);
      // Fall through to old flow
    }
    
    // ============================================
    // STEP 2: Check if user is in OLD apartment addition flow (global state)
    // ============================================
    if (global.apartmentStates && global.apartmentStates[chatId]) {
      const state = global.apartmentStates[chatId];
      console.log(`🏠 [DEBUG] User in old apartment flow. Current step: "${state.step}"`);
      
      // ============================================
      // HANDLE "DONE" COMMAND DURING PHOTO UPLOAD
      // ============================================
      if (msg.text && msg.text.toLowerCase() === 'done' && state.step === 'photos') {
        console.log('✅ [DEBUG] "done" received during photo upload');
        
        if (!state.data.images || state.data.images.length === 0) {
          await bot.sendMessage(chatId, '❌ Please send at least one photo first.');
          return;
        }
        
        // Create the apartment with photos
        console.log('✅ [DEBUG] Creating apartment with photos:', state.data.images.length);
        
        const { Apartment } = require('./models');
        const data = state.data;
        
        try {
          const apartment = await Apartment.create({
            ownerId: data.ownerId,
            title: data.title,
            description: data.description,
            pricePerNight: data.pricePerNight,
            location: data.location,
            address: data.address,
            bedrooms: data.bedrooms,
            bathrooms: data.bathrooms,
            maxGuests: data.maxGuests,
            amenities: data.amenities || [],
            images: data.images || [],
            isAvailable: true,
            isApproved: true,
            views: 0,
            createdAt: new Date()
          });
          
          // Clear state
          delete global.apartmentStates[chatId];
          
          // Format currency for success message
          const formatCurrency = (amount) => {
            return new Intl.NumberFormat('en-NG', {
              style: 'currency',
              currency: 'NGN',
              minimumFractionDigits: 0
            }).format(amount).replace('NGN', '₦');
          };
          
          // Success message
          const amenitiesPreview = data.amenities?.length > 0 
              ? data.amenities.slice(0, 3).join(', ') + (data.amenities.length > 3 ? '...' : '')
              : 'None listed';
          
          await bot.sendMessage(chatId,
              `✅ *Apartment Added Successfully!*\n\n` +
              `🏠 *${apartment.title}*\n` +
              `📍 *Area:* ${apartment.location}\n` +
              `📮 *Address:* ${apartment.address}\n` +
              `💰 *Price:* ${formatCurrency(apartment.pricePerNight)}/night\n` +
              `✨ *Amenities:* ${amenitiesPreview}\n` +
              `📸 *Photos:* ${data.images?.length || 0} uploaded\n\n` +
              `The apartment is now live and visible to users!`,
              {
                  parse_mode: 'Markdown',
                  reply_markup: {
                      inline_keyboard: [
                          [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
                      ]
                  }
              }
          );
        } catch (createError) {
          console.error('❌ Error creating apartment:', createError);
          await bot.sendMessage(chatId, '❌ Error creating apartment. Please try again.');
        }
        return;
      }
      
      // ============================================
      // HANDLE PHOTOS IN OLD FLOW
      // ============================================
      if (msg.photo) {
        console.log('📸 [DEBUG] Photo received in old flow');
        
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
      // HANDLE ALL OTHER STEPS IN OLD FLOW
      // ============================================
      if (state.step !== 'photos' && msg.text) {
        console.log(`📝 [DEBUG] Passing to adminController for step: "${state.step}" with text: "${msg.text}"`);
        
        const handled = await adminController.apartments.handleAddApartmentMessage(chatId, msg.text);
        if (handled) return;
      }
    }
    
    // ============================================
    // STEP 3: Check if message is a command
    // ============================================
    if (msg.text && msg.text.startsWith('/')) {
      console.log('📟 [DEBUG] Command detected, skipping regular handlers');
      return;
    }
    
    // ============================================
    // STEP 4: Check for edit states
    // ============================================
    if (global.editStates && global.editStates[chatId]) {
      const state = global.editStates[chatId];
      console.log(`✏️ [DEBUG] User in edit flow. Action: "${state.action}"`);
      
      if (state.action === 'editing_user') {
        // Handle user field editing
        const { User } = require('./models');
        const user = await User.findByPk(state.userId);
        
        if (user) {
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
    // STEP 5: Regular message handling (conversations)
    // ============================================
    console.log('💬 [DEBUG] Passing to regular conversation handler');
    await handleMessage(bot, msg);
    
  } catch (error) {
    logger.error('Message handler error:', error);
    console.error('❌ [DEBUG] Error in message handler:', error);
  }
});

// ============================================
// UPDATED CALLBACK QUERY HANDLER WITH DEBUG LOGS
// ============================================
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
        data.startsWith('wizard_') ||              // 👈 WIZARD CALLBACKS
        data === 'menu_admin' || 
        data === 'admin_back' ||
        data === 'admin_add_apartment') {
      
      console.log('👑 [DEBUG] Routing to admin controller');
      console.log('🔍 [DEBUG] About to call adminController.handleCallback');
      
      try {
        await adminController.handleCallback(callbackQuery);
        console.log('🔍 [DEBUG] adminController.handleCallback completed');
      } catch (error) {
        console.log('🔍 [DEBUG] ERROR in adminController.handleCallback:', error);
        console.log('🔍 [DEBUG] Error stack:', error.stack);
        await bot.sendMessage(chatId, '❌ Error processing request. Please try again.');
      }
    }
    // Route non-admin callbacks to original handler
    else {
      console.log('👤 [DEBUG] Routing to user callback handler');
      await handleCallback(bot, callbackQuery);
    }
    
  } catch (error) {
    logger.error('Callback handler error:', error);
    console.error('❌ [DEBUG] Callback handler error:', error);
    console.error('❌ [DEBUG] Error stack:', error.stack);
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

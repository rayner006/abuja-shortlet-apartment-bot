const AdminBase = require('./adminBase');
const AdminCore = require('./adminCore');
const AdminUsers = require('./adminUsers');
const AdminApartments = require('./adminApartments');
const AdminStats = require('./adminStats');

class AdminController extends AdminBase {
    constructor(bot, redisClient) {
        super(bot);
        console.log('🔍 [DEBUG] AdminController constructor called');
        this.redisClient = redisClient;
        
        // Initialize all admin modules - pass redis to apartments
        this.core = new AdminCore(bot);
        this.users = new AdminUsers(bot);
        this.apartments = new AdminApartments(bot, redisClient);
        this.stats = new AdminStats(bot);
        
        console.log('🔍 [DEBUG] AdminController initialized, apartments wizard exists:', !!this.apartments.wizard);
        
        // Bind methods to preserve 'this'
        this.handleCallback = this.handleCallback.bind(this);
    }

    // Main entry point for admin panel (original)
    async handleAdminPanel(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        // Check admin access
        if (!(await this.isAdmin(userId))) {
            await this.bot.sendMessage(chatId, '⛔ Access denied. This command is for admins only.');
            return;
        }

        await this.core.showAdminPanel(chatId, msg);
    }

    // ✅ NEW METHOD: Show admin panel with chatId and msg parameters
    async showAdminPanel(chatId, msg) {
        const userId = msg.from.id;

        // Check admin access
        if (!(await this.isAdmin(userId))) {
            await this.bot.sendMessage(chatId, '⛔ Access denied. This command is for admins only.');
            return;
        }

        await this.core.showAdminPanel(chatId, msg);
    }

    // Route all admin callbacks to appropriate handlers
    async handleCallback(callbackQuery) {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id;

        console.log(`🔍 [DEBUG] AdminController.handleCallback received: "${data}"`);

        // Verify admin access for all admin callbacks
        if (!(await this.isAdmin(userId))) {
            await this.answerCallback(callbackQuery, '⛔ Admin access required');
            return;
        }

        // Route to appropriate module
        if (data.startsWith('admin_users') || data.startsWith('user_') || 
            data.startsWith('manage_') || data.startsWith('edit_') ||
            data.startsWith('set_role_') || data.startsWith('confirm_delete_')) {
            console.log('🔍 [DEBUG] Routing to users.handleCallback');
            await this.users.handleCallback(callbackQuery);
        }
        // Apartment-related callbacks (including pending, approvals, and all apartment actions)
        else if (data.startsWith('admin_pending') || 
                 data.startsWith('approve_') || 
                 data.startsWith('reject_') || 
                 data.startsWith('admin_apartments') ||
                 data.startsWith('apt_') ||
                 data.startsWith('confirm_delete_apt_') ||
                 data.startsWith('filter_') ||
                 data.startsWith('admin_filter_') ||
                 data.startsWith('sort_') ||
                 data.startsWith('admin_sort_') ||
                 data === 'admin_add_apartment' ||
                 data.startsWith('wizard_')) {
            
            console.log(`🔍 [DEBUG] Routing to apartments.handleCallback for: "${data}"`);
            console.log('🔍 [DEBUG] apartments.wizard exists:', !!this.apartments.wizard);
            
            await this.apartments.handleCallback(callbackQuery);
        }
        else if (data === 'admin_stats') {
            console.log('🔍 [DEBUG] Routing to stats.handleStats');
            await this.stats.handleStats(callbackQuery);
        }
        else if (data === 'menu_admin' || data === 'admin_back') {
            console.log('🔍 [DEBUG] Routing back to admin panel');
            const msg = {
                chat: { id: chatId },
                from: { id: userId },
                callback_query: callbackQuery
            };
            await this.core.showAdminPanel(chatId, msg);
        }
        else {
            console.log(`🔍 [DEBUG] Unknown callback: "${data}"`);
            await this.answerCallback(callbackQuery, 'Unknown command');
        }
    }
}

module.exports = AdminController;

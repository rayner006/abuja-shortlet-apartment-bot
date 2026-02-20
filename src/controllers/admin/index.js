const AdminBase = require('./adminBase');
const AdminCore = require('./adminCore');
const AdminUsers = require('./adminUsers');
const AdminApartments = require('./adminApartments');
const AdminStats = require('./adminStats');

class AdminController extends AdminBase {
    constructor(bot, redisClient) {  // 👈 ADD redisClient parameter
        super(bot);
        this.redisClient = redisClient;  // 👈 Store it
        
        // Initialize all admin modules - pass redis to apartments
        this.core = new AdminCore(bot);
        this.users = new AdminUsers(bot);
        this.apartments = new AdminApartments(bot, redisClient);  // 👈 Pass redis to apartments
        this.stats = new AdminStats(bot);
        
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

        // Verify admin access for all admin callbacks
        if (!(await this.isAdmin(userId))) {
            await this.answerCallback(callbackQuery, '⛔ Admin access required');
            return;
        }

        // Route to appropriate module
        if (data.startsWith('admin_users') || data.startsWith('user_') || 
            data.startsWith('manage_') || data.startsWith('edit_') ||
            data.startsWith('set_role_') || data.startsWith('confirm_delete_')) {
            await this.users.handleCallback(callbackQuery);
        }
        // Apartment-related callbacks (including pending, approvals, and all apartment actions)
        else if (data.startsWith('admin_pending') || 
                 data.startsWith('approve_') || 
                 data.startsWith('reject_') || 
                 data.startsWith('admin_apartments') ||
                 data.startsWith('apt_') ||                    // apartment actions (edit, disable, stats, message, bookings, delete)
                 data.startsWith('confirm_delete_apt_') ||    // confirm delete apartment
                 data.startsWith('filter_') ||                 // filter actions
                 data.startsWith('admin_filter_') ||           // admin filter actions
                 data.startsWith('sort_') ||                   // sort actions
                 data.startsWith('admin_sort_') ||             // admin sort actions
                 data === 'admin_add_apartment' ||             // ✅ ADD APARTMENT BUTTON
                 // 👇 ADD THESE NEW WIZARD CALLBACKS
                 data.startsWith('wizard_')) {                  // All wizard-related callbacks
            await this.apartments.handleCallback(callbackQuery);
        }
        else if (data === 'admin_stats') {
            await this.stats.handleStats(callbackQuery);
        }
        else if (data === 'menu_admin' || data === 'admin_back') {
            // FIXED: Create proper message object with required properties
            const msg = {
                chat: { id: chatId },
                from: { id: userId },
                callback_query: callbackQuery
            };
            await this.core.showAdminPanel(chatId, msg);
        }
        else {
            await this.answerCallback(callbackQuery, 'Unknown command');
        }
    }
}

module.exports = AdminController;

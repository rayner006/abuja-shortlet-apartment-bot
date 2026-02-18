const AdminBase = require('./adminBase');
const AdminCore = require('./adminCore');
const AdminUsers = require('./adminUsers');
const AdminApartments = require('./adminApartments');
const AdminStats = require('./adminStats');

class AdminController extends AdminBase {
    constructor(bot) {
        super(bot);
        this.core = new AdminCore(bot);
        this.users = new AdminUsers(bot);
        this.apartments = new AdminApartments(bot);
        this.stats = new AdminStats(bot);
        
        // Bind methods to preserve 'this'
        this.handleCallback = this.handleCallback.bind(this);
    }

    // Main entry point for admin panel
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
                 data.startsWith('apt_') ||                    // 👈 ADDED: apartment actions (edit, disable, stats, message, bookings, delete)
                 data.startsWith('confirm_delete_apt_') ||    // 👈 ADDED: confirm delete apartment
                 data.startsWith('filter_') ||                 // 👈 ADDED: filter actions
                 data.startsWith('admin_filter_') ||           // 👈 ADDED: admin filter actions
                 data.startsWith('sort_') ||                   // 👈 ADDED: sort actions
                 data.startsWith('admin_sort_')) {             // 👈 ADDED: admin sort actions
            await this.apartments.handleCallback(callbackQuery);
        }
        else if (data === 'admin_stats') {
            await this.stats.handleStats(callbackQuery);
        }
        else if (data === 'menu_admin' || data === 'admin_back') {
            await this.core.showAdminPanel(chatId, callbackQuery.message);
        }
        else {
            await this.answerCallback(callbackQuery, 'Unknown command');
        }
    }
}

module.exports = AdminController;

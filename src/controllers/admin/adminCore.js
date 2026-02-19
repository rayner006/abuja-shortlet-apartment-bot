const AdminBase = require('./adminBase');
const { User, Apartment, Booking } = require('../../models');
const { Op } = require('sequelize');

class AdminCore extends AdminBase {
    constructor(bot) {
        super(bot);
    }

    // Show main admin panel with real stats
    async showAdminPanel(chatId, msg) {
        // Track active panels to prevent duplicates
        if (!global.activeAdminPanels) global.activeAdminPanels = new Set();
        const panelKey = `${chatId}_admin`;
        
        if (global.activeAdminPanels.has(panelKey)) {
            logger.info(`Duplicate admin panel prevented for chat ${chatId}`);
            return;
        }
        
        global.activeAdminPanels.add(panelKey);
        setTimeout(() => global.activeAdminPanels.delete(panelKey), 2000);

        try {
            // Get real-time statistics
            const totalUsers = await User.count();
            const totalOwners = await User.count({ where: { role: 'owner' } });
            const totalListings = await Apartment.count();
            const pendingApprovals = await Apartment.count({ where: { isApproved: false } });
            const totalBookings = await Booking.count();
            
            // Calculate revenue from paid bookings
            const revenue = await Booking.sum('totalPrice', {
                where: { paymentStatus: 'paid' }
            }) || 0;

            // Dynamic admin panel text with stats
            const adminText = `
⚙️ *ADMIN PANEL*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *OVERVIEW*
• 👥 Users: ${totalUsers} | 👑 Owners: ${totalOwners}
• 🏢 Listings: ${totalListings} | 📅 Bookings: ${totalBookings}
• 💰 Revenue: ${this.formatCurrency(revenue)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${pendingApprovals > 0 ? `🚨 *PRIORITY ACTION*
• ⏳ ${pendingApprovals} listing${pendingApprovals > 1 ? 's' : ''} pending approval
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

📋 *MANAGEMENT*
Select a section to manage:

👥 Users - Manage registered users and owners
🏢 Listings - View and manage all apartments
📊 Analytics - Platform statistics and reports
⚙️ Settings - Configure system settings
            `;

            // Create the keyboard based on whether there are pending approvals
            const keyboard = this.createAdminKeyboard(pendingApprovals);

            // Delete previous message if it's an admin panel
            try {
                if (msg.callback_query && msg.callback_query.message) {
                    await this.bot.deleteMessage(chatId, msg.callback_query.message.message_id).catch(() => {});
                }
            } catch (e) {
                // Ignore delete errors
            }

            await this.bot.sendMessage(chatId, adminText, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });

        } catch (error) {
            console.error('Error loading admin panel:', error);
            await this.bot.sendMessage(chatId, '❌ Error loading admin panel. Please try again.');
        }
    }

    // Create main admin keyboard - dynamically shows pending badge
    createAdminKeyboard(pendingCount = 0) {
        const keyboard = {
            inline_keyboard: [
                // Priority row - only shows if there are pending approvals
                ...(pendingCount > 0 ? [[
                    { 
                        text: `⏳ Pending Approvals (${pendingCount})`, 
                        callback_data: 'admin_pending_1' 
                    }
                ]] : []),
                
                // Main management rows
                [
                    { text: '👥 Users', callback_data: 'admin_users_1' },
                    { text: '🏢 Listings', callback_data: 'admin_apartments_1' }
                ],
                [
                    { text: '📊 Statistics', callback_data: 'admin_stats' },
                    { text: '⚙️ Settings', callback_data: 'admin_settings' }
                ],
                // Quick action row
                [
                    { text: '➕ Add Apartment', callback_data: 'admin_add_apartment' }
                ],
                // Navigation
                [{ text: '« Back to Menu', callback_data: 'back_to_main' }]
            ]
        };

        return keyboard;
    }

    // Optional: Quick stats command for admins
    async showQuickStats(chatId) {
        try {
            const totalUsers = await User.count();
            const totalOwners = await User.count({ where: { role: 'owner' } });
            const totalListings = await Apartment.count();
            const pendingApprovals = await Apartment.count({ where: { isApproved: false } });
            const approvedListings = await Apartment.count({ where: { isApproved: true } });
            const totalBookings = await Booking.count();
            
            const recentBookings = await Booking.count({
                where: {
                    createdAt: {
                        [Op.gte]: new Date(new Date() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                    }
                }
            });
            
            const revenue = await Booking.sum('totalPrice', {
                where: { paymentStatus: 'paid' }
            }) || 0;

            const statsText = `
📊 *QUICK STATISTICS*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👥 *Users*
• Total: ${totalUsers}
• Property Owners: ${totalOwners}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏢 *Apartments*
• Total: ${totalListings}
• ✅ Approved: ${approvedListings}
• ⏳ Pending: ${pendingApprovals}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 *Bookings*
• Total: ${totalBookings}
• 📊 Last 7 days: ${recentBookings}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 *Revenue*
• Total: ${this.formatCurrency(revenue)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[🔄 Refresh] [🔙 Back to Admin]
            `;

            await this.bot.sendMessage(chatId, statsText, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Refresh', callback_data: 'admin_stats' }],
                        [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
                    ]
                }
            });

        } catch (error) {
            console.error('Error showing quick stats:', error);
            await this.bot.sendMessage(chatId, '❌ Error loading statistics.');
        }
    }
}

module.exports = AdminCore;

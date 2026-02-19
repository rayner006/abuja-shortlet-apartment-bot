const AdminBase = require('./adminBase');
const { User, Apartment, Booking } = require('../../models');
const { Op } = require('sequelize');

class AdminCore extends AdminBase {
    constructor(bot) {
        super(bot);
    }

    // Show main admin panel
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

            // Clean admin panel text - removed descriptions
            const adminText = `
⚙️ *ADMIN PANEL*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *OVERVIEW*
• 👥 Users: ${totalUsers} | 👑 Owners: ${totalOwners}
• 🏢 Listings: ${totalListings} | 📅 Bookings: ${totalBookings}
• 💰 Revenue: ${this.formatCurrency(revenue)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${pendingApprovals > 0 ? `🚨 *${pendingApprovals} pending approval*` : ''}
            `;

            // Create clean keyboard with just buttons
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

    // Create clean admin keyboard - just buttons, no descriptions
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
                
                // Main management buttons
                [
                    { text: '👥 Users', callback_data: 'admin_users_1' },
                    { text: '🏢 Listings', callback_data: 'admin_apartments_1' }
                ],
                [
                    { text: '📊 Statistics', callback_data: 'admin_stats' },
                    { text: '⚙️ Settings', callback_data: 'admin_settings' }
                ],
                // Quick action buttons
                [
                    { text: '➕ Add Apartment', callback_data: 'admin_add_apartment' }
                ],
                // Navigation
                [{ text: '« Back to Menu', callback_data: 'back_to_main' }]
            ]
        };

        return keyboard;
    }
}

module.exports = AdminCore;

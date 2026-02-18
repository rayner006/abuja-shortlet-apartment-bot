const AdminBase = require('./adminBase');

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

        const adminText = `
⚙️ *Admin Panel*

Welcome to the administration panel. Select an option below:
        `;

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
            reply_markup: this.createAdminKeyboard()
        });
    }

    // Create main admin keyboard
    createAdminKeyboard() {
        return {
            inline_keyboard: [
                [{ text: '⏳ Pending Approvals', callback_data: 'admin_pending_1' }],
                [{ text: '👥 Users', callback_data: 'admin_users_1' }],
                [{ text: '🏢 All Apartments', callback_data: 'admin_apartments_1' }],
                [{ text: '📊 Statistics', callback_data: 'admin_stats' }],
                [{ text: '« Back to Menu', callback_data: 'back_to_main' }]
            ]
        };
    }
}

module.exports = AdminCore;

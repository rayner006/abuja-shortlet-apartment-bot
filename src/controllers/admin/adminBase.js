const { User, Apartment, Booking } = require('../../models');
const logger = require('../../config/logger');

class AdminBase {
    constructor(bot) {
        this.bot = bot;
    }

    // Check if user is admin
    async isAdmin(userId) {
        const adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id)) : [];
        return adminIds.includes(userId);
    }

    // Format date consistently
    formatDate(date) {
        return new Date(date).toLocaleDateString('en-NG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // Format currency
    formatCurrency(amount) {
        return `₦${Number(amount).toLocaleString()}`;
    }

    // Get role emoji
    getRoleEmoji(role) {
        const emojis = {
            'admin': '👑',
            'owner': '🏠',
            'user': '👤'
        };
        return emojis[role] || '👤';
    }

    // Get status emoji
    getStatusEmoji(isActive) {
        return isActive !== false ? '🟢' : '🔴';
    }

    // Handle errors
    async handleError(chatId, error, context) {
        logger.error(`Error in ${context}:`, error);
        await this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }

    // Answer callback query safely
    async answerCallback(callbackQuery, text = '', showAlert = false) {
        try {
            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: text,
                show_alert: showAlert
            });
        } catch (e) {
            // Ignore callback answer errors
        }
    }
}

module.exports = AdminBase;

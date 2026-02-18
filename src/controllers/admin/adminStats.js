const AdminBase = require('./adminBase');
const { User, Apartment, Booking } = require('../../models');
const { Op } = require('sequelize');

class AdminStats extends AdminBase {
    constructor(bot) {
        super(bot);
    }

    async handleStats(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            const totalUsers = await User.count();
            const totalOwners = await User.count({ where: { role: 'owner' } });
            const totalApartments = await Apartment.count();
            const approvedApartments = await Apartment.count({ where: { isApproved: true } });
            const pendingApartments = await Apartment.count({ where: { isApproved: false } });
            
            const totalBookings = await Booking.count();
            const pendingBookings = await Booking.count({ where: { status: 'pending' } });
            const confirmedBookings = await Booking.count({ where: { status: 'confirmed' } });
            const completedBookings = await Booking.count({ where: { status: 'completed' } });
            
            const paidBookings = await Booking.findAll({
                where: { paymentStatus: 'paid' },
                attributes: ['totalPrice']
            });
            const totalRevenue = paidBookings.reduce((sum, b) => sum + parseFloat(b.totalPrice), 0);
            
            const recentUsers = await User.count({
                where: {
                    lastActive: {
                        [Op.gte]: new Date(new Date() - 24 * 60 * 60 * 1000)
                    }
                }
            });
            
            const statsText = `
📊 *System Statistics*

👥 *Users*
• Total Users: ${totalUsers}
• Property Owners: ${totalOwners}
• Active Today: ${recentUsers}

🏢 *Apartments*
• Total Listings: ${totalApartments}
• Approved: ${approvedApartments}
• Pending Approval: ${pendingApartments}

📅 *Bookings*
• Total Bookings: ${totalBookings}
• Pending: ${pendingBookings}
• Confirmed: ${confirmedBookings}
• Completed: ${completedBookings}

💰 *Revenue*
• Total Revenue: ${this.formatCurrency(totalRevenue)}

📈 *Performance*
• Conversion Rate: ${totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(1) : 0}%
• Avg. Booking Value: ${totalBookings > 0 ? this.formatCurrency(totalRevenue / totalBookings) : this.formatCurrency(0)}
            `;
            
            await this.bot.editMessageText(statsText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Refresh', callback_data: 'admin_stats' }],
                        [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
                    ]
                }
            });
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            await this.handleError(chatId, error, 'handleStats');
        }
    }
}

module.exports = AdminStats;

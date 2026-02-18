const AdminBase = require('./adminBase');
const { Apartment, User } = require('../../models');
const { Op } = require('sequelize');

class AdminApartments extends AdminBase {
    constructor(bot) {
        super(bot);
    }

    async handleCallback(callbackQuery) {
        const data = callbackQuery.data;
        
        if (data.startsWith('admin_pending')) {
            const page = data.split('_')[2] ? parseInt(data.split('_')[2]) : 1;
            await this.showPendingApprovals(callbackQuery, page);
        }
        else if (data.startsWith('approve_')) {
            const aptId = data.split('_')[1];
            await this.approveApartment(callbackQuery, aptId);
        }
        else if (data.startsWith('reject_')) {
            const aptId = data.split('_')[1];
            await this.rejectApartment(callbackQuery, aptId);
        }
        else if (data.startsWith('admin_apartments')) {
            const page = data.split('_')[2] ? parseInt(data.split('_')[2]) : 1;
            await this.showAllApartments(callbackQuery, page);
        }
        else if (data.startsWith('contact_owner_')) {
            const ownerId = data.split('_')[2];
            await this.contactOwner(callbackQuery, ownerId);
        }
    }

    // ============================================
    // PENDING APPROVALS (Your exact code)
    // ============================================
    
    async showPendingApprovals(callbackQuery, page = 1) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            const apartments = await Apartment.findAll({
                where: { isApproved: false },
                include: [{
                    model: User,
                    attributes: ['id', 'firstName', 'username', 'phone']
                }],
                order: [['created_at', 'ASC']]
            });
            
            if (apartments.length === 0) {
                await this.bot.editMessageText(
                    '✅ No pending approvals at the moment.\n\nAll apartments have been reviewed.',
                    {
                        chat_id: chatId,
                        message_id: messageId,
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔙 Back to Admin', callback_data

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
                                [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
                            ]
                        }
                    }
                );
                return;
            }
            
            const itemsPerPage = 1;
            const totalPages = Math.ceil(apartments.length / itemsPerPage);
            const startIndex = (page - 1) * itemsPerPage;
            const apt = apartments[startIndex];
            
            const amenities = apt.amenities || [];
            const amenitiesText = amenities.length > 0 
                ? amenities.slice(0, 5).map(a => `• ${a}`).join('\n')
                : '• No amenities listed';
            
            const text = `
📋 *Pending Approval (${page}/${totalPages})*

🏠 *${apt.title}*
👤 *Owner:* ${apt.User?.firstName || 'Unknown'} (@${apt.User?.username || 'N/A'})
📞 *Phone:* ${apt.User?.phone || 'Not provided'}
📍 *Location:* ${apt.location}
💰 *Price:* ${this.formatCurrency(apt.pricePerNight)}/night
🛏 *Bedrooms:* ${apt.bedrooms} | 🚿 *Bathrooms:* ${apt.bathrooms}
👥 *Max Guests:* ${apt.maxGuests}

📝 *Description:*
${apt.description || 'No description provided.'}

✨ *Amenities:*
${amenitiesText}

📅 *Listed on:* ${this.formatDate(apt.createdAt)}
            `;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '✅ Approve', callback_data: `approve_${apt.id}` },
                        { text: '❌ Reject', callback_data: `reject_${apt.id}` }
                    ],
                    [
                        { text: '📞 Contact Owner', callback_data: `contact_owner_${apt.ownerId}` }
                    ]
                ]
            };
            
            // Add pagination
            if (totalPages > 1) {
                const paginationButtons = [];
                if (page > 1) {
                    paginationButtons.push({ text: '◀️ Previous', callback_data: `admin_pending_${page - 1}` });
                }
                paginationButtons.push({ text: `📄 ${page}/${totalPages}`, callback_data: 'noop' });
                if (page < totalPages) {
                    paginationButtons.push({ text: 'Next ▶️', callback_data: `admin_pending_${page + 1}` });
                }
                keyboard.inline_keyboard.push(paginationButtons);
            }
            
            keyboard.inline_keyboard.push([{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]);
            
            if (apt.images && apt.images.length > 0) {
                if (callbackQuery.message.photo) {
                    await this.bot.editMessageMedia({
                        type: 'photo',
                        media: apt.images[0],
                        caption: text,
                        parse_mode: 'Markdown'
                    }, {
                        chat_id: chatId,
                        message_id: messageId,
                        reply_markup: keyboard
                    });
                } else {
                    await this.bot.sendPhoto(chatId, apt.images[0], {
                        caption: text,
                        parse_mode: 'Markdown',
                        reply_markup: keyboard
                    });
                }
            } else {
                await this.bot.editMessageText(text, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            await this.handleError(chatId, error, 'showPendingApprovals');
        }
    }

    // ============================================
    // APPROVE APARTMENT (Your exact code)
    // ============================================
    
    async approveApartment(callbackQuery, apartmentId) {
        const chatId = callbackQuery.message.chat.id;
        
        try {
            const apartment = await Apartment.findByPk(apartmentId, {
                include: [User]
            });
            
            if (!apartment) {
                await this.answerCallback(callbackQuery, 'Apartment not found', true);
                return;
            }
            
            apartment.isApproved = true;
            await apartment.save();
            
            if (apartment.User && apartment.User.telegramId) {
                await this.bot.sendMessage(apartment.User.telegramId,
                    `✅ *Great news! Your apartment has been approved!*\n\n` +
                    `🏠 *${apartment.title}*\n` +
                    `📍 *Location:* ${apartment.location}\n` +
                    `💰 *Price:* ${this.formatCurrency(apartment.pricePerNight)}/night\n\n` +
                    `Your listing is now live and visible to all users searching in Abuja.\n\n` +
                    `You can manage your apartment using /my\\_apartments`,
                    { parse_mode: 'Markdown' }
                );
            }
            
            const text = `✅ *Apartment Approved*\n\n${apartment.title} has been approved and is now live.`;
            
            if (callbackQuery.message.photo) {
                await this.bot.editMessageCaption(text, {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📋 Next Pending', callback_data: 'admin_pending_1' }],
                            [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
                        ]
                    }
                });
            } else {
                await this.bot.editMessageText(text, {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📋 Next Pending', callback_data: 'admin_pending_1' }],
                            [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
                        ]
                    }
                });
            }
            
            await this.answerCallback(callbackQuery, 'Apartment approved successfully!');
            
        } catch (error) {
            await this.handleError(chatId, error, 'approveApartment');
        }
    }

    // ============================================
    // REJECT APARTMENT (Your exact code)
    // ============================================
    
    async rejectApartment(callbackQuery, apartmentId) {
        const chatId = callbackQuery.message.chat.id;
        
        try {
            const apartment = await Apartment.findByPk(apartmentId, {
                include: [User]
            });
            
            if (!apartment) {
                await this.answerCallback(callbackQuery, 'Apartment not found', true);
                return;
            }
            
            await apartment.destroy();
            
            if (apartment.User && apartment.User.telegramId) {
                await this.bot.sendMessage(apartment.User.telegramId,
                    `❌ *Apartment Listing Not Approved*\n\n` +
                    `We're sorry, but your apartment listing "${apartment.title}" was not approved.\n\n` +
                    `*Possible reasons:*\n` +
                    `• Incomplete or unclear information\n` +
                    `• Missing photos\n` +
                    `• Price seems unrealistic\n` +
                    `• Location not clearly specified\n\n` +
                    `Please review your listing and try again with more details.\n\n` +
                    `Use /add\\_apartment to create a new listing.`,
                    { parse_mode: 'Markdown' }
                );
            }
            
            const text = `❌ *Apartment Rejected*\n\n${apartment.title} has been rejected.`;
            
            if (callbackQuery.message.photo) {
                await this.bot.editMessageCaption(text, {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📋 Next Pending', callback_data: 'admin_pending_1' }],
                            [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
                        ]
                    }
                });
            } else {
                await this.bot.editMessageText(text, {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📋 Next Pending', callback_data: 'admin_pending_1' }],
                            [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
                        ]
                    }
                });
            }
            
            await this.answerCallback(callbackQuery, 'Apartment rejected');
            
        } catch (error) {
            await this.handleError(chatId, error, 'rejectApartment');
        }
    }

    // ============================================
    // SHOW ALL APARTMENTS (Your exact code)
    // ============================================
    
    async showAllApartments(callbackQuery, page = 1) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            const apartments = await Apartment.findAll({
                include: [{
                    model: User,
                    attributes: ['id', 'firstName', 'username']
                }],
                order: [['created_at', 'DESC']],
                limit: 5,
                offset: (page - 1) * 5
            });
            
            const totalApartments = await Apartment.count();
            const totalPages = Math.ceil(totalApartments / 5);
            
            let text = `🏢 *All Apartments* (Page ${page}/${totalPages})\n\n`;
            
            for (const apt of apartments) {
                const statusEmoji = apt.isApproved ? '✅' : '⏳';
                const availabilityEmoji = apt.isAvailable ? '🟢' : '🔴';
                
                text += `${statusEmoji} *${apt.title}*\n`;
                text += `   👤 Owner: ${apt.User?.firstName || 'Unknown'} (@${apt.User?.username || 'N/A'})\n`;
                text += `   📍 Location: ${apt.location}\n`;
                text += `   💰 ${this.formatCurrency(apt.pricePerNight)}/night\n`;
                text += `   📊 Status: ${availabilityEmoji} ${apt.isAvailable ? 'Available' : 'Unavailable'}\n`;
                text += `   👥 Max guests: ${apt.maxGuests} | 🛏️ ${apt.bedrooms} bed\n`;
                text += `   📅 Added: ${this.formatDate(apt.createdAt)}\n`;
                text += `   👁️ Views: ${apt.views}\n\n`;
            }
            
            const keyboard = {
                inline_keyboard: []
            };
            
            if (totalPages > 1) {
                const paginationRow = [];
                if (page > 1) {
                    paginationRow.push({ text: '◀️ Prev', callback_data: `admin_apartments_${page - 1}` });
                }
                paginationRow.push({ text: `📄 ${page}/${totalPages}`, callback_data: 'noop' });
                if (page < totalPages) {
                    paginationRow.push({ text: 'Next ▶️', callback_data: `admin_apartments_${page + 1}` });
                }
                keyboard.inline_keyboard.push(paginationRow);
            }
            
            keyboard.inline_keyboard.push(
                [{ text: '📊 Export Data', callback_data: 'admin_export_apartments' }],
                [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
            );
            
            await this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            await this.handleError(chatId, error, 'showAllApartments');
        }
    }

    // ============================================
    // CONTACT OWNER
    // ============================================
    
    async contactOwner(callbackQuery, ownerId) {
        const chatId = callbackQuery.message.chat.id;
        
        try {
            const owner = await User.findByPk(ownerId);
            
            if (!owner) {
                await this.answerCallback(callbackQuery, 'Owner not found', true);
                return;
            }
            
            const text = `
📞 *Contact Owner*

👤 Name: ${owner.firstName || 'Unknown'} ${owner.lastName || ''}
📱 Username: @${owner.username || 'N/A'}
📞 Phone: ${owner.phone || 'Not provided'}
🆔 Telegram ID: \`${owner.telegramId}\`

You can:
• Click on the username to message them directly
• Use the phone number to call/WhatsApp
• Use /message command with their Telegram ID
            `;
            
            await this.bot.sendMessage(chatId, text, {
                parse_mode: 'Markdown'
            });
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            await this.handleError(chatId, error, 'contactOwner');
        }
    }
}

module.exports = AdminApartments;

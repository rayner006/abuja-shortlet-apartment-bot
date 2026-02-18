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
        else if (data.startsWith('view_owner_')) {
            const ownerId = data.split('_')[2];
            await this.viewOwnerDetails(callbackQuery, ownerId);
        }
    }

    // ============================================
    // PENDING APPROVALS (Enhanced)
    // ============================================
    
    async showPendingApprovals(callbackQuery, page = 1) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            // Get total count for pagination
            const totalPending = await Apartment.count({
                where: { isApproved: false }
            });
            
            if (totalPending === 0) {
                const emptyMessage = `
✅ *No Pending Approvals*

All apartments have been reviewed.
There are no listings waiting for approval at the moment.

📊 *Quick Stats:*
• Total Apartments: ${await Apartment.count()}
• Approved: ${await Apartment.count({ where: { isApproved: true } })}
• Pending: 0
                `;
                
                await this.bot.editMessageText(emptyMessage, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔄 Refresh', callback_data: 'admin_pending_1' }],
                            [{ text: '🏢 View All Apartments', callback_data: 'admin_apartments_1' }],
                            [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
                        ]
                    }
                });
                await this.answerCallback(callbackQuery);
                return;
            }
            
            // Get paginated pending apartments
            const itemsPerPage = 1;
            const totalPages = Math.ceil(totalPending / itemsPerPage);
            const startIndex = (page - 1) * itemsPerPage;
            
            const apartments = await Apartment.findAll({
                where: { isApproved: false },
                include: [{
                    model: User,
                    attributes: ['id', 'firstName', 'lastName', 'username', 'phone', 'email']
                }],
                order: [['created_at', 'ASC']],
                limit: itemsPerPage,
                offset: startIndex
            });
            
            const apt = apartments[0];
            
            // Format amenities
            const amenities = apt.amenities || [];
            const amenitiesList = amenities.length > 0 
                ? amenities.map(a => `• ${a}`).join('\n')
                : '• No amenities listed';
            
            // Days since listing
            const daysSinceListed = Math.floor((new Date() - new Date(apt.createdAt)) / (1000 * 60 * 60 * 24));
            
            const text = `
📋 *Pending Approval (${page}/${totalPages})*

🏠 *${apt.title}*

👤 *Owner Information:*
• Name: ${apt.User?.firstName || 'Unknown'} ${apt.User?.lastName || ''}
• Username: @${apt.User?.username || 'N/A'}
• Phone: ${apt.User?.phone || 'Not provided'}
• Email: ${apt.User?.email || 'Not provided'}

📍 *Location:* ${apt.location}
💰 *Price:* ${this.formatCurrency(apt.pricePerNight)}/night
🛏 *Bedrooms:* ${apt.bedrooms} | 🚿 *Bathrooms:* ${apt.bathrooms}
👥 *Max Guests:* ${apt.maxGuests}

📝 *Description:*
${apt.description || 'No description provided.'}

✨ *Amenities:*
${amenitiesList}

📊 *Listing Details:*
• Listed: ${this.formatDate(apt.createdAt)} (${daysSinceListed} days ago)
• Views: ${apt.views || 0}
• Status: ⏳ Pending Review
            `;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '✅ Approve', callback_data: `approve_${apt.id}` },
                        { text: '❌ Reject', callback_data: `reject_${apt.id}` }
                    ],
                    [
                        { text: '📞 Contact Owner', callback_data: `contact_owner_${apt.ownerId}` },
                        { text: '👤 View Owner', callback_data: `view_owner_${apt.ownerId}` }
                    ]
                ]
            };
            
            // Add pagination if needed
            if (totalPages > 1) {
                const paginationRow = [];
                if (page > 1) {
                    paginationRow.push({ text: '◀️ Previous', callback_data: `admin_pending_${page - 1}` });
                }
                paginationRow.push({ text: `📄 ${page}/${totalPages}`, callback_data: 'noop' });
                if (page < totalPages) {
                    paginationRow.push({ text: 'Next ▶️', callback_data: `admin_pending_${page + 1}` });
                }
                keyboard.inline_keyboard.push(paginationRow);
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
            console.error('Error in showPendingApprovals:', error);
            await this.handleError(chatId, error, 'showPendingApprovals');
        }
    }

    // ============================================
    // APPROVE APARTMENT (Enhanced with better messaging)
    // ============================================
    
    async approveApartment(callbackQuery, apartmentId) {
        const chatId = callbackQuery.message.chat.id;
        
        try {
            const apartment = await Apartment.findByPk(apartmentId, {
                include: [User]
            });
            
            if (!apartment) {
                await this.answerCallback(callbackQuery, '❌ Apartment not found', true);
                return;
            }
            
            apartment.isApproved = true;
            await apartment.save();
            
            // Notify owner
            if (apartment.User && apartment.User.telegramId) {
                const ownerMessage = `
✅ *Congratulations! Your Apartment is Approved!*

🏠 *${apartment.title}*
📍 *Location:* ${apartment.location}
💰 *Price:* ${this.formatCurrency(apartment.pricePerNight)}/night

Your listing is now LIVE and visible to all users searching in Abuja!

📊 *What happens next:*
• Users can now search and book your apartment
• You'll receive notifications for new bookings
• You can manage your listing with /my_apartments

Need help? Contact support@abujashortlet.com
                `;
                
                await this.bot.sendMessage(apartment.User.telegramId, ownerMessage, {
                    parse_mode: 'Markdown'
                }).catch(() => {});
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
                            [{ text: '🏢 All Apartments', callback_data: 'admin_apartments_1' }],
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
                            [{ text: '🏢 All Apartments', callback_data: 'admin_apartments_1' }],
                            [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
                        ]
                    }
                });
            }
            
            await this.answerCallback(callbackQuery, '✅ Apartment approved successfully!');
            
        } catch (error) {
            console.error('Error approving apartment:', error);
            await this.handleError(chatId, error, 'approveApartment');
        }
    }

    // ============================================
    // REJECT APARTMENT (Enhanced with better messaging)
    // ============================================
    
    async rejectApartment(callbackQuery, apartmentId) {
        const chatId = callbackQuery.message.chat.id;
        
        try {
            const apartment = await Apartment.findByPk(apartmentId, {
                include: [User]
            });
            
            if (!apartment) {
                await this.answerCallback(callbackQuery, '❌ Apartment not found', true);
                return;
            }
            
            // Store owner info before deletion
            const ownerTelegramId = apartment.User?.telegramId;
            const ownerName = apartment.User?.firstName || 'Owner';
            const aptTitle = apartment.title;
            const aptLocation = apartment.location;
            
            // Delete the apartment
            await apartment.destroy();
            
            // Notify owner
            if (ownerTelegramId) {
                const ownerMessage = `
❌ *Apartment Listing Not Approved*

🏠 *${aptTitle}*
📍 *Location:* ${aptLocation}

We're sorry, but your apartment listing was not approved.

📋 *Common reasons for rejection:*
• Incomplete or unclear information
• Missing or low-quality photos
• Price seems unrealistic
• Location not clearly specified
• Amenities list is incomplete

📝 *How to resubmit:*
1. Review and update your apartment details
2. Add clear, high-quality photos
3. Ensure accurate pricing
4. Use /add_apartment to create a new listing

Need help? Contact support@abujashortlet.com
                `;
                
                await this.bot.sendMessage(ownerTelegramId, ownerMessage, {
                    parse_mode: 'Markdown'
                }).catch(() => {});
            }
            
            const text = `❌ *Apartment Rejected*\n\n${aptTitle} has been rejected.`;
            
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
            
            await this.answerCallback(callbackQuery, '❌ Apartment rejected');
            
        } catch (error) {
            console.error('Error rejecting apartment:', error);
            await this.handleError(chatId, error, 'rejectApartment');
        }
    }

    // ============================================
    // VIEW OWNER DETAILS (New)
    // ============================================
    
    async viewOwnerDetails(callbackQuery, ownerId) {
        const chatId = callbackQuery.message.chat.id;
        
        try {
            const owner = await User.findByPk(ownerId);
            
            if (!owner) {
                await this.answerCallback(callbackQuery, '❌ Owner not found', true);
                return;
            }
            
            // Get owner's apartment stats
            const totalApartments = await Apartment.count({ where: { ownerId: owner.id } });
            const approvedApartments = await Apartment.count({ 
                where: { ownerId: owner.id, isApproved: true } 
            });
            const pendingApartments = await Apartment.count({ 
                where: { ownerId: owner.id, isApproved: false } 
            });
            
            const roleEmoji = this.getRoleEmoji(owner.role);
            const statusEmoji = this.getStatusEmoji(owner.isActive);
            
            const text = `
👤 *Owner Details*

${statusEmoji} ${roleEmoji} *${owner.firstName || ''} ${owner.lastName || ''}*

📱 *Username:* @${owner.username || 'N/A'}
📞 *Phone:* ${owner.phone || 'Not provided'}
📧 *Email:* ${owner.email || 'Not provided'}
🆔 *Telegram ID:* \`${owner.telegramId}\`

📊 *Statistics:*
• Total Listings: ${totalApartments}
• ✅ Approved: ${approvedApartments}
• ⏳ Pending: ${pendingApartments}
• Member since: ${this.formatDate(owner.createdAt)}

⚙️ *Quick Actions:*
            `;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '💬 Message Owner', callback_data: `user_message_${owner.id}` },
                        { text: '📋 View Listings', callback_data: `user_listings_${owner.id}` }
                    ],
                    [
                        { text: owner.isActive ? '🔴 Deactivate' : '🟢 Activate', 
                          callback_data: `user_toggle_${owner.id}` },
                        { text: '👑 Change Role', callback_data: `user_role_${owner.id}` }
                    ],
                    [{ text: '« Back to Pending', callback_data: 'admin_pending_1' }]
                ]
            };
            
            await this.bot.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            console.error('Error viewing owner details:', error);
            await this.handleError(chatId, error, 'viewOwnerDetails');
        }
    }

    // ============================================
    // CONTACT OWNER (Enhanced with state management)
    // ============================================
    
    async contactOwner(callbackQuery, ownerId) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            const owner = await User.findByPk(ownerId);
            
            if (!owner) {
                await this.answerCallback(callbackQuery, '❌ Owner not found', true);
                return;
            }
            
            const text = `
📞 *Contact Apartment Owner*

You are about to contact *${owner.firstName || 'Owner'}*.

Type your message below and it will be sent directly to the owner.
To cancel, type /cancel
            `;
            
            // Set state for message sending
            if (!global.messageStates) global.messageStates = {};
            global.messageStates[chatId] = {
                action: 'sending_message_to_owner',
                targetUserId: owner.id,
                targetTelegramId: owner.telegramId,
                returnTo: 'admin_pending_1'
            };
            
            await this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '« Cancel', callback_data: 'admin_pending_1' }]
                    ]
                }
            });
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            console.error('Error contacting owner:', error);
            await this.handleError(chatId, error, 'contactOwner');
        }
    }

    // ============================================
    // SHOW ALL APARTMENTS (Your existing code)
    // ============================================
    
    async showAllApartments(callbackQuery, page = 1) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            const itemsPerPage = 5;
            const totalApartments = await Apartment.count();
            const totalPages = Math.ceil(totalApartments / itemsPerPage);
            
            const apartments = await Apartment.findAll({
                include: [{
                    model: User,
                    attributes: ['id', 'firstName', 'username']
                }],
                order: [['created_at', 'DESC']],
                limit: itemsPerPage,
                offset: (page - 1) * itemsPerPage
            });
            
            let text = `🏢 *All Apartments* (Page ${page}/${totalPages})\n\n`;
            text += `📊 Total: ${totalApartments} | ✅ Approved: ${await Apartment.count({ where: { isApproved: true } })} | ⏳ Pending: ${await Apartment.count({ where: { isApproved: false } })}\n\n`;
            
            for (const apt of apartments) {
                const statusEmoji = apt.isApproved ? '✅' : '⏳';
                const availabilityEmoji = apt.isAvailable ? '🟢' : '🔴';
                
                text += `${statusEmoji} *${apt.title}*\n`;
                text += `   👤 Owner: ${apt.User?.firstName || 'Unknown'}\n`;
                text += `   📍 ${apt.location} | 💰 ${this.formatCurrency(apt.pricePerNight)}\n`;
                text += `   📊 ${availabilityEmoji} ${apt.isAvailable ? 'Available' : 'Unavailable'} | 👁️ ${apt.views || 0} views\n\n`;
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
                [{ text: '📋 Pending Approvals', callback_data: 'admin_pending_1' }],
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
            console.error('Error showing all apartments:', error);
            await this.handleError(chatId, error, 'showAllApartments');
        }
    }
}

module.exports = AdminApartments;

const AdminBase = require('./adminBase');
const { Apartment, User, Booking } = require('../../models');
const { Op } = require('sequelize');
const sequelize = require('../../config/database'); // Add this for aggregate functions

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
        else if (data.startsWith('apt_')) {
            await this.handleApartmentActions(callbackQuery);
        }
        else if (data.startsWith('filter_') || data.startsWith('sort_')) {
            await this.handleApartmentFilters(callbackQuery);
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
    // VIEW OWNER DETAILS
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
    // ENHANCED SHOW ALL APARTMENTS with stats and actions
    // ============================================
    
    async showAllApartments(callbackQuery, page = 1) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            const itemsPerPage = 5;
            const totalApartments = await Apartment.count();
            const activeApartments = await Apartment.count({ where: { isAvailable: true } });
            const inactiveApartments = await Apartment.count({ where: { isAvailable: false } });
            const approvedApartments = await Apartment.count({ where: { isApproved: true } });
            const pendingApartments = await Apartment.count({ where: { isApproved: false } });
            
            // Get total views
            const allApartments = await Apartment.findAll({
                attributes: ['views'],
                where: { isApproved: true }
            });
            const totalViews = allApartments.reduce((sum, apt) => sum + (apt.views || 0), 0);
            
            // Get total bookings
            const totalBookings = await Booking.count({
                include: [{
                    model: Apartment,
                    where: { isApproved: true }
                }]
            });
            
            // Get total revenue
            const revenueResult = await Booking.findAll({
                attributes: ['totalPrice'],
                where: { 
                    paymentStatus: 'paid',
                    status: 'completed'
                },
                include: [{
                    model: Apartment,
                    where: { isApproved: true }
                }]
            });
            const totalRevenue = revenueResult.reduce((sum, booking) => sum + parseFloat(booking.totalPrice || 0), 0);
            
            // Get location stats
            const locationStats = await Apartment.findAll({
                attributes: ['location', [sequelize.fn('COUNT', sequelize.col('location')), 'count']],
                where: { isApproved: true },
                group: ['location'],
                order: [[sequelize.literal('count'), 'DESC']],
                limit: 3
            });
            
            const topLocations = locationStats.map(l => `${l.location} (${l.dataValues.count})`).join(', ');
            
            const totalPages = Math.ceil(totalApartments / itemsPerPage);
            
            const apartments = await Apartment.findAll({
                include: [{
                    model: User,
                    attributes: ['id', 'firstName', 'lastName', 'username', 'phone']
                }],
                order: [['created_at', 'DESC']],
                limit: itemsPerPage,
                offset: (page - 1) * itemsPerPage
            });
            
            // Header with statistics
            let text = `🏢 *ALL APARTMENTS* (Page ${page}/${totalPages})\n\n`;
            text += `📊 *Overview*\n`;
            text += `• Total: ${totalApartments} | ✅ Active: ${activeApartments} | 🔴 Inactive: ${inactiveApartments}\n`;
            text += `• Approved: ${approvedApartments} | ⏳ Pending: ${pendingApartments}\n`;
            text += `• 👁️ Total Views: ${totalViews} | 📅 Bookings: ${totalBookings}\n`;
            text += `• 💰 Revenue: ${this.formatCurrency(totalRevenue)}\n`;
            
            if (topLocations) {
                text += `• 📍 Top Locations: ${topLocations}\n`;
            }
            
            text += `\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            // Individual apartment listings with enhanced details
            for (const apt of apartments) {
                const statusEmoji = apt.isApproved ? '✅' : '⏳';
                const availabilityEmoji = apt.isAvailable ? '🟢' : '🔴';
                const availabilityText = apt.isAvailable ? 'Active' : 'Inactive';
                
                // Get booking count for this apartment
                const bookingCount = await Booking.count({ where: { apartmentId: apt.id } });
                
                // Get revenue for this apartment
                const aptRevenue = await Booking.sum('totalPrice', {
                    where: { 
                        apartmentId: apt.id,
                        paymentStatus: 'paid'
                    }
                }) || 0;
                
                text += `${statusEmoji} *${apt.title}*\n`;
                text += `   👤 Owner: ${apt.User?.firstName || 'Unknown'} (@${apt.User?.username || 'N/A'})\n`;
                text += `   📞 Phone: ${apt.User?.phone || 'Not provided'}\n`;
                text += `   📍 ${apt.location} | 💰 ${this.formatCurrency(apt.pricePerNight)}/night\n`;
                text += `   🛏️ ${apt.bedrooms} bed | 🚿 ${apt.bathrooms} bath | 👥 ${apt.maxGuests} guests\n`;
                text += `   📊 ${availabilityEmoji} ${availabilityText} | 👁️ ${apt.views || 0} views\n`;
                text += `   📅 Bookings: ${bookingCount} | 💰 Revenue: ${this.formatCurrency(aptRevenue)}\n`;
                
                // Add warning for problem listings
                const daysOld = Math.floor((new Date() - new Date(apt.createdAt)) / (1000 * 60 * 60 * 24));
                if (apt.views === 0 && bookingCount === 0 && daysOld > 7) {
                    text += `   ⚠️ *Warning:* No activity in ${daysOld} days\n`;
                }
                
                // Add action buttons for this apartment
                text += `   [✏️ Edit] [🔴 ${apt.isAvailable ? 'Disable' : 'Enable'}] [📊 Stats] [💬 Message] [📋 Bookings] [❌ Delete]\n\n`;
            }
            
            // Build keyboard with all controls
            const keyboard = {
                inline_keyboard: [
                    // Search and filter row
                    [
                        { text: '🔍 Search', callback_data: 'admin_search_apartments' },
                        { text: '📍 Filter', callback_data: 'admin_filter_location' },
                        { text: '💰 Price', callback_data: 'admin_filter_price' }
                    ],
                    [
                        { text: '📊 Status', callback_data: 'admin_filter_status' },
                        { text: '👤 Owner', callback_data: 'admin_filter_owner' },
                        { text: '🔄 Reset', callback_data: 'admin_reset_filters' }
                    ],
                    // Sort options
                    [
                        { text: '🆕 Newest', callback_data: 'admin_sort_newest' },
                        { text: '💰 High-Low', callback_data: 'admin_sort_price_high' },
                        { text: '💰 Low-High', callback_data: 'admin_sort_price_low' }
                    ],
                    [
                        { text: '👁️ Most Views', callback_data: 'admin_sort_views' },
                        { text: '📅 Most Booked', callback_data: 'admin_sort_bookings' }
                    ],
                    // Bulk actions
                    [
                        { text: '☑️ Select All', callback_data: 'admin_select_all' },
                        { text: '📋 Bulk Actions', callback_data: 'admin_bulk_actions' },
                        { text: '📥 Export', callback_data: 'admin_export' }
                    ]
                ]
            };
            
            // Pagination
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
            
            // Navigation
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
            console.error('Error in showAllApartments:', error);
            await this.handleError(chatId, error, 'showAllApartments');
        }
    }

    // ============================================
    // APARTMENT ACTIONS HANDLER
    // ============================================
    
    async handleApartmentActions(callbackQuery) {
        const data = callbackQuery.data;
        const parts = data.split('_');
        const action = parts[1];
        const apartmentId = parts[2];
        
        const chatId = callbackQuery.message.chat.id;
        
        try {
            const apartment = await Apartment.findByPk(apartmentId, {
                include: [User]
            });
            
            if (!apartment) {
                await this.answerCallback(callbackQuery, 'Apartment not found', true);
                return;
            }
            
            switch(action) {
                case 'edit':
                    await this.showEditApartmentForm(callbackQuery, apartment);
                    break;
                case 'disable':
                    apartment.isAvailable = !apartment.isAvailable;
                    await apartment.save();
                    await this.answerCallback(callbackQuery, 
                        `Apartment ${apartment.isAvailable ? 'enabled' : 'disabled'}`
                    );
                    // Refresh the list
                    const refreshCallback = {
                        ...callbackQuery,
                        data: 'admin_apartments_1'
                    };
                    await this.showAllApartments(refreshCallback, 1);
                    break;
                case 'stats':
                    await this.showApartmentStats(callbackQuery, apartment);
                    break;
                case 'message':
                    await this.contactOwner(callbackQuery, apartment.ownerId);
                    break;
                case 'bookings':
                    await this.showApartmentBookings(callbackQuery, apartment);
                    break;
                case 'delete':
                    await this.confirmDeleteApartment(callbackQuery, apartment);
                    break;
                default:
                    await this.answerCallback(callbackQuery, 'Unknown action');
            }
        } catch (error) {
            console.error('Error in apartment actions:', error);
            await this.handleError(chatId, error, 'apartmentActions');
        }
    }

    // ============================================
    // SHOW APARTMENT STATS
    // ============================================
    
    async showApartmentStats(callbackQuery, apartment) {
        const chatId = callbackQuery.message.chat.id;
        
        try {
            const bookingCount = await Booking.count({ where: { apartmentId: apartment.id } });
            const completedBookings = await Booking.count({ 
                where: { apartmentId: apartment.id, status: 'completed' } 
            });
            const revenue = await Booking.sum('totalPrice', {
                where: { apartmentId: apartment.id, paymentStatus: 'paid' }
            }) || 0;
            
            const stats = `
📊 *Apartment Statistics*

🏠 *${apartment.title}*
📍 ${apartment.location}

📈 *Performance*
• Total Views: ${apartment.views || 0}
• Total Bookings: ${bookingCount}
• Completed Stays: ${completedBookings}
• Conversion Rate: ${apartment.views > 0 ? ((bookingCount / apartment.views) * 100).toFixed(1) : 0}%

💰 *Revenue*
• Total Revenue: ${this.formatCurrency(revenue)}
• Average per Booking: ${bookingCount > 0 ? this.formatCurrency(revenue / bookingCount) : '₦0'}

📅 *Listing Info*
• Listed: ${this.formatDate(apartment.createdAt)}
• Last Updated: ${this.formatDate(apartment.updatedAt || apartment.createdAt)}
• Status: ${apartment.isAvailable ? '🟢 Active' : '🔴 Inactive'}
            `;
            
            await this.bot.sendMessage(chatId, stats, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '« Back to Apartments', callback_data: 'admin_apartments_1' }]
                    ]
                }
            });
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            await this.handleError(chatId, error, 'showApartmentStats');
        }
    }

    // ============================================
    // SHOW APARTMENT BOOKINGS
    // ============================================
    
    async showApartmentBookings(callbackQuery, apartment) {
        const chatId = callbackQuery.message.chat.id;
        
        try {
            const bookings = await Booking.findAll({
                where: { apartmentId: apartment.id },
                include: [{
                    model: User,
                    attributes: ['id', 'firstName', 'username', 'phone']
                }],
                order: [['created_at', 'DESC']],
                limit: 10
            });
            
            if (bookings.length === 0) {
                await this.bot.sendMessage(chatId, 
                    `📋 *No Bookings*\n\nThis apartment has no bookings yet.`,
                    { parse_mode: 'Markdown' }
                );
                await this.answerCallback(callbackQuery);
                return;
            }
            
            let text = `📋 *Bookings for ${apartment.title}*\n\n`;
            
            for (const booking of bookings) {
                const statusEmoji = {
                    'pending': '⏳',
                    'confirmed': '✅',
                    'completed': '🏁',
                    'cancelled': '❌'
                }[booking.status] || '📅';
                
                text += `${statusEmoji} *${booking.bookingReference}*\n`;
                text += `   👤 Guest: ${booking.User?.firstName || 'Unknown'}\n`;
                text += `   📅 ${this.formatDate(booking.checkIn)} - ${this.formatDate(booking.checkOut)}\n`;
                text += `   👥 ${booking.guests} guests | 💰 ${this.formatCurrency(booking.totalPrice)}\n`;
                text += `   Status: ${booking.status} | Payment: ${booking.paymentStatus}\n\n`;
            }
            
            await this.bot.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '« Back to Apartments', callback_data: 'admin_apartments_1' }]
                    ]
                }
            });
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            await this.handleError(chatId, error, 'showApartmentBookings');
        }
    }

    // ============================================
    // CONFIRM DELETE APARTMENT
    // ============================================
    
    async confirmDeleteApartment(callbackQuery, apartment) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        const text = `
⚠️ *Confirm Delete*

Are you sure you want to delete *${apartment.title}*?

This will permanently remove:
• Apartment listing
• All associated bookings
• Cannot be undone!

Owner: ${apartment.User?.firstName || 'Unknown'}
Location: ${apartment.location}
Price: ${this.formatCurrency(apartment.pricePerNight)}/night
        `;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '✅ Yes, Delete', callback_data: `confirm_delete_apt_${apartment.id}` },
                    { text: '❌ Cancel', callback_data: 'admin_apartments_1' }
                ]
            ]
        };
        
        await this.bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        
        await this.answerCallback(callbackQuery);
    }

    // ============================================
    // HANDLE APARTMENT FILTERS
    // ============================================
    
    async handleApartmentFilters(callbackQuery) {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            if (data === 'admin_filter_location') {
                // Get unique locations
                const locations = await Apartment.findAll({
                    attributes: [[sequelize.fn('DISTINCT', sequelize.col('location')), 'location']],
                    where: { isApproved: true }
                });
                
                const locationButtons = locations.map(l => ([{
                    text: l.location,
                    callback_data: `filter_loc_${l.location}`
                }]));
                
                // Split into rows of 2
                const keyboard = [];
                for (let i = 0; i < locationButtons.length; i += 2) {
                    keyboard.push(locationButtons.slice(i, i + 2).flat());
                }
                keyboard.push([{ text: '« Back', callback_data: 'admin_apartments_1' }]);
                
                await this.bot.editMessageText('📍 *Select Location to Filter*', {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: keyboard }
                });
            }
            else if (data === 'admin_filter_price') {
                const priceRanges = [
                    ['₦0 - ₦50,000', 'filter_price_0_50000'],
                    ['₦50,000 - ₦100,000', 'filter_price_50000_100000'],
                    ['₦100,000 - ₦200,000', 'filter_price_100000_200000'],
                    ['₦200,000+', 'filter_price_200000_plus']
                ];
                
                const keyboard = priceRanges.map(range => ([{
                    text: range[0],
                    callback_data: range[1]
                }]));
                keyboard.push([{ text: '« Back', callback_data: 'admin_apartments_1' }]);
                
                await this.bot.editMessageText('💰 *Select Price Range*', {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: keyboard }
                });
            }
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            await this.handleError(chatId, error, 'handleApartmentFilters');
        }
    }

    // ============================================
    // EDIT APARTMENT FORM (Placeholder)
    // ============================================
    
    async showEditApartmentForm(callbackQuery, apartment) {
        const chatId = callbackQuery.message.chat.id;
        
        await this.bot.sendMessage(chatId, 
            `✏️ *Edit Apartment*\n\n` +
            `Editing functionality for "${apartment.title}" will be available soon.\n\n` +
            `You'll be able to:\n` +
            `• Update title and description\n` +
            `• Change price\n` +
            `• Modify amenities\n` +
            `• Update photos\n` +
            `• Change location\n\n` +
            `For now, use the owner dashboard for updates.`,
            { parse_mode: 'Markdown' }
        );
        
        await this.answerCallback(callbackQuery);
    }
}

module.exports = AdminApartments;

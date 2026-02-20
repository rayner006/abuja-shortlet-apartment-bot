const AdminBase = require('./adminBase');
const { Apartment, User, Booking } = require('../../models');
const { Op } = require('sequelize');
const sequelize = require('../../config/database');

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
        else if (data.startsWith('confirm_delete_apt_')) {
            const apartmentId = data.split('_')[3];
            await this.deleteApartment(callbackQuery, apartmentId);
        }
        else if (data.startsWith('filter_') || data.startsWith('sort_')) {
            await this.handleApartmentFilters(callbackQuery);
        }
        // Handle Add Apartment button
        else if (data === 'admin_add_apartment') {
            await this.startAddApartment(callbackQuery);
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
📮 *Address:* ${apt.address || 'Not provided'}
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
    // APPROVE APARTMENT - FIXED VERSION
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
📮 *Address:* ${apartment.address || 'Not provided'}
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
            
            const replyMarkup = {
                inline_keyboard: [
                    [{ text: '📋 Next Pending', callback_data: 'admin_pending_1' }],
                    [{ text: '🏢 All Apartments', callback_data: 'admin_apartments_1' }],
                    [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
                ]
            };
            
            // Handle both photo and text messages correctly
            if (callbackQuery.message.photo) {
                // For messages with photos, edit the caption
                await this.bot.editMessageCaption(text, {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id,
                    parse_mode: 'Markdown'
                });
                
                // Then send a new message with the buttons
                await this.bot.sendMessage(chatId, "What would you like to do next?", {
                    reply_markup: replyMarkup
                });
            } else {
                // For text-only messages, edit the message with buttons
                await this.bot.editMessageText(text, {
                    chat_id: chatId,
                    message_id: callbackQuery.message.message_id,
                    parse_mode: 'Markdown',
                    reply_markup: replyMarkup
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
    // ENHANCED SHOW ALL APARTMENTS with individual cards
    // ============================================
    
    async showAllApartments(callbackQuery, page = 1) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            const itemsPerPage = 3; // Show 3 apartments per page
            const totalApartments = await Apartment.count();
            // Removed active/inactive counts
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
            
            // Delete the previous message
            await this.bot.deleteMessage(chatId, messageId).catch(() => {});
            
            // Send header with statistics - REMOVED active/inactive
            let headerText = `🏢 *ALL APARTMENTS* (Page ${page}/${totalPages})\n\n`;
            headerText += `📊 *Overview*\n`;
            headerText += `• Total: ${totalApartments} | ✅ Approved: ${approvedApartments} | ⏳ Pending: ${pendingApartments}\n`;
            headerText += `• 👁️ Total Views: ${totalViews} | 📅 Bookings: ${totalBookings}\n`;
            headerText += `• 💰 Revenue: ${this.formatCurrency(totalRevenue)}\n`;
            
            if (topLocations) {
                headerText += `• 📍 Top Locations: ${topLocations}\n`;
            }
            
            await this.bot.sendMessage(chatId, headerText, {
                parse_mode: 'Markdown'
            });
            
            // Send each apartment as an individual card
            for (const apt of apartments) {
                await this.sendApartmentCard(chatId, apt);
            }
            
            // Send controls
            await this.sendApartmentControls(chatId, page, totalPages);
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            console.error('Error in showAllApartments:', error);
            await this.handleError(chatId, error, 'showAllApartments');
        }
    }

    // ============================================
    // SEND INDIVIDUAL APARTMENT CARD - UPDATED WITH ADDRESS
    // ============================================
    
    async sendApartmentCard(chatId, apt) {
        try {
            // Get booking count for this apartment
            const bookingCount = await Booking.count({ where: { apartmentId: apt.id } });
            
            // Get revenue for this apartment
            const aptRevenue = await Booking.sum('totalPrice', {
                where: { 
                    apartmentId: apt.id,
                    paymentStatus: 'paid'
                }
            }) || 0;
            
            const statusEmoji = apt.isApproved ? '✅' : '⏳';
            
            // Calculate days old for warning
            const daysOld = Math.floor((new Date() - new Date(apt.createdAt)) / (1000 * 60 * 60 * 24));
            
            // Format the apartment card with address
            const cardText = `
┌────────────────────────────────────┐
│ ${statusEmoji} *${apt.title}*
├────────────────────────────────────┤
│ 👤 *Owner:* ${apt.User?.firstName || 'Unknown'} (@${apt.User?.username || 'N/A'})
│ 📞 *Phone:* ${apt.User?.phone || 'Not provided'}
│
│ 📍 *Area:* ${apt.location}
│ 📮 *Address:* ${apt.address || 'Not provided'}
│ 💰 *Price:* ${this.formatCurrency(apt.pricePerNight)}/night
│ 🛏️ *Bedrooms:* ${apt.bedrooms} | 🚿 *Bathrooms:* ${apt.bathrooms} | 👥 *Max:* ${apt.maxGuests}
│
│ 👁️ *Views:* ${apt.views || 0}
│ 📅 *Bookings:* ${bookingCount}
│ 💰 *Revenue:* ${this.formatCurrency(aptRevenue)}
│
${apt.views === 0 && bookingCount === 0 && daysOld > 7 ? '│ ⚠️ *Warning:* No activity in ' + daysOld + ' days\n' : ''}└────────────────────────────────────┘
            `;
            
            // Create working buttons for this apartment
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '✏️ Edit', callback_data: `apt_edit_${apt.id}` },
                        { text: '📊 Stats', callback_data: `apt_stats_${apt.id}` },
                        { text: '💬 Message', callback_data: `apt_message_${apt.id}` }
                    ],
                    [
                        { text: '📋 Bookings', callback_data: `apt_bookings_${apt.id}` },
                        { text: '❌ Delete', callback_data: `apt_delete_${apt.id}` }
                    ]
                ]
            };
            
            // Send with photo if available
            if (apt.images && apt.images.length > 0) {
                await this.bot.sendPhoto(chatId, apt.images[0], {
                    caption: cardText,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            } else {
                await this.bot.sendMessage(chatId, cardText, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
            
        } catch (error) {
            console.error('Error sending apartment card:', error);
        }
    }

    // ============================================
    // SEND APARTMENT CONTROLS
    // ============================================
    
    async sendApartmentControls(chatId, currentPage, totalPages) {
        try {
            const keyboard = {
                inline_keyboard: [
                    // Filter row
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
                    // Sort row
                    [
                        { text: '🆕 Newest', callback_data: 'admin_sort_newest' },
                        { text: '💰 High-Low', callback_data: 'admin_sort_price_high' },
                        { text: '💰 Low-High', callback_data: 'admin_sort_price_low' }
                    ],
                    [
                        { text: '👁️ Most Views', callback_data: 'admin_sort_views' },
                        { text: '📅 Most Booked', callback_data: 'admin_sort_bookings' }
                    ]
                ]
            };
            
            // Pagination row
            if (totalPages > 1) {
                const paginationRow = [];
                if (currentPage > 1) {
                    paginationRow.push({ text: '◀️ Prev', callback_data: `admin_apartments_${currentPage - 1}` });
                }
                paginationRow.push({ text: `📄 ${currentPage}/${totalPages}`, callback_data: 'noop' });
                if (currentPage < totalPages) {
                    paginationRow.push({ text: 'Next ▶️', callback_data: `admin_apartments_${currentPage + 1}` });
                }
                keyboard.inline_keyboard.push(paginationRow);
            }
            
            // Navigation row
            keyboard.inline_keyboard.push(
                [{ text: '📋 Pending Approvals', callback_data: 'admin_pending_1' }],
                [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
            );
            
            await this.bot.sendMessage(chatId, '🔧 *Controls*', {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
        } catch (error) {
            console.error('Error sending apartment controls:', error);
        }
    }

    // ============================================
    // APARTMENT ACTIONS HANDLER - UPDATED (removed disable case)
    // ============================================
    
    async handleApartmentActions(callbackQuery) {
        const data = callbackQuery.data;
        const parts = data.split('_');
        const action = parts[1];
        const apartmentId = parts[2];
        
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            const apartment = await Apartment.findByPk(apartmentId, {
                include: [User]
            });
            
            if (!apartment) {
                await this.answerCallback(callbackQuery, '❌ Apartment not found', true);
                return;
            }
            
            switch(action) {
                case 'edit':
                    await this.showEditApartmentForm(callbackQuery, apartment);
                    break;
                    
                // REMOVED disable case
                    
                case 'stats':
                    await this.showApartmentStats(callbackQuery, apartment);
                    break;
                    
                case 'message':
                    await this.contactOwner({
                        ...callbackQuery,
                        data: `contact_owner_${apartment.ownerId}`
                    }, apartment.ownerId);
                    break;
                    
                case 'bookings':
                    await this.showApartmentBookings(callbackQuery, apartment);
                    break;
                    
                case 'delete':
                    await this.confirmDeleteApartment(callbackQuery, apartment);
                    break;
                    
                default:
                    await this.answerCallback(callbackQuery, '❌ Unknown action');
            }
        } catch (error) {
            console.error('Error in apartment actions:', error);
            await this.handleError(chatId, error, 'apartmentActions');
        }
    }

    // ============================================
    // SHOW APARTMENT STATS - UPDATED (removed status)
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
📮 ${apartment.address || 'Address not provided'}

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
⚠️ *Confirm Delete Apartment*

Are you sure you want to delete this apartment?

🏠 *${apartment.title}*
📍 *Location:* ${apartment.location}
📮 *Address:* ${apartment.address || 'Not provided'}
👤 *Owner:* ${apartment.User?.firstName || 'Unknown'}

This action CANNOT be undone!
All bookings for this apartment will also be deleted.
        `;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '✅ Yes, Delete', callback_data: `confirm_delete_apt_${apartment.id}` },
                    { text: '❌ No, Cancel', callback_data: 'admin_apartments_1' }
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
    // DELETE APARTMENT (Final deletion)
    // ============================================
    
    async deleteApartment(callbackQuery, apartmentId) {
        const chatId = callbackQuery.message.chat.id;
        
        try {
            const apartment = await Apartment.findByPk(apartmentId);
            
            if (!apartment) {
                await this.answerCallback(callbackQuery, '❌ Apartment not found', true);
                return;
            }
            
            await apartment.destroy();
            
            await this.answerCallback(callbackQuery, '✅ Apartment deleted successfully');
            
            // Go back to apartments list
            await this.showAllApartments({ ...callbackQuery, data: 'admin_apartments_1' }, 1);
            
        } catch (error) {
            console.error('Error deleting apartment:', error);
            await this.handleError(chatId, error, 'deleteApartment');
        }
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
            `• Change location\n` +
            `• Update address\n\n` +
            `For now, use the owner dashboard for updates.`,
            { parse_mode: 'Markdown' }
        );
        
        await this.answerCallback(callbackQuery);
    }

    // ============================================
    // ADD APARTMENT FUNCTIONALITY - FIXED with Location then Address
    // ============================================

    async startAddApartment(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            const text = `
➕ *Add New Apartment*

Let's add a new apartment to the system.
You'll be the owner of this apartment.

Please enter the apartment title:
            `;
            
            // Set up state to collect apartment details
            if (!global.apartmentStates) global.apartmentStates = {};
            
            global.apartmentStates[chatId] = {
                step: 'title',
                data: {
                    ownerId: callbackQuery.from.id,
                    isApproved: true // Auto-approve since admin is adding
                }
            };
            
            await this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '« Cancel', callback_data: 'menu_admin' }]
                    ]
                }
            });
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            console.error('Error starting add apartment:', error);
            await this.handleError(chatId, error, 'startAddApartment');
        }
    }

    // Handle messages for adding apartment - FIXED PHOTO HANDLING
    async handleAddApartmentMessage(chatId, text) {
        try {
            const state = global.apartmentStates?.[chatId];
            if (!state) return false;
            
            const data = state.data;
            
            // IMPORTANT: If step is 'photos' and this is called with a photo message (text is undefined/null),
            // the photo is already handled in index.js, so we just return true
            if (state.step === 'photos' && !text) {
                console.log('📸 [DEBUG] Photo message received, already handled in index.js');
                return true;
            }
            
            switch(state.step) {
                case 'title':
                    data.title = text;
                    state.step = 'location';
                    global.apartmentStates[chatId] = state; // 👈 SAVE STATE
                    await this.bot.sendMessage(chatId, 
                        `📍 *Location*\n\nWhich area/neighborhood? (e.g., Kubwa, Asokoro, Maitama)\n\nThis is what users will click in the filter menu.`,
                        { parse_mode: 'Markdown' }
                    );
                    break;
                    
                case 'location':
                    data.location = text;
                    state.step = 'address';
                    global.apartmentStates[chatId] = state; // 👈 SAVE STATE
                    await this.bot.sendMessage(chatId,
                        `📍 *Address*\n\nWhat is the full street address?\n(e.g., 12 Bobo Street, Off Udi Hill, Asokoro)`,
                        { parse_mode: 'Markdown' }
                    );
                    break;
                    
                case 'address':
                    data.address = text;
                    state.step = 'price';
                    global.apartmentStates[chatId] = state; // 👈 SAVE STATE
                    await this.bot.sendMessage(chatId,
                        `💰 *Price*\n\nWhat is the price per night? (in Naira)`,
                        { parse_mode: 'Markdown' }
                    );
                    break;
                    
                case 'price':
                    const price = parseInt(text.replace(/[^0-9]/g, ''));
                    if (isNaN(price) || price < 1000) {
                        await this.bot.sendMessage(chatId,
                            `❌ *Invalid Price*\n\nPlease enter a valid price (minimum ₦1,000)`,
                            { parse_mode: 'Markdown' }
                        );
                        return true;
                    }
                    data.pricePerNight = price;
                    state.step = 'bedrooms';
                    global.apartmentStates[chatId] = state; // 👈 SAVE STATE
                    await this.bot.sendMessage(chatId,
                        `🛏️ *Bedrooms*\n\nHow many bedrooms? (0 for studio)`,
                        { parse_mode: 'Markdown' }
                    );
                    break;
                    
                case 'bedrooms':
                    const bedrooms = parseInt(text);
                    if (isNaN(bedrooms) || bedrooms < 0 || bedrooms > 10) {
                        await this.bot.sendMessage(chatId,
                            `❌ *Invalid Number*\n\nPlease enter a valid number of bedrooms (0-10)`,
                            { parse_mode: 'Markdown' }
                        );
                        return true;
                    }
                    data.bedrooms = bedrooms;
                    state.step = 'bathrooms';
                    global.apartmentStates[chatId] = state; // 👈 SAVE STATE
                    await this.bot.sendMessage(chatId,
                        `🚿 *Bathrooms*\n\nHow many bathrooms?`,
                        { parse_mode: 'Markdown' }
                    );
                    break;
                    
                case 'bathrooms':
                    const bathrooms = parseInt(text);
                    if (isNaN(bathrooms) || bathrooms < 1 || bathrooms > 10) {
                        await this.bot.sendMessage(chatId,
                            `❌ *Invalid Number*\n\nPlease enter a valid number of bathrooms (1-10)`,
                            { parse_mode: 'Markdown' }
                        );
                        return true;
                    }
                    data.bathrooms = bathrooms;
                    state.step = 'maxGuests';
                    global.apartmentStates[chatId] = state; // 👈 SAVE STATE
                    await this.bot.sendMessage(chatId,
                        `👥 *Max Guests*\n\nMaximum number of guests?`,
                        { parse_mode: 'Markdown' }
                    );
                    break;
                    
                case 'maxGuests':
                    const maxGuests = parseInt(text);
                    if (isNaN(maxGuests) || maxGuests < 1 || maxGuests > 20) {
                        await this.bot.sendMessage(chatId,
                            `❌ *Invalid Number*\n\nPlease enter a valid number of guests (1-20)`,
                            { parse_mode: 'Markdown' }
                        );
                        return true;
                    }
                    data.maxGuests = maxGuests;
                    state.step = 'description';
                    global.apartmentStates[chatId] = state; // 👈 SAVE STATE
                    await this.bot.sendMessage(chatId,
                        `📝 *Description*\n\nPlease enter a description of the apartment:`,
                        { parse_mode: 'Markdown' }
                    );
                    break;
                    
                case 'description':
                    data.description = text;
                    state.step = 'amenities';
                    global.apartmentStates[chatId] = state; // 👈 SAVE STATE
                    await this.bot.sendMessage(chatId,
                        `✨ *Amenities*\n\n` +
                        `List the amenities (comma separated):\n` +
                        `Example: WiFi, Air Conditioning, TV, Kitchen, Parking, Security`,
                        { parse_mode: 'Markdown' }
                    );
                    break;
                    
                case 'amenities':
                    // Convert comma-separated string to array
                    data.amenities = text.split(',').map(item => item.trim()).filter(item => item.length > 0);
                    state.step = 'photos';
                    data.images = data.images || []; // Ensure images array exists
                    global.apartmentStates[chatId] = state; // 👈 SAVE STATE - THIS WAS MISSING!
                    await this.bot.sendMessage(chatId,
                        `📸 *Photos*\n\n` +
                        `Please send photos of the apartment.\n\n` +
                        `• Click the 📎 attachment icon\n` +
                        `• Select 📷 Camera or 🖼️ Gallery\n` +
                        `• Send your photos (one by one)\n\n` +
                        `When you're done, type *done*`,
                        { parse_mode: 'Markdown' }
                    );
                    break;
                    
                case 'photos':
                    // When user types "done", create the apartment
                    if (text && text.toLowerCase() === 'done') {
                        // Check if any photos were uploaded
                        if (!data.images || data.images.length === 0) {
                            await this.bot.sendMessage(chatId,
                                `❌ *No Photos Uploaded*\n\n` +
                                `Please send at least one photo before typing "done".\n\n` +
                                `Use the 📎 attachment button to send photos.`,
                                { parse_mode: 'Markdown' }
                            );
                            return true;
                        }
                        
                        console.log('✅ [DEBUG] Creating apartment with photos:', data.images.length);
                        
                        // Create the apartment with ALL database fields
                        const apartment = await Apartment.create({
                            // Core fields from your flow
                            ownerId: data.ownerId,
                            title: data.title,
                            address: data.address,
                            description: data.description,
                            pricePerNight: data.pricePerNight,
                            location: data.location,
                            bedrooms: data.bedrooms,
                            bathrooms: data.bathrooms,
                            maxGuests: data.maxGuests,
                            amenities: data.amenities || [],
                            images: data.images || [], // Photos from index.js
                            
                            // ✅ ADDED: Missing database fields
                            isApproved: true,
                            isAvailable: true,
                            views: 0,
                            createdAt: new Date()
                        });
                        
                        // Clear state
                        delete global.apartmentStates[chatId];
                        
                        // Success message with address
                        const amenitiesPreview = data.amenities?.length > 0 
                            ? data.amenities.slice(0, 3).join(', ') + (data.amenities.length > 3 ? '...' : '')
                            : 'None listed';
                        
                        await this.bot.sendMessage(chatId,
                            `✅ *Apartment Added Successfully!*\n\n` +
                            `🏠 *${apartment.title}*\n` +
                            `📍 *Area:* ${apartment.location}\n` +
                            `📮 *Address:* ${apartment.address}\n` +
                            `💰 *Price:* ${this.formatCurrency(apartment.pricePerNight)}/night\n` +
                            `✨ *Amenities:* ${amenitiesPreview}\n` +
                            `📸 *Photos:* ${data.images?.length || 0} uploaded\n\n` +
                            `The apartment is now live and visible to users!`,
                            {
                                parse_mode: 'Markdown',
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
                                    ]
                                }
                            }
                        );
                    } else if (text) {
                        // If user sends any text other than "done" during photos step
                        await this.bot.sendMessage(chatId,
                            `📸 *Photo Upload*\n\n` +
                            `Please send photos using the 📎 attachment button.\n` +
                            `Type *done* when you've finished uploading.`,
                            { parse_mode: 'Markdown' }
                        );
                    }
                    break;
            }
            
            return true;
        } catch (error) {
            console.error('Error in handleAddApartmentMessage:', error);
            await this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
            delete global.apartmentStates?.[chatId];
            return true;
        }
    }
}

module.exports = AdminApartments;

const AdminBase = require('./adminBase');
const { User, Apartment, Booking } = require('../../models');

class AdminUsers extends AdminBase {
    constructor(bot) {
        super(bot);
    }

    // Main entry point for user management callbacks
    async handleCallback(callbackQuery) {
        const data = callbackQuery.data;
        
        if (data === 'admin_users' || data.startsWith('admin_users_')) {
            const page = data.split('_')[2] ? parseInt(data.split('_')[2]) : 1;
            await this.showUserList(callbackQuery, page);
        }
        else if (data.startsWith('manage_')) {
            await this.showUserDetails(callbackQuery);
        }
        else if (data.startsWith('user_edit_')) {
            await this.editUser(callbackQuery);
        }
        else if (data.startsWith('user_toggle_')) {
            await this.toggleUserStatus(callbackQuery);
        }
        else if (data.startsWith('user_message_')) {
            await this.prepareMessageUser(callbackQuery);
        }
        else if (data.startsWith('user_role_')) {
            await this.showRoleOptions(callbackQuery);
        }
        else if (data.startsWith('user_listings_')) {
            await this.showUserListings(callbackQuery);
        }
        else if (data.startsWith('user_bookings_')) {
            await this.showUserBookings(callbackQuery);
        }
        else if (data.startsWith('user_delete_')) {
            await this.confirmDeleteUser(callbackQuery);
        }
        else if (data.startsWith('set_role_')) {
            await this.setUserRole(callbackQuery);
        }
        else if (data.startsWith('confirm_delete_')) {
            await this.deleteUser(callbackQuery);
        }
        else if (data.startsWith('edit_')) {
            await this.handleEditField(callbackQuery);
        }
    }

    // ============================================
    // USER LIST WITH CARDS (Your existing code)
    // ============================================
    
    async showUserList(callbackQuery, page = 1) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            const users = await User.findAll({
                order: [['role', 'ASC'], ['created_at', 'DESC']],
                limit: 3,
                offset: (page - 1) * 3
            });
            
            const totalUsers = await User.count();
            const totalPages = Math.ceil(totalUsers / 3);
            
            await this.bot.deleteMessage(chatId, messageId).catch(() => {});
            
            await this.bot.sendMessage(chatId, 
                `👥 *User Management* (Page ${page}/${totalPages})\n\n` +
                `Each user has their own management card below:`,
                { parse_mode: 'Markdown' }
            );
            
            for (const user of users) {
                await this.sendUserCard(chatId, user);
            }
            
            await this.sendUserNavigation(chatId, page, totalPages);
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            await this.handleError(chatId, error, 'showUserList');
        }
    }

    // ============================================
    // INDIVIDUAL USER CARD (Your exact code)
    // ============================================
    
    async sendUserCard(chatId, user) {
        try {
            const roleEmoji = this.getRoleEmoji(user.role);
            const statusEmoji = this.getStatusEmoji(user.isActive);
            const statusText = user.isActive !== false ? 'Active' : 'Inactive';
            
            const userBookings = await Booking.count({ where: { userId: user.id } });
            const userApartments = await Apartment.count({ where: { ownerId: user.id } });
            
            const cardText = `
${statusEmoji} ${roleEmoji} *${user.firstName || 'Unknown'} ${user.lastName || ''}*

🆔 \`${user.telegramId}\`
📱 @${user.username || 'N/A'}
📞 ${user.phone || 'Not provided'}
👑 Role: ${user.role} | ${statusText}
📊 Stats: ${userBookings} bookings | ${userApartments} properties
📅 Joined: ${this.formatDate(user.createdAt)}
            `;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '✏️ Edit', callback_data: `user_edit_${user.id}` },
                        { text: user.isActive !== false ? '🔴 Deactivate' : '🟢 Activate', 
                          callback_data: `user_toggle_${user.id}` },
                        { text: '💬 Message', callback_data: `user_message_${user.id}` }
                    ],
                    [
                        { text: '👑 Change Role', callback_data: `user_role_${user.id}` },
                        { text: '📋 Listings', callback_data: `user_listings_${user.id}` },
                        { text: '📅 Bookings', callback_data: `user_bookings_${user.id}` }
                    ],
                    [
                        { text: '❌ Delete User', callback_data: `user_delete_${user.id}` }
                    ]
                ]
            };
            
            await this.bot.sendMessage(chatId, cardText, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
        } catch (error) {
            logger.error('Send user card error:', error);
        }
    }

    // ============================================
    // USER DETAILS VIEW (Original manage_ function)
    // ============================================
    
    async showUserDetails(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.data.split('_')[1];
        
        try {
            const user = await User.findByPk(userId, {
                include: [
                    { model: Apartment, as: 'apartments' },
                    { model: Booking, as: 'bookings' }
                ]
            });
            
            if (!user) {
                await this.answerCallback(callbackQuery, 'User not found', true);
                return;
            }
            
            const isActive = user.isActive !== false;
            const statusEmoji = isActive ? '🟢' : '🔴';
            const status = isActive ? 'Active' : 'Inactive';
            const roleEmoji = this.getRoleEmoji(user.role);
            
            const text = `
👤 *User Details: ${user.firstName || ''} ${user.lastName || ''}*

${roleEmoji} *Role:* ${user.role}
${statusEmoji} *Status:* ${status}
🆔 *Telegram ID:* \`${user.telegramId}\`
📱 *Username:* @${user.username || 'N/A'}
📞 *Phone:* ${user.phone || 'Not provided'}
📅 *Joined:* ${this.formatDate(user.createdAt)}
⏱️ *Last Active:* ${user.lastActive ? this.formatDate(user.lastActive) : 'Never'}

📊 *Statistics:*
• Apartments: ${user.apartments?.length || 0}
• Bookings: ${user.bookings?.length || 0}
            `;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '👑 Change Role', callback_data: `user_role_${user.id}` },
                        { text: isActive ? '🔴 Deactivate' : '🟢 Activate', 
                          callback_data: `user_toggle_${user.id}` }
                    ],
                    [
                        { text: '✏️ Edit Details', callback_data: `user_edit_${user.id}` },
                        { text: '📋 View Listings', callback_data: `user_listings_${user.id}` }
                    ],
                    [
                        { text: '📅 View Bookings', callback_data: `user_bookings_${user.id}` },
                        { text: '💬 Send Message', callback_data: `user_message_${user.id}` }
                    ],
                    [
                        { text: '❌ Delete User', callback_data: `user_delete_${user.id}` }
                    ],
                    [{ text: '« Back to Users', callback_data: 'admin_users_1' }]
                ]
            };
            
            await this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            await this.handleError(chatId, error, 'showUserDetails');
        }
    }

    // ============================================
    // EDIT USER (Your exact code)
    // ============================================
    
    async editUser(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.data.split('_')[2];
        
        try {
            const user = await User.findByPk(userId);
            
            if (!user) {
                await this.answerCallback(callbackQuery, 'User not found', true);
                return;
            }
            
            const text = `
✏️ *Edit User: ${user.firstName || 'Unknown'}*

Current Details:
• First Name: ${user.firstName || 'Not set'}
• Last Name: ${user.lastName || 'Not set'}
• Phone: ${user.phone || 'Not set'}
• Email: ${user.email || 'Not set'}

Select what you want to edit:
            `;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '📝 First Name', callback_data: `edit_firstname_${user.id}` },
                        { text: '📝 Last Name', callback_data: `edit_lastname_${user.id}` }
                    ],
                    [
                        { text: '📞 Phone', callback_data: `edit_phone_${user.id}` },
                        { text: '📧 Email', callback_data: `edit_email_${user.id}` }
                    ],
                    [
                        { text: '« Back', callback_data: `manage_${user.id}` }
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
            
        } catch (error) {
            await this.handleError(chatId, error, 'editUser');
        }
    }

    // ============================================
    // TOGGLE USER STATUS (Your exact code)
    // ============================================
    
    async toggleUserStatus(callbackQuery) {
        const userId = callbackQuery.data.split('_')[2];
        
        try {
            const user = await User.findByPk(userId);
            
            if (!user) {
                await this.answerCallback(callbackQuery, 'User not found', true);
                return;
            }
            
            user.isActive = user.isActive === false ? true : false;
            await user.save();
            
            const status = user.isActive ? 'activated' : 'deactivated';
            
            if (user.telegramId) {
                await this.bot.sendMessage(user.telegramId,
                    `🔔 *Account Update*\n\nYour account has been *${status}* by an admin.`,
                    { parse_mode: 'Markdown' }
                ).catch(() => {});
            }
            
            await this.answerCallback(callbackQuery, `User ${status} successfully`);
            
            // Refresh view
            const mockCallback = {
                message: callbackQuery.message,
                from: callbackQuery.from,
                id: callbackQuery.id,
                data: `manage_${userId}`
            };
            await this.showUserDetails(mockCallback);
            
        } catch (error) {
            await this.handleError(callbackQuery.message.chat.id, error, 'toggleUserStatus');
        }
    }

    // ============================================
    // MESSAGE USER (Your exact code)
    // ============================================
    
    async prepareMessageUser(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.data.split('_')[2];
        
        try {
            const user = await User.findByPk(userId);
            
            if (!user) {
                await this.answerCallback(callbackQuery, 'User not found', true);
                return;
            }
            
            const text = `
💬 *Send Message to ${user.firstName || 'User'}*

Type your message below.
The user will receive it immediately.

To cancel, type /cancel
            `;
            
            if (!global.messageStates) global.messageStates = {};
            global.messageStates[chatId] = {
                action: 'sending_message',
                targetUserId: user.id,
                targetTelegramId: user.telegramId
            };
            
            await this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '« Cancel', callback_data: `manage_${user.id}` }]
                    ]
                }
            });
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            await this.handleError(chatId, error, 'prepareMessageUser');
        }
    }

    // ============================================
    // SHOW ROLE OPTIONS (Your exact code)
    // ============================================
    
    async showRoleOptions(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.data.split('_')[2];
        
        try {
            const user = await User.findByPk(userId);
            
            if (!user) {
                await this.answerCallback(callbackQuery, 'User not found', true);
                return;
            }
            
            const text = `
👤 *Change Role for ${user.firstName || 'User'}*

Current Role: ${user.role}

Select new role:
            `;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '👤 User', callback_data: `set_role_${user.id}_user` },
                        { text: '🏠 Owner', callback_data: `set_role_${user.id}_owner` }
                    ],
                    [
                        { text: '👑 Admin', callback_data: `set_role_${user.id}_admin` }
                    ],
                    [{ text: '« Back', callback_data: `manage_${user.id}` }]
                ]
            };
            
            await this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            await this.handleError(chatId, error, 'showRoleOptions');
        }
    }

    // ============================================
    // SET USER ROLE (Your exact code)
    // ============================================
    
    async setUserRole(callbackQuery) {
        const parts = callbackQuery.data.split('_');
        const userId = parts[2];
        const newRole = parts[3];
        
        try {
            const user = await User.findByPk(userId);
            
            if (!user) {
                await this.answerCallback(callbackQuery, 'User not found', true);
                return;
            }
            
            const oldRole = user.role;
            user.role = newRole;
            await user.save();
            
            if (user.telegramId) {
                await this.bot.sendMessage(user.telegramId,
                    `🔔 *Role Update*\n\nYour role has been changed from *${oldRole}* to *${newRole}* by an admin.`,
                    { parse_mode: 'Markdown' }
                ).catch(() => {});
            }
            
            await this.answerCallback(callbackQuery, `Role changed to ${newRole}`);
            
            const mockCallback = {
                message: callbackQuery.message,
                from: callbackQuery.from,
                id: callbackQuery.id,
                data: `manage_${userId}`
            };
            await this.showUserDetails(mockCallback);
            
        } catch (error) {
            await this.handleError(callbackQuery.message.chat.id, error, 'setUserRole');
        }
    }

    // ============================================
    // SHOW USER LISTINGS (Your exact code)
    // ============================================
    
    async showUserListings(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.data.split('_')[2];
        
        try {
            const user = await User.findByPk(userId);
            const apartments = await Apartment.findAll({
                where: { ownerId: user.id }
            });
            
            if (apartments.length === 0) {
                await this.bot.editMessageText(
                    `📋 *No Listings*\n\n${user.firstName || 'User'} has no apartment listings.`,
                    {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '« Back', callback_data: `manage_${user.id}` }]
                            ]
                        }
                    }
                );
                await this.answerCallback(callbackQuery);
                return;
            }
            
            let text = `📋 *${user.firstName || 'User'}'s Listings*\n\n`;
            
            for (const apt of apartments) {
                const statusEmoji = apt.isAvailable ? '🟢' : '🔴';
                text += `🏠 *${apt.title}*\n`;
                text += `   📍 ${apt.location}\n`;
                text += `   💰 ${this.formatCurrency(apt.pricePerNight)}/night\n`;
                text += `   📊 ${statusEmoji} ${apt.isAvailable ? 'Available' : 'Unavailable'}\n`;
                text += `   👁️ Views: ${apt.views || 0}\n\n`;
            }
            
            await this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '« Back', callback_data: `manage_${user.id}` }]
                    ]
                }
            });
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            await this.handleError(chatId, error, 'showUserListings');
        }
    }

    // ============================================
    // SHOW USER BOOKINGS (Your exact code)
    // ============================================
    
    async showUserBookings(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const userId = callbackQuery.data.split('_')[2];
        
        try {
            const user = await User.findByPk(userId);
            const bookings = await Booking.findAll({
                where: { userId: user.id },
                include: [{ model: Apartment, attributes: ['title', 'location'] }],
                order: [['created_at', 'DESC']],
                limit: 10
            });
            
            if (bookings.length === 0) {
                await this.bot.editMessageText(
                    `📅 *No Bookings*\n\n${user.firstName || 'User'} has no booking history.`,
                    {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '« Back', callback_data: `manage_${user.id}` }]
                            ]
                        }
                    }
                );
                await this.answerCallback(callbackQuery);
                return;
            }
            
            let text = `📅 *${user.firstName || 'User'}'s Bookings*\n\n`;
            
            for (const booking of bookings) {
                const statusEmoji = {
                    'pending': '⏳',
                    'confirmed': '✅',
                    'completed': '🏁',
                    'cancelled': '❌'
                }[booking.status] || '📅';
                
                text += `${statusEmoji} *${booking.Apartment?.title || 'Apartment'}*\n`;
                text += `   📍 ${booking.Apartment?.location || 'N/A'}\n`;
                text += `   📅 ${this.formatDate(booking.checkIn)} - ${this.formatDate(booking.checkOut)}\n`;
                text += `   💰 ${this.formatCurrency(booking.totalPrice)}\n`;
                text += `   Status: ${booking.status}\n\n`;
            }
            
            await this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '« Back', callback_data: `manage_${user.id}` }]
                    ]
                }
            });
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            await this.handleError(chatId, error, 'showUserBookings');
        }
    }

    // ============================================
    // CONFIRM DELETE USER (Your exact code)
    // ============================================
    
    async confirmDeleteUser(callbackQuery) {
        const userId = callbackQuery.data.split('_')[2];
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            const user = await User.findByPk(userId);
            
            if (!user) {
                await this.answerCallback(callbackQuery, 'User not found', true);
                return;
            }
            
            const apartmentsCount = await Apartment.count({ where: { ownerId: user.id } });
            const bookingsCount = await Booking.count({ where: { userId: user.id } });
            
            const text = `
⚠️ *Confirm User Deletion*

Are you sure you want to delete *${user.firstName || 'User'}*?

This will permanently remove:
• User account
• ${apartmentsCount} apartment(s) (if owner)
• ${bookingsCount} booking(s)

This action CANNOT be undone!
            `;
            
            const keyboard = {
                inline_keyboard: [
                    [
                        { text: '✅ Yes, Delete', callback_data: `confirm_delete_${user.id}` },
                        { text: '❌ Cancel', callback_data: `manage_${user.id}` }
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
            
        } catch (error) {
            await this.handleError(chatId, error, 'confirmDeleteUser');
        }
    }

    // ============================================
    // DELETE USER (Your exact code)
    // ============================================
    
    async deleteUser(callbackQuery) {
        const userId = callbackQuery.data.split('_')[2];
        const chatId = callbackQuery.message.chat.id;
        
        try {
            const user = await User.findByPk(userId);
            
            if (!user) {
                await this.answerCallback(callbackQuery, 'User not found', true);
                return;
            }
            
            const userName = user.firstName || 'User';
            const userTelegramId = user.telegramId;
            
            await user.destroy();
            
            if (userTelegramId) {
                await this.bot.sendMessage(userTelegramId,
                    `🔔 *Account Deleted*\n\nYour account has been removed from the system by an admin.`,
                    { parse_mode: 'Markdown' }
                ).catch(() => {});
            }
            
            await this.answerCallback(callbackQuery, `User ${userName} deleted successfully`);
            
            const mockCallback = {
                message: callbackQuery.message,
                from: callbackQuery.from,
                id: callbackQuery.id,
                data: 'admin_users_1'
            };
            await this.showUserList(mockCallback, 1);
            
        } catch (error) {
            await this.handleError(chatId, error, 'deleteUser');
        }
    }

    // ============================================
    // HANDLE EDIT FIELD (for firstname, lastname, etc)
    // ============================================
    
    async handleEditField(callbackQuery) {
        const parts = callbackQuery.data.split('_');
        const field = parts[1];
        const userId = parts[2];
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            const user = await User.findByPk(userId);
            
            if (!user) {
                await this.answerCallback(callbackQuery, 'User not found', true);
                return;
            }
            
            const fieldNames = {
                'firstname': 'First Name',
                'lastname': 'Last Name',
                'phone': 'Phone Number',
                'email': 'Email Address'
            };
            
            const text = `
✏️ *Edit ${fieldNames[field] || field}*

Current value: ${user[field] || 'Not set'}

Please type the new value below.
To cancel, type /cancel
            `;
            
            if (!global.editStates) global.editStates = {};
            global.editStates[chatId] = {
                action: 'editing_user',
                field: field,
                userId: userId
            };
            
            await this.bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '« Cancel', callback_data: `manage_${user.id}` }]
                    ]
                }
            });
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            await this.handleError(chatId, error, 'handleEditField');
        }
    }

    // ============================================
    // HELPER: Send user navigation
    // ============================================
    
    async sendUserNavigation(chatId, page, totalPages) {
        const navButtons = [];
        
        if (page > 1) {
            navButtons.push({ text: '◀️ Previous Page', callback_data: `admin_users_${page - 1}` });
        }
        
        if (page < totalPages) {
            navButtons.push({ text: 'Next Page ▶️', callback_data: `admin_users_${page + 1}` });
        }
        
        const keyboard = {
            inline_keyboard: [
                navButtons,
                [
                    { text: '➕ Add New User', callback_data: 'admin_add_user' },
                    { text: '📊 Export All', callback_data: 'admin_export_users' }
                ],
                [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
            ]
        };
        
        await this.bot.sendMessage(chatId, 'Navigation:', {
            reply_markup: keyboard
        });
    }
}

module.exports = AdminUsers;

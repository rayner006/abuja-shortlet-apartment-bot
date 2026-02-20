// controllers/admin/apartmentWizard.js
const AdminBase = require('./adminBase');
const { Apartment } = require('../../models');
const logger = require('../../config/logger');

// Popular Abuja locations
const POPULAR_LOCATIONS = [
    'Asokoro', 'Maitama', 'Wuse', 'Jabi', 'Garki',
    'Kubwa', 'Gwarinpa', 'Utako', 'Life Camp', 'Durumi',
    'Gudu', 'Apo', 'Katampe', 'Guzape', 'Wuye'
];

// Bedroom options
const BEDROOM_OPTIONS = [
    { text: '📦 Studio (0)', value: 0 },
    { text: '🛏️ 1 Bedroom', value: 1 },
    { text: '🛏️🛏️ 2 Bedrooms', value: 2 },
    { text: '🛏️🛏️🛏️ 3 Bedrooms', value: 3 },
    { text: '🏠 4+ Bedrooms', value: 4 },
    { text: '✏️ Custom', value: 'custom' }
];

// Bathroom options
const BATHROOM_OPTIONS = [
    { text: '🚽 1', value: 1 },
    { text: '🚽🚽 2', value: 2 },
    { text: '🚽🚽🚽 3', value: 3 },
    { text: '🚽🚽🚽🚽 4+', value: 4 },
    { text: '✏️ Custom', value: 'custom' }
];

// Guest options
const GUEST_OPTIONS = [
    { text: '👥 2 guests', value: 2 },
    { text: '👥👥 4 guests', value: 4 },
    { text: '👥👥👥 6 guests', value: 6 },
    { text: '👥👥👥👥 8 guests', value: 8 },
    { text: '👥👥👥👥👥 10+ guests', value: 10 },
    { text: '✏️ Custom', value: 'custom' }
];

// Price range buttons (pre-set amounts)
const PRICE_OPTIONS = [
    { text: '₦15,000', value: 15000 },
    { text: '₦25,000', value: 25000 },
    { text: '₦35,000', value: 35000 },
    { text: '₦50,000', value: 50000 },
    { text: '₦75,000', value: 75000 },
    { text: '₦100,000', value: 100000 },
    { text: '₦150,000', value: 150000 },
    { text: '₦200,000+', value: 'custom' }
];

// Common amenities (multi-select)
const AMENITY_OPTIONS = [
    'WiFi', 'Air Conditioning', 'TV', 'Kitchen', 'Parking',
    'Swimming Pool', 'Gym', 'Security', 'Balcony', 'Garden',
    'Elevator', 'Generator', 'Water Heater', 'Washing Machine',
    'Microwave', 'Refrigerator', 'Iron', 'Hair Dryer'
];

class ApartmentWizard extends AdminBase {
    constructor(bot, redisClient) {
        super(bot);
        this.redis = redisClient;
        this.wizardPrefix = 'apt_wizard:';
    }

    // ============================================
    // MAIN ENTRY POINT - Start the wizard
    // ============================================
    
    async startWizard(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            // Initialize wizard state in Redis
            const wizardState = {
                step: 'title',
                data: {
                    ownerId: callbackQuery.from.id,
                    isApproved: true // Auto-approve for admin
                },
                createdAt: Date.now()
            };
            
            await this.saveWizardState(chatId, wizardState);
            
            // Show first step
            await this.showTitleStep(chatId, messageId);
            
            await this.answerCallback(callbackQuery);
            
        } catch (error) {
            logger.error('Error starting apartment wizard:', error);
            await this.handleError(chatId, error, 'startWizard');
        }
    }

    // ============================================
    // WIZARD STEP HANDLERS
    // ============================================

    // Step 1: Title (text input - minimal typing)
    async showTitleStep(chatId, messageId) {
        const text = `
🏠 *Add New Apartment - Step 1/11*

Please enter the *title* of the apartment:

Example: "Luxury 2-Bedroom in Asokoro with Pool"
        `;
        
        const keyboard = {
            inline_keyboard: [
                [{ text: '❌ Cancel', callback_data: 'wizard_cancel' }]
            ]
        };
        
        await this.updateWizardMessage(chatId, messageId, text, keyboard);
    }

    // Step 2: Location (buttons)
    async showLocationStep(chatId, messageId) {
        const state = await this.getWizardState(chatId);
        const title = state.data.title || 'Apartment';
        
        const text = `
📍 *Add New Apartment - Step 2/11*

🏠 *Title:* ${title}

Now select the *location/area*:
        `;
        
        // Create location buttons in rows of 2
        const keyboard = {
            inline_keyboard: []
        };
        
        // Add location buttons in rows of 2
        for (let i = 0; i < POPULAR_LOCATIONS.length; i += 2) {
            const row = [];
            row.push({ text: POPULAR_LOCATIONS[i], callback_data: `wizard_loc_${POPULAR_LOCATIONS[i]}` });
            if (i + 1 < POPULAR_LOCATIONS.length) {
                row.push({ text: POPULAR_LOCATIONS[i + 1], callback_data: `wizard_loc_${POPULAR_LOCATIONS[i + 1]}` });
            }
            keyboard.inline_keyboard.push(row);
        }
        
        // Add "Other" option and navigation
        keyboard.inline_keyboard.push([
            { text: '✏️ Other (type)', callback_data: 'wizard_loc_other' }
        ]);
        keyboard.inline_keyboard.push([
            { text: '« Back', callback_data: 'wizard_back' },
            { text: '❌ Cancel', callback_data: 'wizard_cancel' }
        ]);
        
        await this.updateWizardMessage(chatId, messageId, text, keyboard);
    }

    // Step 3: Address (text input)
    async showAddressStep(chatId, messageId) {
        const state = await this.getWizardState(chatId);
        
        const text = `
📍 *Add New Apartment - Step 3/11*

🏠 *Title:* ${state.data.title}
📍 *Location:* ${state.data.location}

Now enter the *full street address*:

Example: "12 Bobo Street, Off Udi Hill, Asokoro"
        `;
        
        const keyboard = {
            inline_keyboard: [
                [{ text: '« Back', callback_data: 'wizard_back' }],
                [{ text: '❌ Cancel', callback_data: 'wizard_cancel' }]
            ]
        };
        
        await this.updateWizardMessage(chatId, messageId, text, keyboard);
    }

    // Step 4: Price (buttons)
    async showPriceStep(chatId, messageId) {
        const state = await this.getWizardState(chatId);
        
        const text = `
💰 *Add New Apartment - Step 4/11*

🏠 *Title:* ${state.data.title}
📍 *Location:* ${state.data.location}
📮 *Address:* ${state.data.address || 'Not set yet'}

Select the *price per night*:
        `;
        
        // Create price buttons in rows of 2
        const keyboard = {
            inline_keyboard: []
        };
        
        for (let i = 0; i < PRICE_OPTIONS.length; i += 2) {
            const row = [];
            row.push({ 
                text: PRICE_OPTIONS[i].text, 
                callback_data: `wizard_price_${PRICE_OPTIONS[i].value}` 
            });
            if (i + 1 < PRICE_OPTIONS.length) {
                row.push({ 
                    text: PRICE_OPTIONS[i + 1].text, 
                    callback_data: `wizard_price_${PRICE_OPTIONS[i + 1].value}` 
                });
            }
            keyboard.inline_keyboard.push(row);
        }
        
        keyboard.inline_keyboard.push([
            { text: '« Back', callback_data: 'wizard_back' },
            { text: '❌ Cancel', callback_data: 'wizard_cancel' }
        ]);
        
        await this.updateWizardMessage(chatId, messageId, text, keyboard);
    }

    // Step 5: Bedrooms (buttons)
    async showBedroomsStep(chatId, messageId) {
        const state = await this.getWizardState(chatId);
        
        const text = `
🛏️ *Add New Apartment - Step 5/11*

🏠 *Title:* ${state.data.title}
📍 *Location:* ${state.data.location}
💰 *Price:* ₦${state.data.pricePerNight?.toLocaleString()}/night

Select *number of bedrooms*:
        `;
        
        const keyboard = {
            inline_keyboard: []
        };
        
        for (let i = 0; i < BEDROOM_OPTIONS.length; i += 2) {
            const row = [];
            row.push({ 
                text: BEDROOM_OPTIONS[i].text, 
                callback_data: `wizard_bed_${BEDROOM_OPTIONS[i].value}` 
            });
            if (i + 1 < BEDROOM_OPTIONS.length) {
                row.push({ 
                    text: BEDROOM_OPTIONS[i + 1].text, 
                    callback_data: `wizard_bed_${BEDROOM_OPTIONS[i + 1].value}` 
                });
            }
            keyboard.inline_keyboard.push(row);
        }
        
        keyboard.inline_keyboard.push([
            { text: '« Back', callback_data: 'wizard_back' },
            { text: '❌ Cancel', callback_data: 'wizard_cancel' }
        ]);
        
        await this.updateWizardMessage(chatId, messageId, text, keyboard);
    }

    // Step 6: Bathrooms (buttons)
    async showBathroomsStep(chatId, messageId) {
        const state = await this.getWizardState(chatId);
        
        const text = `
🚿 *Add New Apartment - Step 6/11*

🏠 *Title:* ${state.data.title}
📍 *Location:* ${state.data.location}
🛏️ *Bedrooms:* ${state.data.bedrooms}

Select *number of bathrooms*:
        `;
        
        const keyboard = {
            inline_keyboard: []
        };
        
        for (let i = 0; i < BATHROOM_OPTIONS.length; i += 2) {
            const row = [];
            row.push({ 
                text: BATHROOM_OPTIONS[i].text, 
                callback_data: `wizard_bath_${BATHROOM_OPTIONS[i].value}` 
            });
            if (i + 1 < BATHROOM_OPTIONS.length) {
                row.push({ 
                    text: BATHROOM_OPTIONS[i + 1].text, 
                    callback_data: `wizard_bath_${BATHROOM_OPTIONS[i + 1].value}` 
                });
            }
            keyboard.inline_keyboard.push(row);
        }
        
        keyboard.inline_keyboard.push([
            { text: '« Back', callback_data: 'wizard_back' },
            { text: '❌ Cancel', callback_data: 'wizard_cancel' }
        ]);
        
        await this.updateWizardMessage(chatId, messageId, text, keyboard);
    }

    // Step 7: Max Guests (buttons)
    async showGuestsStep(chatId, messageId) {
        const state = await this.getWizardState(chatId);
        
        const text = `
👥 *Add New Apartment - Step 7/11*

🏠 *Title:* ${state.data.title}
📍 *Location:* ${state.data.location}
🛏️ *Bedrooms:* ${state.data.bedrooms}
🚿 *Bathrooms:* ${state.data.bathrooms}

Select *maximum number of guests*:
        `;
        
        const keyboard = {
            inline_keyboard: []
        };
        
        for (let i = 0; i < GUEST_OPTIONS.length; i += 2) {
            const row = [];
            row.push({ 
                text: GUEST_OPTIONS[i].text, 
                callback_data: `wizard_guest_${GUEST_OPTIONS[i].value}` 
            });
            if (i + 1 < GUEST_OPTIONS.length) {
                row.push({ 
                    text: GUEST_OPTIONS[i + 1].text, 
                    callback_data: `wizard_guest_${GUEST_OPTIONS[i + 1].value}` 
                });
            }
            keyboard.inline_keyboard.push(row);
        }
        
        keyboard.inline_keyboard.push([
            { text: '« Back', callback_data: 'wizard_back' },
            { text: '❌ Cancel', callback_data: 'wizard_cancel' }
        ]);
        
        await this.updateWizardMessage(chatId, messageId, text, keyboard);
    }

    // Step 8: Amenities (multi-select buttons)
    async showAmenitiesStep(chatId, messageId) {
        const state = await this.getWizardState(chatId);
        
        const selectedAmenities = state.data.amenities || [];
        
        const text = `
✨ *Add New Apartment - Step 8/11*

🏠 *Title:* ${state.data.title}
📍 *Location:* ${state.data.location}
👥 *Guests:* ${state.data.maxGuests}

Select *amenities* (click to toggle):
${selectedAmenities.length > 0 ? `\n✅ *Selected:* ${selectedAmenities.join(', ')}` : ''}

Click "Continue" when done.
        `;
        
        // Create amenity buttons in rows of 2
        const keyboard = {
            inline_keyboard: []
        };
        
        for (let i = 0; i < AMENITY_OPTIONS.length; i += 2) {
            const row = [];
            const amenity1 = AMENITY_OPTIONS[i];
            const isSelected1 = selectedAmenities.includes(amenity1);
            row.push({ 
                text: `${isSelected1 ? '✅' : '⬜'} ${amenity1}`, 
                callback_data: `wizard_amenity_${amenity1}` 
            });
            
            if (i + 1 < AMENITY_OPTIONS.length) {
                const amenity2 = AMENITY_OPTIONS[i + 1];
                const isSelected2 = selectedAmenities.includes(amenity2);
                row.push({ 
                    text: `${isSelected2 ? '✅' : '⬜'} ${amenity2}`, 
                    callback_data: `wizard_amenity_${amenity2}` 
                });
            }
            keyboard.inline_keyboard.push(row);
        }
        
        keyboard.inline_keyboard.push([
            { text: '✅ Continue to Description', callback_data: 'wizard_continue_desc' }
        ]);
        keyboard.inline_keyboard.push([
            { text: '« Back', callback_data: 'wizard_back' },
            { text: '❌ Cancel', callback_data: 'wizard_cancel' }
        ]);
        
        await this.updateWizardMessage(chatId, messageId, text, keyboard);
    }

    // Step 9: Description (optional - can skip)
    async showDescriptionStep(chatId, messageId) {
        const state = await this.getWizardState(chatId);
        
        const text = `
📝 *Add New Apartment - Step 9/11*

🏠 *Title:* ${state.data.title}
📍 *Location:* ${state.data.location}
✨ *Amenities:* ${(state.data.amenities || []).length} selected

Now add a *description* (optional):

You can:
• Describe the apartment
• Mention nearby attractions
• Add special features

Or click "Skip" to continue to photos.
        `;
        
        const keyboard = {
            inline_keyboard: [
                [{ text: '⏭️ Skip Description', callback_data: 'wizard_skip_desc' }],
                [{ text: '« Back', callback_data: 'wizard_back' }],
                [{ text: '❌ Cancel', callback_data: 'wizard_cancel' }]
            ]
        };
        
        await this.updateWizardMessage(chatId, messageId, text, keyboard);
    }

    // Step 10: Photos (upload)
    async showPhotosStep(chatId, messageId) {
        const state = await this.getWizardState(chatId);
        
        const photoCount = state.data.images?.length || 0;
        
        const text = `
📸 *Add New Apartment - Step 10/11*

🏠 *Title:* ${state.data.title}
📍 *Location:* ${state.data.location}

📸 *Photos Uploaded:* ${photoCount}

Please send photos of the apartment:
• Click the 📎 attachment icon
• Select 📷 Camera or 🖼️ Gallery
• Send photos one by one

Type *done* when finished uploading.
        `;
        
        const keyboard = {
            inline_keyboard: [
                [{ text: '« Back', callback_data: 'wizard_back' }],
                [{ text: '❌ Cancel', callback_data: 'wizard_cancel' }]
            ]
        };
        
        await this.bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
        
        // Delete the previous wizard message
        try {
            await this.bot.deleteMessage(chatId, messageId);
        } catch (e) {}
    }

    // Step 11: Review & Confirm
    async showReviewStep(chatId) {
        const state = await this.getWizardState(chatId);
        const data = state.data;
        
        const amenitiesList = data.amenities?.length > 0 
            ? data.amenities.map(a => `• ${a}`).join('\n')
            : '• None selected';
        
        const text = `
✅ *Review Your Apartment*

🏠 *Title:* ${data.title}
📍 *Location:* ${data.location}
📮 *Address:* ${data.address}
💰 *Price:* ₦${data.pricePerNight?.toLocaleString()}/night
🛏️ *Bedrooms:* ${data.bedrooms}
🚿 *Bathrooms:* ${data.bathrooms}
👥 *Max Guests:* ${data.maxGuests}

✨ *Amenities:*
${amenitiesList}

📝 *Description:*
${data.description || 'No description provided'}

📸 *Photos:* ${data.images?.length || 0} uploaded

Is everything correct?
        `;
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '✅ Confirm & Save', callback_data: 'wizard_confirm' },
                    { text: '✏️ Edit', callback_data: 'wizard_edit' }
                ],
                [
                    { text: '« Back to Photos', callback_data: 'wizard_back' },
                    { text: '❌ Cancel', callback_data: 'wizard_cancel' }
                ]
            ]
        };
        
        await this.bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    }

    // ============================================
    // CALLBACK HANDLER
    // ============================================

    async handleWizardCallback(callbackQuery) {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        try {
            // Cancel
            if (data === 'wizard_cancel') {
                await this.redis.del(`${this.wizardPrefix}${chatId}`);
                await this.bot.editMessageText('❌ Apartment creation cancelled.', {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '« Back to Admin', callback_data: 'menu_admin' }]
                        ]
                    }
                });
                await this.answerCallback(callbackQuery);
                return;
            }
            
            // Back navigation
            if (data === 'wizard_back') {
                await this.goToPreviousStep(chatId, messageId);
                await this.answerCallback(callbackQuery);
                return;
            }
            
            const state = await this.getWizardState(chatId);
            if (!state) {
                await this.bot.editMessageText('Session expired. Please start over.', {
                    chat_id: chatId,
                    message_id: messageId
                });
                await this.answerCallback(callbackQuery);
                return;
            }
            
            // Handle location selection
            if (data.startsWith('wizard_loc_')) {
                const location = data.replace('wizard_loc_', '');
                if (location === 'other') {
                    state.step = 'location_other';
                    await this.saveWizardState(chatId, state);
                    await this.bot.editMessageText(
                        '📍 *Enter Location*\n\nPlease type the location name:',
                        {
                            chat_id: chatId,
                            message_id: messageId,
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '« Back', callback_data: 'wizard_back' }],
                                    [{ text: '❌ Cancel', callback_data: 'wizard_cancel' }]
                                ]
                            }
                        }
                    );
                } else {
                    state.data.location = location;
                    state.step = 'address';
                    await this.saveWizardState(chatId, state);
                    await this.showAddressStep(chatId, messageId);
                }
                await this.answerCallback(callbackQuery);
                return;
            }
            
            // Handle price selection
            if (data.startsWith('wizard_price_')) {
                const price = data.replace('wizard_price_', '');
                if (price === 'custom') {
                    state.step = 'price_custom';
                    await this.saveWizardState(chatId, state);
                    await this.bot.editMessageText(
                        '💰 *Enter Price*\n\nPlease type the price per night (in Naira):',
                        {
                            chat_id: chatId,
                            message_id: messageId,
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '« Back', callback_data: 'wizard_back' }],
                                    [{ text: '❌ Cancel', callback_data: 'wizard_cancel' }]
                                ]
                            }
                        }
                    );
                } else {
                    state.data.pricePerNight = parseInt(price);
                    state.step = 'bedrooms';
                    await this.saveWizardState(chatId, state);
                    await this.showBedroomsStep(chatId, messageId);
                }
                await this.answerCallback(callbackQuery);
                return;
            }
            
            // Handle bedroom selection
            if (data.startsWith('wizard_bed_')) {
                const beds = data.replace('wizard_bed_', '');
                if (beds === 'custom') {
                    state.step = 'bedrooms_custom';
                    await this.saveWizardState(chatId, state);
                    await this.bot.editMessageText(
                        '🛏️ *Enter Bedrooms*\n\nPlease type the number of bedrooms:',
                        {
                            chat_id: chatId,
                            message_id: messageId,
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '« Back', callback_data: 'wizard_back' }],
                                    [{ text: '❌ Cancel', callback_data: 'wizard_cancel' }]
                                ]
                            }
                        }
                    );
                } else {
                    state.data.bedrooms = parseInt(beds);
                    state.step = 'bathrooms';
                    await this.saveWizardState(chatId, state);
                    await this.showBathroomsStep(chatId, messageId);
                }
                await this.answerCallback(callbackQuery);
                return;
            }
            
            // Handle bathroom selection
            if (data.startsWith('wizard_bath_')) {
                const baths = data.replace('wizard_bath_', '');
                if (baths === 'custom') {
                    state.step = 'bathrooms_custom';
                    await this.saveWizardState(chatId, state);
                    await this.bot.editMessageText(
                        '🚿 *Enter Bathrooms*\n\nPlease type the number of bathrooms:',
                        {
                            chat_id: chatId,
                            message_id: messageId,
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '« Back', callback_data: 'wizard_back' }],
                                    [{ text: '❌ Cancel', callback_data: 'wizard_cancel' }]
                                ]
                            }
                        }
                    );
                } else {
                    state.data.bathrooms = parseInt(baths);
                    state.step = 'maxGuests';
                    await this.saveWizardState(chatId, state);
                    await this.showGuestsStep(chatId, messageId);
                }
                await this.answerCallback(callbackQuery);
                return;
            }
            
            // Handle guest selection
            if (data.startsWith('wizard_guest_')) {
                const guests = data.replace('wizard_guest_', '');
                if (guests === 'custom') {
                    state.step = 'guests_custom';
                    await this.saveWizardState(chatId, state);
                    await this.bot.editMessageText(
                        '👥 *Enter Max Guests*\n\nPlease type the maximum number of guests:',
                        {
                            chat_id: chatId,
                            message_id: messageId,
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '« Back', callback_data: 'wizard_back' }],
                                    [{ text: '❌ Cancel', callback_data: 'wizard_cancel' }]
                                ]
                            }
                        }
                    );
                } else {
                    state.data.maxGuests = parseInt(guests);
                    state.step = 'amenities';
                    await this.saveWizardState(chatId, state);
                    await this.showAmenitiesStep(chatId, messageId);
                }
                await this.answerCallback(callbackQuery);
                return;
            }
            
            // Handle amenity toggling
            if (data.startsWith('wizard_amenity_')) {
                const amenity = data.replace('wizard_amenity_', '');
                
                if (!state.data.amenities) {
                    state.data.amenities = [];
                }
                
                const index = state.data.amenities.indexOf(amenity);
                if (index === -1) {
                    state.data.amenities.push(amenity);
                } else {
                    state.data.amenities.splice(index, 1);
                }
                
                await this.saveWizardState(chatId, state);
                await this.showAmenitiesStep(chatId, messageId);
                await this.answerCallback(callbackQuery);
                return;
            }
            
            // Continue to description
            if (data === 'wizard_continue_desc') {
                state.step = 'description';
                await this.saveWizardState(chatId, state);
                await this.showDescriptionStep(chatId, messageId);
                await this.answerCallback(callbackQuery);
                return;
            }
            
            // Skip description
            if (data === 'wizard_skip_desc') {
                state.step = 'photos';
                state.data.description = '';
                await this.saveWizardState(chatId, state);
                await this.showPhotosStep(chatId, messageId);
                await this.answerCallback(callbackQuery);
                return;
            }
            
            // Edit from review
            if (data === 'wizard_edit') {
                // Go back to title edit
                state.step = 'title';
                await this.saveWizardState(chatId, state);
                await this.showTitleStep(chatId, messageId);
                await this.answerCallback(callbackQuery);
                return;
            }
            
            // Confirm and save
            if (data === 'wizard_confirm') {
                await this.saveApartment(chatId, messageId, state);
                await this.answerCallback(callbackQuery);
                return;
            }
            
        } catch (error) {
            logger.error('Error in wizard callback:', error);
            await this.handleError(chatId, error, 'handleWizardCallback');
        }
    }

    // ============================================
    // HANDLE TEXT MESSAGES FOR CUSTOM INPUTS
    // ============================================

    async handleWizardMessage(chatId, text) {
        try {
            const state = await this.getWizardState(chatId);
            if (!state) return false;
            
            switch(state.step) {
                case 'title':
                    state.data.title = text;
                    state.step = 'location';
                    await this.saveWizardState(chatId, state);
                    await this.showLocationStep(chatId, null);
                    return true;
                    
                case 'location_other':
                    state.data.location = text;
                    state.step = 'address';
                    await this.saveWizardState(chatId, state);
                    await this.showAddressStep(chatId, null);
                    return true;
                    
                case 'address':
                    state.data.address = text;
                    state.step = 'price';
                    await this.saveWizardState(chatId, state);
                    await this.showPriceStep(chatId, null);
                    return true;
                    
                case 'price_custom':
                    const price = parseInt(text.replace(/[^0-9]/g, ''));
                    if (isNaN(price) || price < 1000) {
                        await this.bot.sendMessage(chatId,
                            '❌ *Invalid Price*\n\nPlease enter a valid price (minimum ₦1,000)',
                            { parse_mode: 'Markdown' }
                        );
                        return true;
                    }
                    state.data.pricePerNight = price;
                    state.step = 'bedrooms';
                    await this.saveWizardState(chatId, state);
                    await this.showBedroomsStep(chatId, null);
                    return true;
                    
                case 'bedrooms_custom':
                    const bedrooms = parseInt(text);
                    if (isNaN(bedrooms) || bedrooms < 0 || bedrooms > 20) {
                        await this.bot.sendMessage(chatId,
                            '❌ *Invalid Number*\n\nPlease enter a valid number of bedrooms (0-20)',
                            { parse_mode: 'Markdown' }
                        );
                        return true;
                    }
                    state.data.bedrooms = bedrooms;
                    state.step = 'bathrooms';
                    await this.saveWizardState(chatId, state);
                    await this.showBathroomsStep(chatId, null);
                    return true;
                    
                case 'bathrooms_custom':
                    const bathrooms = parseInt(text);
                    if (isNaN(bathrooms) || bathrooms < 1 || bathrooms > 20) {
                        await this.bot.sendMessage(chatId,
                            '❌ *Invalid Number*\n\nPlease enter a valid number of bathrooms (1-20)',
                            { parse_mode: 'Markdown' }
                        );
                        return true;
                    }
                    state.data.bathrooms = bathrooms;
                    state.step = 'maxGuests';
                    await this.saveWizardState(chatId, state);
                    await this.showGuestsStep(chatId, null);
                    return true;
                    
                case 'guests_custom':
                    const guests = parseInt(text);
                    if (isNaN(guests) || guests < 1 || guests > 50) {
                        await this.bot.sendMessage(chatId,
                            '❌ *Invalid Number*\n\nPlease enter a valid number of guests (1-50)',
                            { parse_mode: 'Markdown' }
                        );
                        return true;
                    }
                    state.data.maxGuests = guests;
                    state.step = 'amenities';
                    await this.saveWizardState(chatId, state);
                    await this.showAmenitiesStep(chatId, null);
                    return true;
                    
                case 'description':
                    state.data.description = text;
                    state.step = 'photos';
                    await this.saveWizardState(chatId, state);
                    await this.showPhotosStep(chatId, null);
                    return true;
                    
                case 'photos':
                    if (text.toLowerCase() === 'done') {
                        if (!state.data.images || state.data.images.length === 0) {
                            await this.bot.sendMessage(chatId,
                                '❌ *No Photos*\n\nPlease upload at least one photo before typing "done".',
                                { parse_mode: 'Markdown' }
                            );
                            return true;
                        }
                        await this.showReviewStep(chatId);
                        return true;
                    }
                    break;
            }
            
            return true;
        } catch (error) {
            logger.error('Error in wizard message:', error);
            return false;
        }
    }

    // ============================================
    // HANDLE PHOTO UPLOADS
    // ============================================

    async handleWizardPhoto(chatId, photo) {
        try {
            const state = await this.getWizardState(chatId);
            if (!state || state.step !== 'photos') return false;
            
            if (!state.data.images) {
                state.data.images = [];
            }
            
            // Get the largest photo (best quality)
            const fileId = photo[photo.length - 1].file_id;
            state.data.images.push(fileId);
            
            await this.saveWizardState(chatId, state);
            
            await this.bot.sendMessage(chatId,
                `📸 *Photo ${state.data.images.length} uploaded!*\n\nSend more or type *done* when finished.`,
                { parse_mode: 'Markdown' }
            );
            
            return true;
        } catch (error) {
            logger.error('Error handling wizard photo:', error);
            return false;
        }
    }

    // ============================================
    // SAVE APARTMENT TO DATABASE
    // ============================================

    async saveApartment(chatId, messageId, state) {
        try {
            const data = state.data;
            
            // Create the apartment
            const apartment = await Apartment.create({
                ownerId: data.ownerId,
                title: data.title,
                address: data.address,
                description: data.description || '',
                pricePerNight: data.pricePerNight,
                location: data.location,
                bedrooms: data.bedrooms,
                bathrooms: data.bathrooms,
                maxGuests: data.maxGuests,
                amenities: data.amenities || [],
                images: data.images || [],
                isApproved: true,
                isAvailable: true,
                views: 0,
                createdAt: new Date()
            });
            
            // Clear Redis state
            await this.redis.del(`${this.wizardPrefix}${chatId}`);
            
            // Success message
            const amenitiesPreview = data.amenities?.length > 0 
                ? data.amenities.slice(0, 3).join(', ') + (data.amenities.length > 3 ? '...' : '')
                : 'None listed';
            
            await this.bot.editMessageText(
                `✅ *Apartment Added Successfully!*\n\n` +
                `🏠 *${apartment.title}*\n` +
                `📍 *Area:* ${apartment.location}\n` +
                `📮 *Address:* ${apartment.address}\n` +
                `💰 *Price:* ${this.formatCurrency(apartment.pricePerNight)}/night\n` +
                `✨ *Amenities:* ${amenitiesPreview}\n` +
                `📸 *Photos:* ${data.images?.length || 0} uploaded\n\n` +
                `The apartment is now live and visible to users!`,
                {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '➕ Add Another', callback_data: 'admin_add_apartment' }],
                            [{ text: '🔙 Back to Admin', callback_data: 'menu_admin' }]
                        ]
                    }
                }
            );
            
        } catch (error) {
            logger.error('Error saving apartment:', error);
            await this.bot.sendMessage(chatId, '❌ Error saving apartment. Please try again.');
        }
    }

    // ============================================
    // NAVIGATION HELPERS
    // ============================================

    async goToPreviousStep(chatId, messageId) {
        const state = await this.getWizardState(chatId);
        if (!state) return;
        
        const steps = [
            'title', 'location', 'address', 'price', 'bedrooms',
            'bathrooms', 'maxGuests', 'amenities', 'description', 'photos'
        ];
        
        const currentIndex = steps.indexOf(state.step);
        if (currentIndex > 0) {
            const previousStep = steps[currentIndex - 1];
            state.step = previousStep;
            await this.saveWizardState(chatId, state);
            
            switch(previousStep) {
                case 'title':
                    await this.showTitleStep(chatId, messageId);
                    break;
                case 'location':
                    await this.showLocationStep(chatId, messageId);
                    break;
                case 'address':
                    await this.showAddressStep(chatId, messageId);
                    break;
                case 'price':
                    await this.showPriceStep(chatId, messageId);
                    break;
                case 'bedrooms':
                    await this.showBedroomsStep(chatId, messageId);
                    break;
                case 'bathrooms':
                    await this.showBathroomsStep(chatId, messageId);
                    break;
                case 'maxGuests':
                    await this.showGuestsStep(chatId, messageId);
                    break;
                case 'amenities':
                    await this.showAmenitiesStep(chatId, messageId);
                    break;
                case 'description':
                    await this.showDescriptionStep(chatId, messageId);
                    break;
            }
        }
    }

    async updateWizardMessage(chatId, messageId, text, keyboard) {
        try {
            if (messageId) {
                await this.bot.editMessageText(text, {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            } else {
                await this.bot.sendMessage(chatId, text, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboard
                });
            }
        } catch (error) {
            // If edit fails, send new message
            await this.bot.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
    }

    // ============================================
    // REDIS HELPERS
    // ============================================

    async getWizardState(chatId) {
        const data = await this.redis.get(`${this.wizardPrefix}${chatId}`);
        return data ? JSON.parse(data) : null;
    }

    async saveWizardState(chatId, state) {
        await this.redis.set(
            `${this.wizardPrefix}${chatId}`,
            JSON.stringify(state),
            'EX',
            3600 // 1 hour expiry
        );
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 0
        }).format(amount).replace('NGN', '₦');
    }

    async answerCallback(callbackQuery, text = null, showAlert = false) {
        try {
            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: text,
                show_alert: showAlert
            });
        } catch (error) {
            logger.error('Error answering callback:', error);
        }
    }

    async handleError(chatId, error, context) {
        logger.error(`Error in ${context}:`, error);
        await this.bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    }
}

module.exports = ApartmentWizard;

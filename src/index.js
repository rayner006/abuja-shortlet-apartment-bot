const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
require('dotenv').config();

const { getApartmentTypeKeyboard, filterApartmentsByType, formatApartmentMessage } = require('./handlers/apartmentHandler');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Express app for Railway health checks
const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || '';

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => {
    res.send('Bot is running');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

// Store selected location temporarily
const userSessions = {};

// /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    const welcomeMessage = `
 *Welcome To Abuja Shortlet Apartment*🏠

 *Choose An Option Below* 👇👇👇
    `;
    
    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [
                ['📅 View Apartment', '📞 Contact Admin'],
                ['ℹ️ About Us']
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
    
    bot.sendMessage(chatId, welcomeMessage, options);
});

// Handle button clicks
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    if (text === '📅 View Apartment') {
        bot.sendMessage(chatId, '📍 *Select Location*', {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [
                    ['Asokoro', 'Maitama'],
                    ['Wuse (Zones 1-6)', 'Garki (I & II)'],
                    ['Utako', 'Central Business District (CBD)'],
                    ['Gwarinpa', 'Wuye'],
                    ['Life Camp', 'Gaduwa'],
                    ['Apo', 'Jahi'],
                    ['Lokogoma', 'Kubwa'],
                    ['Lugbe', 'Jikwoyi'],
                    ['Gwagwalada'],
                    ['🔙 Main Menu']
                ],
                resize_keyboard: true
            }
        });
    }
    else if (text === '📞 Contact Admin') {
        bot.sendMessage(chatId, '📱 Contact us on: 08012345678\n📧 Email: support@abujashortlet.com');
    }
    else if (text === 'ℹ️ About Us') {
        bot.sendMessage(chatId, '🏢 Abuja Shortlet Apartment - Your trusted partner for shortlet apartments in Abuja.');
    }
    else if (text === '🔙 Main Menu') {
        const welcomeMessage = `
🏢 *Welcome Back!* 🏢

👇 *Choose An Option* 👇
        `;
        
        bot.sendMessage(chatId, welcomeMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [
                    ['📅 View Apartment', '📞 Contact Admin'],
                    ['ℹ️ About Us']
                ],
                resize_keyboard: true
            }
        });
    }
    else {
        // Check if the message is a location name
        const locations = [
            'Asokoro', 'Maitama', 'Wuse (Zones 1-6)', 'Garki (I & II)',
            'Utako', 'Central Business District (CBD)', 'Gwarinpa', 'Wuye',
            'Life Camp', 'Gaduwa', 'Apo', 'Jahi', 'Lokogoma', 'Kubwa',
            'Lugbe', 'Jikwoyi', 'Gwagwalada'
        ];
        
        if (locations.includes(text)) {
            // Store selected location
            userSessions[chatId] = { location: text };
            
            // Show apartment type selection
            bot.sendMessage(
                chatId, 
                `📍 *Selected Location:* ${text}\n\n🏢 *Select Apartment Type:*`,
                {
                    parse_mode: 'Markdown',
                    ...getApartmentTypeKeyboard()
                }
            );
        }
    }
});

// Handle callback queries (for inline buttons)
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;
    
    if (data.startsWith('type_')) {
        const bedroomCount = parseInt(data.split('_')[1]);
        const session = userSessions[chatId];
        
        if (!session || !session.location) {
            await bot.sendMessage(chatId, 'Please select a location first.');
            await bot.answerCallbackQuery(callbackQuery.id);
            return;
        }
        
        const location = session.location;
        
        // Send "Searching..." message
        await bot.sendMessage(chatId, `🔍 Searching for ${bedroomCount === 0 ? 'Studio' : bedroomCount + '-Bedroom'} apartments in ${location}...`);
        
        try {
            const apartments = await filterApartmentsByType(location, bedroomCount);
            
            if (!apartments || apartments.length === 0) {
                await bot.sendMessage(
                    chatId, 
                    `No ${bedroomCount === 0 ? 'Studio' : bedroomCount + '-Bedroom'} apartments found in ${location}.`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔙 Back to Types', callback_data: 'back_to_types' }]
                            ]
                        }
                    }
                );
            } else {
                for (const apt of apartments) {
                    // Send the apartment details first
                    await bot.sendMessage(chatId, formatApartmentMessage(apt), {
                        parse_mode: 'Markdown'
                    });
                    
                    // Send photos if they exist
                    if (apt.photo_paths) {
                        try {
                            const photos = typeof apt.photo_paths === 'string' 
                                ? JSON.parse(apt.photo_paths) 
                                : apt.photo_paths;
                            
                            if (Array.isArray(photos) && photos.length > 0) {
                                // Send up to 5 photos
                                const photosToSend = photos.slice(0, 5);
                                
                                for (const photoPath of photosToSend) {
                                    try {
                                        // If it's a local path, prepend PUBLIC_URL
                                        if (!photoPath.startsWith('http')) {
                                            const photoUrl = `${PUBLIC_URL}/${photoPath}`;
                                            await bot.sendPhoto(chatId, photoUrl);
                                        } else {
                                            await bot.sendPhoto(chatId, photoPath);
                                        }
                                        // Small delay to avoid flooding
                                        await new Promise(resolve => setTimeout(resolve, 500));
                                    } catch (photoError) {
                                        console.log('Failed to send photo:', photoPath, photoError.message);
                                    }
                                }
                            }
                        } catch (e) {
                            console.log('Error parsing photos for apartment', apt.id, e);
                        }
                    }
                    
                    // Send action buttons after photos
                    await bot.sendMessage(chatId, 'Choose an action:', {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📅 Book Now', callback_data: `book_${apt.id}` }],
                                [{ text: '🔙 Back to Types', callback_data: 'back_to_types' }]
                            ]
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching apartments:', error);
            await bot.sendMessage(chatId, '❌ An error occurred while searching. Please try again.');
        }
        
        await bot.answerCallbackQuery(callbackQuery.id);
    }
    else if (data === 'back_to_types') {
        const session = userSessions[chatId];
        if (session && session.location) {
            await bot.sendMessage(
                chatId,
                `📍 *Location:* ${session.location}\n\n🏢 *Select Apartment Type:*`,
                {
                    parse_mode: 'Markdown',
                    ...getApartmentTypeKeyboard()
                }
            );
        } else {
            await bot.sendMessage(chatId, 'Please select a location first.');
        }
        await bot.answerCallbackQuery(callbackQuery.id);
    }
    else if (data === 'back_to_locations') {
        await bot.sendMessage(chatId, '📍 *Select Location*', {
            parse_mode: 'Markdown',
            reply_markup: {
                keyboard: [
                    ['Asokoro', 'Maitama'],
                    ['Wuse (Zones 1-6)', 'Garki (I & II)'],
                    ['Utako', 'Central Business District (CBD)'],
                    ['Gwarinpa', 'Wuye'],
                    ['Life Camp', 'Gaduwa'],
                    ['Apo', 'Jahi'],
                    ['Lokogoma', 'Kubwa'],
                    ['Lugbe', 'Jikwoyi'],
                    ['Gwagwalada'],
                    ['🔙 Main Menu']
                ],
                resize_keyboard: true
            }
        });
        await bot.answerCallbackQuery(callbackQuery.id);
    }
    else if (data.startsWith('book_')) {
        const apartmentId = data.split('_')[1];
        await bot.sendMessage(chatId, `📅 Booking feature coming soon for apartment ID: ${apartmentId}`);
        await bot.answerCallbackQuery(callbackQuery.id);
    }
});

console.log('Bot is running...');

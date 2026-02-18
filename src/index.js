const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
require('dotenv').config();

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Express app for Railway health checks
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

// /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    const welcomeMessage = `
 *Welcome To Abuja Shortlet Apartment!*🏠

 *Choose An Option Below* 👇👇👇
    `;
    
    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [
                ['📅 View Apartment', '📞 Contact Support'],
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
                    ['Wuse 2', 'Jabi'],
                    ['🔙 Main Menu']
                ],
                resize_keyboard: true
            }
        });
    }
    else if (text === '📞 Contact Support') {
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
                    ['📅 View Apartment', '📞 Contact Support'],
                    ['ℹ️ About Us']
                ],
                resize_keyboard: true
            }
        });
    }
});

console.log('Bot is running...');

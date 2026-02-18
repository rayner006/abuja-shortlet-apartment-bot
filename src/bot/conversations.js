// src/bot/conversations.js
const logger = require('../config/logger');
const redis = require('../config/redis');
const { processSearch, searchState } = require('../controllers/apartmentController');
const { processBookingDates, processBookingGuests, bookingState } = require('../controllers/bookingController');

const handleMessage = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  try {
    // Check if user is in a search conversation
    if (searchState[chatId] && searchState[chatId].step === 'awaiting_input') {
      await processSearch(bot, msg);
      return;
    }
    
    // Check if user is in a booking conversation
    if (bookingState[chatId]) {
      if (bookingState[chatId].step === 'dates') {
        await processBookingDates(bot, msg);
        return;
      } else if (bookingState[chatId].step === 'guests') {
        await processBookingGuests(bot, msg);
        return;
      }
    }
    
    // Handle contact sharing
    if (msg.contact) {
      const { User } = require('../models');
      const user = await User.findOne({ where: { telegramId: msg.from.id } });
      
      if (user) {
        user.phone = msg.contact.phone_number;
        await user.save();
        await bot.sendMessage(chatId, '✅ Phone number saved successfully!');
      }
      return;
    }
    
    // Handle location sharing
    if (msg.location) {
      await bot.sendMessage(chatId, 
        '📍 Location received! Use /search to find apartments near you.'
      );
      return;
    }
    
    // Default response for unrecognized messages
    await bot.sendMessage(chatId, 
      "I didn't understand that command. Use /menu to see available options or /help for assistance."
    );
    
  } catch (error) {
    logger.error('Message handler error:', error);
    bot.sendMessage(chatId, 'An error occurred. Please try again.');
  }
};

// Conversation cancellation handler
const cancelConversation = async (bot, msg) => {
  const chatId = msg.chat.id;
  
  // Clear any active conversations
  if (searchState[chatId]) {
    delete searchState[chatId];
  }
  if (bookingState[chatId]) {
    delete bookingState[chatId];
  }
  
  await bot.sendMessage(chatId, 
    '❌ Conversation cancelled. Use /menu to start over.'
  );
};

module.exports = {
  handleMessage,
  cancelConversation
};

// src/controllers/apartmentController.js
const { Apartment, User, Booking } = require('../models');
const { Op } = require('sequelize');
const { createApartmentKeyboard } = require('../utils/keyboards');
const { formatCurrency } = require('../utils/helpers');
const logger = require('../config/logger');
const redis = require('../config/redis');

// Search states (for conversation)
const searchState = {};

const handleSearch = async (bot, msg) => {
  const chatId = msg.chat.id;
  
  const searchText = `
🔍 *Search Apartments*

Please enter your search criteria in one of these formats:

1. *Simple search:* Just type a location (e.g., "Wuse 2", "Maitama")
2. *Advanced:* location, max price, guests (e.g., "Wuse 2, 50000, 2")
3. *Specific:* /search location price\\_min price\\_max guests

Examples:
• "Wuse 2"
• "Maitama, 100000, 4"
• /search wuse 20000 50000 3

What would you like to search for?
  `;
  
  searchState[chatId] = { step: 'awaiting_input' };
  
  await bot.sendMessage(chatId, searchText, { parse_mode: 'Markdown' });
};

const processSearch = async (bot, msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  try {
    let location = text;
    let maxPrice = null;
    let guests = null;
    
    // Parse advanced search if commas exist
    if (text.includes(',')) {
      const parts = text.split(',').map(p => p.trim());
      location = parts[0];
      maxPrice = parts[1] ? parseFloat(parts[1]) : null;
      guests = parts[2] ? parseInt(parts[2]) : null;
    }
    
    // Build query
    const whereClause = {
      isApproved: true,
      isAvailable: true
    };
    
    if (location && location !== '') {
      whereClause[Op.or] = [
        { location: { [Op.like]: `%${location}%` } },
        { title: { [Op.like]: `%${location}%` } }
      ];
    }
    
    if (maxPrice) {
      whereClause.pricePerNight = { [Op.lte]: maxPrice };
    }
    
    if (guests) {
      whereClause.maxGuests = { [Op.gte]: guests };
    }
    
    const apartments = await Apartment.findAll({
      where: whereClause,
      include: [{
        model: User,
        attributes: ['id', 'firstName', 'username']
      }],
      order: [['created_at', 'DESC']],
      limit: 20
    });
    
    if (apartments.length === 0) {
      await bot.sendMessage(chatId, 
        '😕 No apartments found matching your criteria.\n\n' +
        'Try:\n' +
        '• Using a different location\n' +
        '• Increasing your budget\n' +
        '• Reducing the number of guests\n' +
        '• Checking back later for new listings'
      );
      return;
    }
    
    await bot.sendMessage(chatId, 
      `✅ Found ${apartments.length} apartment(s) matching your search:\n`
    );
    
    for (const apt of apartments) {
      await sendApartmentDetails(bot, chatId, apt);
    }
    
    delete searchState[chatId];
    
  } catch (error) {
    logger.error('Search processing error:', error);
    bot.sendMessage(chatId, 'Error processing search. Please try again.');
  }
};

const sendApartmentDetails = async (bot, chatId, apartment) => {
  try {
    // Increment view count
    apartment.views += 1;
    await apartment.save();
    
    const amenities = apartment.amenities || [];
    const amenitiesList = amenities.slice(0, 5).map(a => `• ${a}`).join('\n');
    
    const details = `
🏠 *

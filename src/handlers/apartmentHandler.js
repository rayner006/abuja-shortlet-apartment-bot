const db = require('../config/database');
require('dotenv').config();

const PUBLIC_URL = process.env.PUBLIC_URL || '';

function getApartmentTypes() {
    return [
        { name: 'Studio Apartment', emoji: '🏢', bedrooms: 0 },
        { name: '1-Bedroom', emoji: '🛏️', bedrooms: 1 },
        { name: '2-Bedroom', emoji: '🛏️', bedrooms: 2 },
        { name: '3-Bedroom', emoji: '🛏️', bedrooms: 3 }
    ];
}

async function filterApartmentsByType(location, bedroomCount) {
    try {
        let query;
        let params = [location];
        
        if (bedroomCount === 0) {
            query = `
                SELECT a.*, po.business_name, po.phone, po.telegram_chat_id 
                FROM apartments a 
                LEFT JOIN property_owners po ON a.property_owner_id = po.id 
                WHERE a.location = ? AND (a.type = 'studio' OR a.type LIKE '%studio%')
            `;
        } else {
            query = `
                SELECT a.*, po.business_name, po.phone, po.telegram_chat_id 
                FROM apartments a 
                LEFT JOIN property_owners po ON a.property_owner_id = po.id 
                WHERE a.location = ? AND a.bedrooms = ?
            `;
            params.push(bedroomCount);
        }
        
        const [rows] = await db.query(query, params);
        return rows;
    } catch (error) {
        console.error('Error filtering apartments:', error);
        return [];
    }
}

function formatApartmentMessage(apartment) {
    let message = `
🏠 *${apartment.name || apartment.title}*
📍 ${apartment.location}
💰 ₦${apartment.price || apartment.price_per_night}/night
🛏️ ${apartment.bedrooms} Bedroom(s) | 🚿 ${apartment.bathrooms} Bathroom(s)
    `;

    if (apartment.business_name) {
        message += `👔 *Owner:* ${apartment.business_name}\n`;
    }

    message += `
📝 *Description:*
${apartment.description || 'No description available'}
    `;

    return message;
}

function getApartmentTypeKeyboard() {
    const types = getApartmentTypes();
    const keyboard = [];
    
    for (let i = 0; i < types.length; i += 2) {
        const row = [];
        row.push({ text: `${types[i].emoji} ${types[i].name}`, callback_data: `type_${types[i].bedrooms}` });
        
        if (i + 1 < types.length) {
            row.push({ text: `${types[i+1].emoji} ${types[i+1].name}`, callback_data: `type_${types[i+1].bedrooms}` });
        }
        
        keyboard.push(row);
    }
    
    keyboard.push([{ text: '🔙 Back to Locations', callback_data: 'back_to_locations' }]);
    
    return {
        reply_markup: {
            inline_keyboard: keyboard
        }
    };
}

module.exports = {
    getApartmentTypes,
    filterApartmentsByType,
    formatApartmentMessage,
    getApartmentTypeKeyboard
};

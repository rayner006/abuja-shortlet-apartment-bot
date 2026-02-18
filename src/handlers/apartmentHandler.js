const db = require('../config/database');

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
            // Studio apartments
            query = "SELECT * FROM apartments WHERE location = ? AND (title LIKE '%studio%' OR type = 'studio')";
        } else {
            query = "SELECT * FROM apartments WHERE location = ? AND bedrooms = ?";
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
    return `
🏠 *${apartment.title}*
📍 ${apartment.location}
💰 ₦${apartment.price}/night
🛏️ ${apartment.bedrooms} Bedroom(s) | 🚿 ${apartment.bathrooms} Bathroom(s)
👥 Max ${apartment.max_guests} guests
⭐ Rating: ${apartment.rating || 'New'}/5

📝 *Description:*
${apartment.description}

✨ *Amenities:* ${apartment.amenities ? apartment.amenities.join(' • ') : 'Standard amenities'}
    `;
}

function getApartmentTypeKeyboard() {
    const types = getApartmentTypes();
    const keyboard = [];
    
    // Create rows of 2 buttons each
    for (let i = 0; i < types.length; i += 2) {
        const row = [];
        row.push({ text: `${types[i].emoji} ${types[i].name}`, callback_data: `type_${types[i].bedrooms}` });
        
        if (i + 1 < types.length) {
            row.push({ text: `${types[i+1].emoji} ${types[i+1].name}`, callback_data: `type_${types[i+1].bedrooms}` });
        }
        
        keyboard.push(row);
    }
    
    // Add back button
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

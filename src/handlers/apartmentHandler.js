const { getApartmentsByLocation } = require('../data/apartments');

function getApartmentTypes() {
    return [
        { name: 'Studio Apartment', emoji: '🏢', bedrooms: 0 },
        { name: '1-Bedroom', emoji: '🛏️', bedrooms: 1 },
        { name: '2-Bedroom', emoji: '🛏️', bedrooms: 2 },
        { name: '3-Bedroom', emoji: '🛏️', bedrooms: 3 }
    ];
}

function filterApartmentsByType(location, bedroomCount) {
    const apartments = getApartmentsByLocation(location);
    
    if (bedroomCount === 0) {
        // Studio apartments (bedrooms = 1 but studio type)
        return apartments.filter(apt => 
            apt.title.toLowerCase().includes('studio') || 
            (apt.bedrooms === 1 && apt.title.toLowerCase().includes('studio'))
        );
    } else {
        return apartments.filter(apt => apt.bedrooms === bedroomCount);
    }
}

function formatApartmentMessage(apartment) {
    return `
🏠 *${apartment.title}*
📍 ${apartment.location}
💰 ${apartment.price}
🛏️ ${apartment.bedrooms} Bedroom(s) | 🚿 ${apartment.bathrooms} Bathroom(s)
👥 Max ${apartment.max_guests} guests
⭐ Rating: ${apartment.rating}/5

📝 *Description:*
${apartment.description}

✨ *Amenities:* ${apartment.amenities.join(' • ')}
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

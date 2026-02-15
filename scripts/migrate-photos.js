require('dotenv').config({ path: '../.env' });
const { connectDatabase } = require('../src/config/database');
const Apartment = require('../src/models/Apartment');
const logger = require('../src/middleware/logger');

async function migrateApartmentPhotos() {
  try {
    await connectDatabase();
    logger.info('Starting photo migration...');
    
    const apartments = await Apartment.findAll();
    logger.info(`Found ${apartments.length} apartments to check`);
    
    let updatedCount = 0;
    
    for (const apt of apartments) {
      const currentPhotos = Apartment.processPhotos(apt);
      
      if (currentPhotos.length === 0) {
        logger.info(`Attempting to discover photos for: ${apt.name} (ID: ${apt.id})`);
        
        const updated = await Apartment.updatePhotoPaths(
          apt.id,
          apt.location,
          apt.owner_id,
          apt.type
        );
        
        if (updated) {
          logger.info(`✅ Updated photos for ${apt.name}`);
          updatedCount++;
        }
      } else {
        logger.info(`✅ ${apt.name} already has ${currentPhotos.length} photos`);
      }
    }
    
    logger.info(`Migration complete! Updated ${updatedCount} apartments.`);
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateApartmentPhotos();
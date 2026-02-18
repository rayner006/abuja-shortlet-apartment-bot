// scripts/migrate-photos.js
require('dotenv').config();
const { Sequelize } = require('sequelize');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: console.log
  }
);

const migratePhotos = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected');
    
    // Get all apartments
    const [apartments] = await sequelize.query(
      'SELECT id, images FROM apartments WHERE images IS NOT NULL'
    );
    
    console.log(`Found ${apartments.length} apartments with photos`);
    
    for (const apt of apartments) {
      try {
        let images = apt.images;
        
        // If images is a string, parse it
        if (typeof images === 'string') {
          images = JSON.parse(images);
        }
        
        if (Array.isArray(images) && images.length > 0) {
          console.log(`Processing apartment ${apt.id} with ${images.length} photos`);
          
          // Check each image if it's a file_id or URL
          const migratedImages = [];
          
          for (const img of images) {
            // If it's a URL, we might want to upload to Telegram to get file_id
            if (img.startsWith('http')) {
              console.log(`  URL detected: ${img.substring(0, 50)}...`);
              // You would need to implement Telegram file upload here
              // For now, keep as is
              migratedImages.push(img);
            } else {
              // Already a file_id
              migratedImages.push(img);
            }
          }
          
          // Update with migrated images
          await sequelize.query(
            'UPDATE apartments SET images = ? WHERE id = ?',
            {
              replacements: [JSON.stringify(migratedImages), apt.id]
            }
          );
          
          console.log(`  ✅ Apartment ${apt.id} updated`);
        }
      } catch (error) {
        console.error(`Error processing apartment ${apt.id}:`, error.message);
      }
    }
    
    console.log('Photo migration completed');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sequelize.close();
  }
};

// Run migration
migratePhotos();

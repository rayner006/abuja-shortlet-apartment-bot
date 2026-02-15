const { executeQuery } = require('../config/database');
const { getApartmentPhotos, buildPhotoPath } = require('../config/uploads');
const logger = require('../middleware/logger');

class Apartment {
  static async findByLocationAndType(location, type, verified = true) {
    const cleanLocation = location.replace(/[🏛️🏘️💰🏭]/g, '').trim();
    const cleanType = type.replace('🛏️ ', '').trim();
    
    const query = `
      SELECT * FROM apartments 
      WHERE location = ? AND type = ? AND verified = ?
      ORDER BY price
    `;
    
    try {
      return await executeQuery(query, [cleanLocation, cleanType, verified ? 1 : 0]);
    } catch (err) {
      logger.error('Error fetching apartments:', err);
      throw err;
    }
  }
  
  static async findById(id) {
    const query = 'SELECT * FROM apartments WHERE id = ?';
    try {
      const rows = await executeQuery(query, [id]);
      return rows[0] || null;
    } catch (err) {
      logger.error(`Error fetching apartment ${id}:`, err);
      throw err;
    }
  }
  
  static async findAll() {
    const query = 'SELECT * FROM apartments';
    try {
      return await executeQuery(query);
    } catch (err) {
      logger.error('Error fetching all apartments:', err);
      throw err;
    }
  }
  
  static processPhotos(apt) {
    let photoPaths = [];
    
    try {
      // CASE 1: If photo_paths exists in database
      if (apt.photo_paths) {
        if (typeof apt.photo_paths === 'string') {
          if (apt.photo_paths === 'NULL' || apt.photo_paths === 'null' || apt.photo_paths === '') {
            photoPaths = [];
          } else {
            try {
              photoPaths = JSON.parse(apt.photo_paths);
            } catch (e) {
              if (apt.photo_paths.includes(',')) {
                photoPaths = apt.photo_paths.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
              } else {
                photoPaths = [apt.photo_paths];
              }
            }
          }
        } else if (Array.isArray(apt.photo_paths)) {
          photoPaths = apt.photo_paths;
        }
      } 
      // CASE 2: If photos field exists (legacy)
      else if (apt.photos) {
        photoPaths = apt.photos.split(',').map(p => p.trim());
      }
      
      // CASE 3: If no photos in database, try to discover them from folder structure
      if (photoPaths.length === 0 && apt.location && apt.owner_id) {
        let ownerFolder = 'rayner_apt';
        if (apt.owner_id === 1) ownerFolder = 'rayner_apt';
        
        const locationFolder = apt.location.toLowerCase();
        
        let typeFolder = '';
        if (apt.type === 'Self Contain') typeFolder = 'self-contain';
        else if (apt.type === '1-Bedroom') typeFolder = '1-bedroom';
        else if (apt.type === '2-Bedroom') typeFolder = '2-bedroom';
        else if (apt.type === '3-Bedroom') typeFolder = '3-bedroom';
        
        if (locationFolder && ownerFolder && typeFolder) {
          const discoveredPhotos = getApartmentPhotos(locationFolder, ownerFolder, typeFolder);
          if (discoveredPhotos.length > 0) {
            photoPaths = discoveredPhotos;
            logger.info(`Discovered ${discoveredPhotos.length} photos for ${apt.name} from folder structure`);
          }
        }
      }
      
    } catch (e) {
      logger.error('Error processing photos:', e);
      photoPaths = [];
    }
    
    return photoPaths;
  }
  
  static async updatePhotoPaths(apartmentId, location, ownerId, apartmentType) {
    try {
      let ownerFolder = 'rayner_apt';
      if (ownerId === 1) ownerFolder = 'rayner_apt';
      
      const locationFolder = location.toLowerCase();
      
      let typeFolder = '';
      if (apartmentType === 'Self Contain') typeFolder = 'self-contain';
      else if (apartmentType === '1-Bedroom') typeFolder = '1-bedroom';
      else if (apartmentType === '2-Bedroom') typeFolder = '2-bedroom';
      else if (apartmentType === '3-Bedroom') typeFolder = '3-bedroom';
      
      if (!typeFolder) return false;
      
      const photos = getApartmentPhotos(locationFolder, ownerFolder, typeFolder);
      
      if (photos.length > 0) {
        const photoPathsJson = JSON.stringify(photos);
        const query = 'UPDATE apartments SET photo_paths = ? WHERE id = ?';
        await executeQuery(query, [photoPathsJson, apartmentId]);
        
        logger.info(`Updated photo paths for apartment ${apartmentId} with ${photos.length} photos`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Error updating photo paths:', error);
      return false;
    }
  }
}

module.exports = Apartment;
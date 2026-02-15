const path = require('path');
const fs = require('fs');
const logger = require('../middleware/logger');

// Get the project root directory (where uploads folder lives)
const PROJECT_ROOT = path.join(__dirname, '../..');
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'uploads');

/**
 * Configuration for handling apartment photos
 * Based on your structure: uploads/kubwa/rayner_apt/[type]/[filename]
 */
module.exports = {
  PROJECT_ROOT,
  UPLOADS_DIR,
  
  /**
   * Get the full file system path for a photo
   * @param {string} relativePath - Path from database (e.g., "uploads/kubwa/rayner_apt/1-bedroom/photo1.jpg")
   * @returns {string|null} Full path or null if invalid
   */
  getUploadPath: (relativePath) => {
    if (!relativePath) {
      logger.warn('getUploadPath called with null/undefined path');
      return null;
    }
    
    try {
      // Clean the path - remove any quotes, extra spaces, or ./ at the beginning
      const cleanPath = relativePath
        .replace(/^["']|["']$/g, '')           // Remove surrounding quotes
        .replace(/^\.\//, '')                   // Remove leading ./
        .trim();
      
      // If it's already an absolute path, verify it exists
      if (path.isAbsolute(cleanPath)) {
        if (fs.existsSync(cleanPath)) {
          return cleanPath;
        }
        logger.warn(`Absolute path does not exist: ${cleanPath}`);
        return null;
      }
      
      // If it starts with 'uploads/', join with project root
      if (cleanPath.startsWith('uploads/')) {
        const fullPath = path.join(PROJECT_ROOT, cleanPath);
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
        
        // Try alternative path formats
        const alternativePath = path.join(PROJECT_ROOT, 'uploads', path.basename(cleanPath));
        if (fs.existsSync(alternativePath)) {
          return alternativePath;
        }
        
        logger.warn(`Upload path not found: ${fullPath}`);
        return fullPath;
      }
      
      // Otherwise, assume it's a filename and look in the uploads directory
      const fullPath = path.join(UPLOADS_DIR, cleanPath);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
      
      // Try to find it in the nested structure
      const possiblePaths = [
        path.join(UPLOADS_DIR, 'kubwa', 'rayner_apt', '1-bedroom', cleanPath),
        path.join(UPLOADS_DIR, 'kubwa', 'rayner_apt', '2-bedroom', cleanPath),
        path.join(UPLOADS_DIR, 'kubwa', 'rayner_apt', '3-bedroom', cleanPath),
        path.join(UPLOADS_DIR, 'kubwa', 'rayner_apt', 'self-contain', cleanPath)
      ];
      
      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          logger.info(`Found photo at alternative path: ${testPath}`);
          return testPath;
        }
      }
      
      logger.warn(`Could not find photo: ${cleanPath} in any expected location`);
      return fullPath;
      
    } catch (error) {
      logger.error('Error in getUploadPath:', error);
      return null;
    }
  },
  
  /**
   * Helper specifically for Rayner's apartments in Kubwa
   * @param {string} apartmentType - "1-bedroom", "2-bedroom", "3-bedroom", or "self-contain"
   * @param {string} filename - The photo filename
   * @returns {string} Relative path for database storage
   */
  getRaynerPhotoPath: (apartmentType, filename) => {
    const validTypes = ['1-bedroom', '2-bedroom', '3-bedroom', 'self-contain'];
    
    if (!validTypes.includes(apartmentType)) {
      logger.warn(`Invalid apartment type for Rayner: ${apartmentType}`);
      apartmentType = '1-bedroom';
    }
    
    return path.join('uploads', 'kubwa', 'rayner_apt', apartmentType, filename);
  },
  
  /**
   * Generic function to build photo path
   */
  buildPhotoPath: (location, owner, apartmentType, filename) => {
    return path.join('uploads', location, owner, apartmentType, filename);
  },
  
  /**
   * Check if a photo exists
   */
  photoExists: (photoPath) => {
    if (!photoPath) return false;
    
    try {
      const fullPath = module.exports.getUploadPath(photoPath);
      return fullPath ? fs.existsSync(fullPath) : false;
    } catch (error) {
      logger.error('Error checking if photo exists:', error);
      return false;
    }
  },
  
  /**
   * Get all photos for a specific apartment
   */
  getApartmentPhotos: (location, owner, apartmentType) => {
    const folderPath = path.join(UPLOADS_DIR, location, owner, apartmentType);
    
    try {
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);
        return files.filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
        }).map(file => path.join('uploads', location, owner, apartmentType, file));
      }
    } catch (error) {
      logger.error(`Error reading apartment photos from ${folderPath}:`, error);
    }
    
    return [];
  }
};
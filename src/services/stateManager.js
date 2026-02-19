// src/services/stateManager.js
const logger = require('../config/logger');

/**
 * Professional State Management System
 * Manages all user conversation states in one place
 */
class StateManager {
  constructor() {
    this.searchStates = new Map();
    this.bookingStates = new Map();
    this.locationStates = new Map();
    this.apartmentStates = new Map();
  }

  // ============================================
  // Search States
  // ============================================
  
  setSearchState(userId, state) {
    this.searchStates.set(userId, {
      ...state,
      updatedAt: new Date().toISOString()
    });
    logger.debug(`Search state set for user ${userId}:`, state);
  }

  getSearchState(userId) {
    return this.searchStates.get(userId);
  }

  hasSearchState(userId) {
    return this.searchStates.has(userId);
  }

  clearSearchState(userId) {
    const deleted = this.searchStates.delete(userId);
    if (deleted) {
      logger.debug(`Search state cleared for user ${userId}`);
    }
    return deleted;
  }

  // ============================================
  // Booking States
  // ============================================
  
  setBookingState(userId, state) {
    this.bookingStates.set(userId, {
      ...state,
      updatedAt: new Date().toISOString()
    });
    logger.debug(`Booking state set for user ${userId}:`, state);
  }

  getBookingState(userId) {
    return this.bookingStates.get(userId);
  }

  hasBookingState(userId) {
    return this.bookingStates.has(userId);
  }

  clearBookingState(userId) {
    const deleted = this.bookingStates.delete(userId);
    if (deleted) {
      logger.debug(`Booking state cleared for user ${userId}`);
    }
    return deleted;
  }

  // ============================================
  // Location States
  // ============================================
  
  setLocationState(userId, state) {
    this.locationStates.set(userId, {
      ...state,
      updatedAt: new Date().toISOString()
    });
  }

  getLocationState(userId) {
    return this.locationStates.get(userId);
  }

  clearLocationState(userId) {
    return this.locationStates.delete(userId);
  }

  // ============================================
  // Apartment States (for adding/editing)
  // ============================================
  
  setApartmentState(userId, state) {
    this.apartmentStates.set(userId, {
      ...state,
      updatedAt: new Date().toISOString()
    });
  }

  getApartmentState(userId) {
    return this.apartmentStates.get(userId);
  }

  clearApartmentState(userId) {
    return this.apartmentStates.delete(userId);
  }

  // ============================================
  // Clear all states for a user (logout/reset)
  // ============================================
  
  clearAllStates(userId) {
    this.clearSearchState(userId);
    this.clearBookingState(userId);
    this.clearLocationState(userId);
    this.clearApartmentState(userId);
    logger.info(`All states cleared for user ${userId}`);
  }

  // ============================================
  // Cleanup old states (optional, run periodically)
  // ============================================
  
  cleanupOldStates(maxAgeHours = 24) {
    const now = new Date();
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
    
    const cleanupMap = (map, mapName) => {
      for (const [userId, state] of map.entries()) {
        if (state.updatedAt) {
          const updatedTime = new Date(state.updatedAt).getTime();
          if (now - updatedTime > maxAge) {
            map.delete(userId);
            logger.debug(`Cleaned up old ${mapName} state for user ${userId}`);
          }
        }
      }
    };
    
    cleanupMap(this.searchStates, 'search');
    cleanupMap(this.bookingStates, 'booking');
    cleanupMap(this.locationStates, 'location');
    cleanupMap(this.apartmentStates, 'apartment');
    
    logger.info('State cleanup completed');
  }

  // ============================================
  // Get stats
  // ============================================
  
  getStats() {
    return {
      searchStates: this.searchStates.size,
      bookingStates: this.bookingStates.size,
      locationStates: this.locationStates.size,
      apartmentStates: this.apartmentStates.size,
      total: this.searchStates.size + this.bookingStates.size + 
             this.locationStates.size + this.apartmentStates.size
    };
  }
}

// Export a singleton instance
const stateManager = new StateManager();

// Optional: Run cleanup every hour
setInterval(() => {
  stateManager.cleanupOldStates(24);
}, 60 * 60 * 1000);

module.exports = stateManager;

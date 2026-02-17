const db = require('../config/db');
const logger = require('../middleware/logger');

class ApartmentService {
  /* ================= GET ALL LOCATIONS ================= */
  static async getLocations() {
    try {
      const [rows] = await db.query(
        'SELECT DISTINCT location FROM apartments WHERE is_active = 1 ORDER BY location ASC'
      );
      return rows.map(r => r.location);
    } catch (error) {
      logger.error('Error fetching locations:', error);
      throw error;
    }
  }

  /* ================= GET APARTMENTS BY LOCATION ================= */
  static async getByLocation(location) {
    try {
      const [rows] = await db.query(
        `SELECT id, title, price_per_night, location, cover_photo 
         FROM apartments 
         WHERE location = ? AND is_active = 1
         ORDER BY created_at DESC`,
        [location]
      );

      return rows;
    } catch (error) {
      logger.error('Error fetching apartments by location:', error);
      throw error;
    }
  }

  /* ================= GET APARTMENT BY ID ================= */
  static async getById(id) {
    try {
      const [rows] = await db.query(
        `SELECT * FROM apartments WHERE id = ? LIMIT 1`,
        [id]
      );

      return rows[0] || null;
    } catch (error) {
      logger.error('Error fetching apartment by ID:', error);
      throw error;
    }
  }

  /* ================= GET APARTMENT PHOTOS ================= */
  static async getPhotos(apartmentId) {
    try {
      const [rows] = await db.query(
        `SELECT photo_url 
         FROM apartment_photos 
         WHERE apartment_id = ?
         ORDER BY id ASC`,
        [apartmentId]
      );

      return rows.map(r => r.photo_url);
    } catch (error) {
      logger.error('Error fetching apartment photos:', error);
      throw error;
    }
  }

  /* ================= CREATE APARTMENT (ADMIN/OWNER) ================= */
  static async create(data) {
    try {
      const {
        title,
        description,
        price_per_night,
        location,
        owner_id,
        cover_photo
      } = data;

      const [result] = await db.query(
        `INSERT INTO apartments 
        (title, description, price_per_night, location, owner_id, cover_photo, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          title,
          description,
          price_per_night,
          location,
          owner_id,
          cover_photo
        ]
      );

      return result.insertId;
    } catch (error) {
      logger.error('Error creating apartment:', error);
      throw error;
    }
  }

  /* ================= ADD PHOTO ================= */
  static async addPhoto(apartmentId, photoUrl) {
    try {
      await db.query(
        `INSERT INTO apartment_photos (apartment_id, photo_url)
         VALUES (?, ?)`,
        [apartmentId, photoUrl]
      );
    } catch (error) {
      logger.error('Error adding apartment photo:', error);
      throw error;
    }
  }

  /* ================= UPDATE APARTMENT ================= */
  static async update(id, data) {
    try {
      const fields = [];
      const values = [];

      for (const key in data) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }

      values.push(id);

      await db.query(
        `UPDATE apartments SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    } catch (error) {
      logger.error('Error updating apartment:', error);
      throw error;
    }
  }

  /* ================= DEACTIVATE ================= */
  static async deactivate(id) {
    try {
      await db.query(
        `UPDATE apartments SET is_active = 0 WHERE id = ?`,
        [id]
      );
    } catch (error) {
      logger.error('Error deactivating apartment:', error);
      throw error;
    }
  }
}

module.exports = ApartmentService;

// src/models/Apartment.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Apartment = sequelize.define('Apartment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  ownerId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'owner_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  pricePerNight: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'price_per_night'
  },
  location: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  address: {
    type: DataTypes.TEXT
  },
  bedrooms: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  bathrooms: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  maxGuests: {
    type: DataTypes.INTEGER,
    defaultValue: 2,
    field: 'max_guests'
  },
  amenities: {
    type: DataTypes.JSON
  },
  images: {
    type: DataTypes.JSON
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_available'
  },
  isApproved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_approved'
  },
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  }
}, {
  tableName: 'apartments',
  timestamps: false
});

module.exports = Apartment;

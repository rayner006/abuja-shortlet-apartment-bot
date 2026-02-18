// src/models/Booking.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  bookingReference: {
    type: DataTypes.STRING(50),
    unique: true,
    field: 'booking_reference'
  },
  apartmentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'apartment_id',
    references: {
      model: 'apartments',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  checkIn: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'check_in'
  },
  checkOut: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'check_out'
  },
  guests: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  totalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'total_price'
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed'),
    defaultValue: 'pending'
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'paid', 'refunded'),
    defaultValue: 'pending',
    field: 'payment_status'
  },
  paymentReference: {
    type: DataTypes.STRING(100),
    field: 'payment_reference'
  },
  specialRequests: {
    type: DataTypes.TEXT,
    field: 'special_requests'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  }
}, {
  tableName: 'bookings',
  timestamps: false
});

module.exports = Booking;

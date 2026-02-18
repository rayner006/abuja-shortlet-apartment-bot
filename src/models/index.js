// src/models/index.js
const sequelize = require('../config/database');
const User = require('./User');
const Apartment = require('./Apartment');
const Booking = require('./Booking');

// Define associations
User.hasMany(Apartment, { foreignKey: 'ownerId' });
Apartment.belongsTo(User, { foreignKey: 'ownerId' });

User.hasMany(Booking, { foreignKey: 'userId' });
Booking.belongsTo(User, { foreignKey: 'userId' });

Apartment.hasMany(Booking, { foreignKey: 'apartmentId' });
Booking.belongsTo(Apartment, { foreignKey: 'apartmentId' });

const initDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully');
    
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Database synced');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

module.exports = {
  sequelize,
  User,
  Apartment,
  Booking,
  initDatabase
};

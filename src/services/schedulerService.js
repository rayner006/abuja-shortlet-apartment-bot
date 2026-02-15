const logger = require('../middleware/logger');
const NotificationService = require('./notificationService');

function scheduleDailySummary() {
  const now = new Date();
  const night = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    21, 0, 0
  );
  
  let msUntilNight = night.getTime() - now.getTime();
  if (msUntilNight < 0) {
    msUntilNight += 24 * 60 * 60 * 1000;
  }
  
  setTimeout(() => {
    NotificationService.sendDailySummary().catch(err => {
      logger.error('Error sending daily summary:', err);
    });
    
    setInterval(() => {
      NotificationService.sendDailySummary().catch(err => {
        logger.error('Error sending daily summary:', err);
      });
    }, 24 * 60 * 60 * 1000);
    
  }, msUntilNight);
  
  logger.info('📅 Daily summary scheduled for 9:00 PM');
}

module.exports = { scheduleDailySummary };
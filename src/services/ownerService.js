const Owner = require('../models/Owner');
const logger = require('../middleware/logger');

class OwnerService {
  static async loadAllOwners() {
    try {
      const owners = await Owner.findAll();
      
      const ownerChatIds = {};
      const ownerInfo = {};
      
      owners.forEach(owner => {
        if (owner.telegram_chat_id) {
          ownerChatIds[owner.id] = owner.telegram_chat_id;
        }
        ownerInfo[owner.id] = owner;
      });
      
      logger.info(`✅ Loaded ${Object.keys(ownerInfo).length} owners`);
      
      return { ownerChatIds, ownerInfo };
    } catch (err) {
      logger.error('Error loading owners:', err);
      return { ownerChatIds: {}, ownerInfo: {} };
    }
  }
  
  static async registerOwner(chatId, ownerId) {
    try {
      const success = await Owner.registerChatId(ownerId, chatId);
      
      if (success) {
        const owner = await Owner.findById(ownerId);
        return {
          success: true,
          message: `✅ Successfully registered as owner: ${owner?.business_name || ownerId}`
        };
      } else {
        return {
          success: false,
          message: '❌ Error registering. Please check owner ID.'
        };
      }
    } catch (err) {
      logger.error('Error in registerOwner:', err);
      return {
        success: false,
        message: '❌ Error registering. Please try again.'
      };
    }
  }
  
  static async checkSubscription(ownerId) {
    try {
      const owner = await Owner.checkSubscription(ownerId);
      
      if (!owner) {
        return { success: false, message: '❌ Owner not found.' };
      }
      
      const today = new Date();
      const expiry = owner.subscription_expiry ? new Date(owner.subscription_expiry) : null;
      let statusEmoji = '✅';
      
      if (owner.subscription_status === 'expired') statusEmoji = '❌';
      else if (expiry && expiry < today) statusEmoji = '⚠️';
      
      const message = `
👤 *Owner:* ${owner.name}
🆔 *ID:* ${ownerId}
${statusEmoji} *Status:* ${owner.subscription_status || 'pending'}
📅 *Expiry:* ${owner.subscription_expiry || 'Not set'}
💰 *Total Paid:* ₦${owner.total_paid || 0}
📊 *Payments:* ${owner.total_payments || 0}

${expiry && expiry < today ? '⚠️ *SUBSCRIPTION EXPIRED*' : ''}
      `;
      
      return {
        success: true,
        message,
        data: owner
      };
    } catch (err) {
      logger.error('Error checking subscription:', err);
      return { success: false, message: '❌ Error checking subscription.' };
    }
  }
}

module.exports = OwnerService;
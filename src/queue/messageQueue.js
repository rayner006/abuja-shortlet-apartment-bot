const logger = require('../middleware/logger');

class MessageQueue {
  constructor(bot, options = {}) {
    this.bot = bot;
    this.queue = [];
    this.processing = false;
    this.delay = options.delay || 50; // ms between messages
    this.maxRetries = options.maxRetries || 3;
  }
  
  async sendMessage(chatId, text, options = {}) {
    return this.add({
      type: 'sendMessage',
      chatId,
      text,
      options
    });
  }
  
  async sendPhoto(chatId, photo, options = {}) {
    return this.add({
      type: 'sendPhoto',
      chatId,
      photo,
      options
    });
  }
  
  async sendMediaGroup(chatId, media, options = {}) {
    return this.add({
      type: 'sendMediaGroup',
      chatId,
      media,
      options
    });
  }
  
  async add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        ...task,
        resolve,
        reject,
        retries: 0
      });
      
      if (!this.processing) {
        this.process();
      }
    });
  }
  
  async process() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      
      try {
        let result;
        
        switch (task.type) {
          case 'sendMessage':
            result = await this.bot.sendMessage(task.chatId, task.text, task.options);
            break;
          case 'sendPhoto':
            result = await this.bot.sendPhoto(task.chatId, task.photo, task.options);
            break;
          case 'sendMediaGroup':
            result = await this.bot.sendMediaGroup(task.chatId, task.media, task.options);
            break;
        }
        
        task.resolve(result);
        
        // Wait between messages
        await new Promise(resolve => setTimeout(resolve, this.delay));
        
      } catch (error) {
        // Check if rate limited
        if (error.code === 'ETELEGRAM' && error.response?.statusCode === 429) {
          const retryAfter = error.response.headers?.['retry-after'] || 1;
          const retryMs = retryAfter * 1000;
          
          logger.warn(`Rate limited, waiting ${retryAfter}s`);
          
          // Requeue with increased delay
          this.queue.unshift(task);
          
          // Wait for retry period
          await new Promise(resolve => setTimeout(resolve, retryMs));
        } 
        // Check if can retry
        else if (task.retries < this.maxRetries) {
          task.retries++;
          logger.warn(`Retrying task (${task.retries}/${this.maxRetries})`);
          this.queue.unshift(task);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } 
        // Give up
        else {
          logger.error('Task failed after retries:', error);
          task.reject(error);
        }
      }
    }
    
    this.processing = false;
  }
}

module.exports = MessageQueue;
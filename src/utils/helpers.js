/**
 * Helper Utilities
 * Reusable functions across the bot
 */

class Helpers {
  /* ================= COMMISSION ================= */
  static calculateCommission(amount, percentage = 10) {
    if (!amount || isNaN(amount)) return 0;
    return Math.round((amount * percentage) / 100);
  }

  static calculateOwnerPayout(amount, percentage = 10) {
    const commission = this.calculateCommission(amount, percentage);
    return amount - commission;
  }

  /* ================= CURRENCY ================= */
  static formatCurrency(amount, currency = 'NGN') {
    if (isNaN(amount)) return '₦0';

    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0
    }).format(amount);
  }

  /* ================= DATE ================= */
  static formatDate(date) {
    if (!date) return '';

    const d = new Date(date);
    return d.toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  static formatDateTime(date) {
    if (!date) return '';

    const d = new Date(date);
    return d.toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /* ================= CALLBACK DATA PARSER ================= */
  static parseCallbackData(data) {
    // Example: "book_12" => { action: "book", id: 12 }
    if (!data || !data.includes('_')) return null;

    const [action, id] = data.split('_');

    return {
      action,
      id: Number(id)
    };
  }

  /* ================= TEXT UTILS ================= */
  static truncateText(text, maxLength = 120) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  /* ================= VALIDATION ================= */
  static isValidNumber(value) {
    return !isNaN(value) && Number(value) > 0;
  }

  static isFutureDate(date) {
    const now = new Date();
    const input = new Date(date);
    return input > now;
  }

  /* ================= RANDOM ID ================= */
  static generateRef(prefix = 'REF') {
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}-${rand}`;
  }
}

module.exports = Helpers;

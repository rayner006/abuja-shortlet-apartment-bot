// ============================================
// PROFESSIONAL DATE PICKER FOR TELEGRAM BOT
// Location: /handlers/callbacks/datePicker.js
// ============================================

class PremiumDatePicker {
  constructor() {
    this.userSessions = new Map();
    this.monthNames = {
      full: ['January', 'February', 'March', 'April', 'May', 'June',
             'July', 'August', 'September', 'October', 'November', 'December'],
      short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    };
  }

  // ========== SESSION MANAGEMENT ==========
  getSession(chatId) {
    if (!this.userSessions.has(chatId)) {
      const today = new Date();
      this.userSessions.set(chatId, {
        year: today.getFullYear(),
        month: today.getMonth(),
        checkIn: null,
        checkOut: null,
        context: {}
      });
    }
    return this.userSessions.get(chatId);
  }

  updateSession(chatId, updates) {
    const session = this.getSession(chatId);
    Object.assign(session, updates);
    this.userSessions.set(chatId, session);
    return session;
  }

  clearSession(chatId) {
    this.userSessions.delete(chatId);
  }

  // ========== DATE UTILITIES ==========
  formatDate(dateStr, format = 'long') {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (format === 'long') {
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  isPastDate(year, month, day) {
    const date = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date < today;
  }

  isInRange(dateStr, checkIn, checkOut) {
    if (!checkIn || !checkOut) return false;
    return dateStr > checkIn && dateStr < checkOut;
  }

  calculateNights(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  // ========== CALENDAR GENERATION ==========
  generateCalendar(chatId) {
    const session = this.getSession(chatId);
    const { year, month, checkIn, checkOut } = session;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    const keyboard = [];

    // Header
    keyboard.push([{
      text: `📅  ${this.monthNames.full[month]} ${year}  📅`,
      callback_data: 'ignore'
    }]);

    // Weekday headers
    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    keyboard.push(weekdays.map(day => ({ 
      text: day, 
      callback_data: 'ignore' 
    })));

    // Build calendar grid
    let row = [];
    for (let i = 0; i < firstDay; i++) {
      row.push({ text: '  ', callback_data: 'ignore' });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const isPast = this.isPastDate(year, month, day);
      const isCheckIn = checkIn === dateStr;
      const isCheckOut = checkOut === dateStr;
      const isInRange = this.isInRange(dateStr, checkIn, checkOut);
      
      let buttonText = '';
      let callbackData = isPast ? 'ignore' : `date_${dateStr}`;
      
      if (isPast) {
        buttonText = `❌ ${day}`;
      } else if (isCheckIn) {
        buttonText = `🔵 ${day}`;
      } else if (isCheckOut) {
        buttonText = `🟢 ${day}`;
      } else if (isInRange) {
        buttonText = `🟡 ${day}`;
      } else {
        buttonText = `⬜ ${day}`;
      }

      row.push({
        text: buttonText,
        callback_data: callbackData
      });

      if (row.length === 7) {
        keyboard.push(row);
        row = [];
      }
    }

    if (row.length > 0) {
      while (row.length < 7) {
        row.push({ text: '  ', callback_data: 'ignore' });
      }
      keyboard.push(row);
    }

    // Navigation
    keyboard.push([
      { text: '⏪  Prev Year', callback_data: `year_prev` },
      { text: `📆 ${year}`, callback_data: 'ignore' },
      { text: 'Next Year  ⏩', callback_data: `year_next` }
    ]);

    keyboard.push([
      { text: '◀️  Prev Month', callback_data: `month_prev` },
      { text: `📅 ${this.monthNames.short[month]}`, callback_data: 'ignore' },
      { text: 'Next Month  ▶️', callback_data: `month_next` }
    ]);

    // Action buttons
    const actionRow = [
      { text: '🧹 Clear', callback_data: 'clear_dates' },
      { text: '❌ Cancel', callback_data: 'cancel_booking' }
    ];
    
    if (checkIn && checkOut) {
      actionRow.push({ text: '✅ CONFIRM', callback_data: 'confirm_dates' });
    }
    
    keyboard.push(actionRow);

    // Legend
    keyboard.push([
      { text: '🔵 Check-in', callback_data: 'ignore' },
      { text: '🟢 Check-out', callback_data: 'ignore' },
      { text: '🟡 Between', callback_data: 'ignore' },
      { text: '⬜ Available', callback_data: 'ignore' },
      { text: '❌ Past', callback_data: 'ignore' }
    ]);

    return {
      reply_markup: {
        inline_keyboard: keyboard
      }
    };
  }

  // ========== CALLBACK HANDLER ==========
  async handleCallback(bot, cb, chatId, messageId, data) {
    const session = this.getSession(chatId);
    let response = null;

    if (data.startsWith('date_')) {
      const selectedDate = data.replace('date_', '');
      
      if (!session.checkIn) {
        session.checkIn = selectedDate;
        response = {
          type: 'info',
          message: `🔵 *Check-in selected:* ${this.formatDate(selectedDate)}\n\nNow select your *check-out* date.`
        };
      }
      else if (session.checkIn && !session.checkOut) {
        if (selectedDate > session.checkIn) {
          session.checkOut = selectedDate;
          const nights = this.calculateNights(session.checkIn, session.checkOut);
          response = {
            type: 'success',
            message: `✅ *Dates Selected!*\n\n` +
                    `🔵 Check-in: ${this.formatDate(session.checkIn)}\n` +
                    `🟢 Check-out: ${this.formatDate(session.checkOut)}\n` +
                    `📊 Nights: ${nights}\n\n` +
                    `Click *CONFIRM* to proceed.`
          };
        } else {
          session.checkOut = session.checkIn;
          session.checkIn = selectedDate;
          const nights = this.calculateNights(session.checkIn, session.checkOut);
          response = {
            type: 'info',
            message: `🔄 *Dates Swapped*\n\n` +
                    `🔵 New check-in: ${this.formatDate(session.checkIn)}\n` +
                    `🟢 New check-out: ${this.formatDate(session.checkOut)}\n` +
                    `📊 Nights: ${nights}\n\n` +
                    `Click *CONFIRM* to proceed.`
          };
        }
      } else {
        session.checkIn = selectedDate;
        session.checkOut = null;
        response = {
          type: 'info',
          message: `🔵 *New check-in selected:* ${this.formatDate(selectedDate)}\n\nNow select your *check-out* date.`
        };
      }
      
      this.updateSession(chatId, session);
    }

    else if (data === 'month_prev') {
      if (session.month === 0) {
        session.month = 11;
        session.year -= 1;
      } else {
        session.month -= 1;
      }
      this.updateSession(chatId, session);
    }
    else if (data === 'month_next') {
      if (session.month === 11) {
        session.month = 0;
        session.year += 1;
      } else {
        session.month += 1;
      }
      this.updateSession(chatId, session);
    }
    else if (data === 'year_prev') {
      session.year -= 1;
      this.updateSession(chatId, session);
    }
    else if (data === 'year_next') {
      session.year += 1;
      this.updateSession(chatId, session);
    }
    else if (data === 'clear_dates') {
      session.checkIn = null;
      session.checkOut = null;
      this.updateSession(chatId, session);
      response = {
        type: 'info',
        message: '🧹 *All dates cleared*\n\nSelect your check-in date to start.'
      };
    }
    else if (data === 'cancel_booking') {
      this.clearSession(chatId);
      return {
        action: 'cancel',
        message: '❌ *Booking Cancelled*\n\nWhat would you like to do next?'
      };
    }
    else if (data === 'confirm_dates') {
      if (session.checkIn && session.checkOut) {
        const nights = this.calculateNights(session.checkIn, session.checkOut);
        const result = {
          action: 'confirm',
          checkIn: session.checkIn,
          checkOut: session.checkOut,
          checkInFormatted: this.formatDate(session.checkIn),
          checkOutFormatted: this.formatDate(session.checkOut),
          nights: nights
        };
        this.clearSession(chatId);
        return result;
      }
    }

    if (response) {
      await bot.editMessageReplyMarkup(
        this.generateCalendar(chatId).reply_markup,
        { chat_id: chatId, message_id: messageId }
      );
      await bot.sendMessage(chatId, response.message, { parse_mode: 'Markdown' });
      return { action: 'continue' };
    }
    
    await bot.editMessageReplyMarkup(
      this.generateCalendar(chatId).reply_markup,
      { chat_id: chatId, message_id: messageId }
    );
    
    return { action: 'continue' };
  }

  async startDatePicker(bot, chatId, context = {}) {
    const session = this.getSession(chatId);
    session.context = context;
    this.updateSession(chatId, session);
    
    const calendar = this.generateCalendar(chatId);
    
    await bot.sendMessage(
      chatId,
      '📅 *Select Your Dates*\n\n' +
      '• Click a date for *check-in*\n' +
      '• Click another date for *check-out*\n' +
      '• Dates between will be highlighted 🟡\n' +
      '• Click *CONFIRM* when both are selected',
      {
        parse_mode: 'Markdown',
        ...calendar
      }
    );
  }
}

module.exports = new PremiumDatePicker();

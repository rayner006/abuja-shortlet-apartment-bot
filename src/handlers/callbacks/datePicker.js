// ============================================
// PROFESSIONAL DATE PICKER FOR TELEGRAM BOT
// Location: /handlers/callbacks/datePicker.js
// Features: Check-in/Check-out, Colors, Range, Nights calc, Cancel anytime
// ============================================

class PremiumDatePicker {
  constructor() {
    // Store user sessions in memory (falls back to Redis if needed)
    this.userSessions = new Map();
    
    // Month names for display
    this.monthNames = {
      full: ['January', 'February', 'March', 'April', 'May', 'June',
             'July', 'August', 'September', 'October', 'November', 'December'],
      short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    };
  }

  // ========== SESSION MANAGEMENT ==========
  
  /**
   * Get or create user session
   */
  getSession(chatId) {
    if (!this.userSessions.has(chatId)) {
      const today = new Date();
      this.userSessions.set(chatId, {
        // Calendar state
        year: today.getFullYear(),
        month: today.getMonth(),
        // Selection state
        checkIn: null,
        checkOut: null,
        tempDate: null,
        // Booking context (store apartment ID, etc.)
        context: {}
      });
    }
    return this.userSessions.get(chatId);
  }

  /**
   * Update user session
   */
  updateSession(chatId, updates) {
    const session = this.getSession(chatId);
    Object.assign(session, updates);
    this.userSessions.set(chatId, session);
    return session;
  }

  /**
   * Clear user session (after booking or cancel)
   */
  clearSession(chatId) {
    this.userSessions.delete(chatId);
  }

  // ========== DATE UTILITIES ==========

  /**
   * Format date for display (Short: 15 Jan 2025)
   */
  formatShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  /**
   * Format date for display (Long: 15 January 2025)
   */
  formatLong(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  /**
   * Check if date is in the past
   */
  isPastDate(year, month, day) {
    const date = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date < today;
  }

  /**
   * Check if a date is between check-in and check-out
   */
  isInRange(dateStr, checkIn, checkOut) {
    if (!checkIn || !checkOut) return false;
    return dateStr > checkIn && dateStr < checkOut;
  }

  /**
   * Calculate number of nights between two dates
   */
  calculateNights(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Validate date range
   */
  validateDates(checkIn, checkOut) {
    if (!checkIn || !checkOut) return { valid: false, reason: 'incomplete' };
    
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (start < today) {
      return { valid: false, reason: 'past', message: '❌ Check-in date cannot be in the past' };
    }
    
    if (end <= start) {
      return { valid: false, reason: 'invalid', message: '❌ Check-out must be after check-in' };
    }
    
    const nights = this.calculateNights(checkIn, checkOut);
    return { valid: true, nights };
  }

  // ========== CALENDAR GENERATION ==========

  /**
   * Generate the main calendar keyboard
   */
  generateCalendar(chatId) {
    const session = this.getSession(chatId);
    const { year, month, checkIn, checkOut } = session;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    
    const keyboard = [];

    // ===== HEADER: Month & Year =====
    keyboard.push([{
      text: `📅  ${this.monthNames.full[month]} ${year}  📅`,
      callback_data: 'ignore'
    }]);

    // ===== WEEKDAY HEADERS =====
    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    keyboard.push(weekdays.map(day => ({ 
      text: day, 
      callback_data: 'ignore' 
    })));

    // ===== BUILD CALENDAR GRID =====
    let row = [];
    
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      row.push({ text: '  ', callback_data: 'ignore' });
    }

    // Fill in the days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Check date status
      const isPast = this.isPastDate(year, month, day);
      const isCheckIn = checkIn === dateStr;
      const isCheckOut = checkOut === dateStr;
      const isInRange = this.isInRange(dateStr, checkIn, checkOut);
      
      let buttonText = '';
      let callbackData = isPast ? 'ignore' : `date_${dateStr}`;
      
      // PROFESSIONAL COLOR CODING:
      // 🔵 Blue = Check-in
      // 🟢 Green = Check-out  
      // 🟡 Yellow = Nights between
      // ⬜ White = Available
      // ❌ Red = Past/Unavailable
      
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

      // Start new row when current row is full
      if (row.length === 7) {
        keyboard.push(row);
        row = [];
      }
    }

    // Fill remaining cells in last row
    if (row.length > 0) {
      while (row.length < 7) {
        row.push({ text: '  ', callback_data: 'ignore' });
      }
      keyboard.push(row);
    }

    // ===== NAVIGATION CONTROLS =====
    
    // Year navigation
    keyboard.push([
      { text: '⏪  Prev Year', callback_data: `year_prev` },
      { text: `📆 ${year}`, callback_data: 'ignore' },
      { text: 'Next Year  ⏩', callback_data: `year_next` }
    ]);

    // Month navigation
    keyboard.push([
      { text: '◀️  Prev Month', callback_data: `month_prev` },
      { text: `📅 ${this.monthNames.short[month]}`, callback_data: 'ignore' },
      { text: 'Next Month  ▶️', callback_data: `month_next` }
    ]);

    // ===== ACTION BUTTONS =====
    const actionRow = [
      { text: '🧹 Clear', callback_data: 'clear_dates' },
      { text: '❌ Cancel', callback_data: 'cancel_booking' }
    ];
    
    // Show confirm button only if both dates selected
    if (checkIn && checkOut) {
      actionRow.push({ text: '✅ CONFIRM', callback_data: 'confirm_dates' });
    }
    
    keyboard.push(actionRow);

    // ===== LEGEND (always at bottom) =====
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

  /**
   * Handle all calendar-related callbacks
   */
  async handleCallback(bot, cb, chatId, messageId, data) {
    const session = this.getSession(chatId);
    let response = null;

    // ===== DATE SELECTION =====
    if (data.startsWith('date_')) {
      const selectedDate = data.replace('date_', '');
      
      // CASE 1: No check-in selected
      if (!session.checkIn) {
        session.checkIn = selectedDate;
        response = {
          type: 'info',
          message: `🔵 *Check-in selected:* ${this.formatLong(selectedDate)}\n\nNow select your *check-out* date.`
        };
      }
      
      // CASE 2: Have check-in, no check-out
      else if (session.checkIn && !session.checkOut) {
        // If selected date is after check-in
        if (selectedDate > session.checkIn) {
          session.checkOut = selectedDate;
          const nights = this.calculateNights(session.checkIn, session.checkOut);
          response = {
            type: 'success',
            message: `✅ *Dates Confirmed!*\n\n` +
                    `🔵 Check-in: ${this.formatLong(session.checkIn)}\n` +
                    `🟢 Check-out: ${this.formatLong(session.checkOut)}\n` +
                    `📊 Nights: ${nights}\n\n` +
                    `Click *CONFIRM* to proceed or adjust dates.`
          };
        } 
        // If selected date is before check-in, swap them
        else {
          session.checkOut = session.checkIn;
          session.checkIn = selectedDate;
          const nights = this.calculateNights(session.checkIn, session.checkOut);
          response = {
            type: 'info',
            message: `🔄 *Dates Swapped*\n\n` +
                    `🔵 New check-in: ${this.formatLong(session.checkIn)}\n` +
                    `🟢 New check-out: ${this.formatLong(session.checkOut)}\n` +
                    `📊 Nights: ${nights}\n\n` +
                    `Click *CONFIRM* to proceed.`
          };
        }
      }
      
      // CASE 3: Both dates already selected - start over
      else {
        session.checkIn = selectedDate;
        session.checkOut = null;
        response = {
          type: 'info',
          message: `🔵 *New check-in selected:* ${this.formatLong(selectedDate)}\n\nNow select your *check-out* date.`
        };
      }
      
      this.updateSession(chatId, session);
    }

    // ===== NAVIGATION =====
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

    // ===== ACTIONS =====
    else if (data === 'clear_dates') {
      session.checkIn = null;
      session.checkOut = null;
      this.updateSession(chatId, session);
      response = {
        type: 'info',
        message: '🧹 *All dates cleared*\n\nSelect your check-in date to start over.'
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
        const validation = this.validateDates(session.checkIn, session.checkOut);
        if (validation.valid) {
          const result = {
            action: 'confirm',
            checkIn: session.checkIn,
            checkOut: session.checkOut,
            checkInFormatted: this.formatLong(session.checkIn),
            checkOutFormatted: this.formatLong(session.checkOut),
            nights: validation.nights,
            message: `✅ *BOOKING CONFIRMED*\n\n` +
                    `📍 Check-in: ${this.formatLong(session.checkIn)}\n` +
                    `📍 Check-out: ${this.formatLong(session.checkOut)}\n` +
                    `📊 Total nights: ${validation.nights}\n\n` +
                    `Proceeding to guest details...`
          };
          
          // Don't clear session yet - we need the dates for next step
          return result;
        } else {
          response = {
            type: 'error',
            message: validation.message
          };
        }
      }
    }

    // If we have a response, update the calendar and send message
    if (response) {
      // Update the calendar
      await bot.editMessageReplyMarkup(
        this.generateCalendar(chatId).reply_markup,
        { chat_id: chatId, message_id: messageId }
      );
      
      // Send the response message
      await bot.sendMessage(chatId, response.message, { parse_mode: 'Markdown' });
      
      return { action: 'continue' };
    }
    
    // Just refresh the calendar (navigation)
    await bot.editMessageReplyMarkup(
      this.generateCalendar(chatId).reply_markup,
      { chat_id: chatId, message_id: messageId }
    );
    
    return { action: 'continue' };
  }

  /**
   * Start the date picker for a user
   */
  async startDatePicker(bot, chatId, context = {}) {
    // Initialize session with context (apartment ID, etc.)
    const session = this.getSession(chatId);
    session.context = context;
    this.updateSession(chatId, session);
    
    // Get calendar
    const calendar = this.generateCalendar(chatId);
    
    // Send welcome message
    await bot.sendMessage(
      chatId,
      '🏨 *Select Your Dates*\n\n' +
      '• Click a date to select *check-in*\n' +
      '• Click another date to select *check-out*\n' +
      '• Dates between will be highlighted 🟡\n' +
      '• Click *CONFIRM* when both dates are selected\n\n' +
      '⚠️ Past dates are disabled (❌)',
      {
        parse_mode: 'Markdown',
        ...calendar
      }
    );
  }
}

// Create and export a single instance
const datePicker = new PremiumDatePicker();
module.exports = datePicker;

/**
 * Keyboard Utility
 * Central place for all Telegram keyboards
 */

class Keyboard {
  /* ================= MAIN MENU ================= */
  static mainMenu() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: '🏠 Browse Apartments' }],
          [{ text: '📅 My Bookings' }],
          [{ text: '📞 Contact Support' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    };
  }

  /* ================= LOCATION MENU ================= */
  static locationMenu(locations = []) {
    const rows = locations.map(loc => [{ text: loc }]);

    rows.push([{ text: '⬅️ Back to Menu' }]);

    return {
      reply_markup: {
        keyboard: rows,
        resize_keyboard: true
      }
    };
  }

  /* ================= APARTMENT INLINE ================= */
  static apartmentInline(apartmentId) {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📸 View Photos', callback_data: `photos_${apartmentId}` },
            { text: '📝 Details', callback_data: `details_${apartmentId}` }
          ],
          [
            { text: '💳 Book Now', callback_data: `book_${apartmentId}` }
          ]
        ]
      }
    };
  }

  /* ================= BOOKING CONFIRM ================= */
  static bookingConfirm(apartmentId) {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Confirm Booking', callback_data: `confirm_${apartmentId}` },
            { text: '❌ Cancel', callback_data: `cancel_${apartmentId}` }
          ]
        ]
      }
    };
  }

  /* ================= OWNER APPROVAL ================= */
  static ownerApproval(bookingId) {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💰 Payment Received', callback_data: `paid_${bookingId}` },
            { text: '❌ Reject', callback_data: `reject_${bookingId}` }
          ]
        ]
      }
    };
  }

  /* ================= ADMIN ACTIONS ================= */
  static adminActions(bookingId) {
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 View Commission', callback_data: `commission_${bookingId}` }
          ]
        ]
      }
    };
  }

  /* ================= BACK BUTTON ================= */
  static backButton(label = '⬅️ Back') {
    return {
      reply_markup: {
        keyboard: [[{ text: label }]],
        resize_keyboard: true
      }
    };
  }
}

module.exports = Keyboard;

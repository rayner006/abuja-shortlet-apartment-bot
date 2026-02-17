// utils/datePicker.js

/* ===== SHORT DATE FORMAT HELPER ===== */
function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);

  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function getMonthName(month) {
  const months = [
    'Jan','Feb','Mar','Apr','May','Jun',
    'Jul','Aug','Sep','Oct','Nov','Dec'
  ];

  // SAFE FALLBACK
  if (month === null || month === undefined || isNaN(month)) {
    return '';
  }

  return months[month] || '';
}

function getDatePickerKeyboard(
  year,
  month,
  startDate = null,
  endDate = null,
  selectedMonth = null,
  selectedYear = null
) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const keyboard = [];
  let row = [];

  /* ===== WEEK HEADERS ===== */
  const weekdays = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  keyboard.push(weekdays.map(d => ({ text: d, callback_data: 'ignore' })));

  /* ===== EMPTY CELLS ===== */
  for (let i = 0; i < firstDay; i++) {
    row.push({ text: ' ', callback_data: 'ignore' });
  }

  /* ===== DAYS ===== */
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr =
      `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

    let label = `${day}`;
    if (startDate === dateStr) label = `🔵 ${day}`; // check-in
    if (endDate === dateStr) label = `🟢 ${day}`;   // check-out

    row.push({
      text: label,
      callback_data: `date_${dateStr}`
    });

    if (row.length === 7) {
      keyboard.push(row);
      row = [];
    }
  }

  if (row.length > 0) {
    while (row.length < 7) row.push({ text: ' ', callback_data: 'ignore' });
    keyboard.push(row);
  }

  /* ===== YEAR NAV ===== */
  const yearLabel =
    selectedYear === year ? `🟡 ${year}` : `${year}`;

  keyboard.push([
    { text: '⏪', callback_data: `year_prev_${year}_${month}` },
    { text: yearLabel, callback_data: `select_year_${year}_${month}` },
    { text: '⏩', callback_data: `year_next_${year}_${month}` }
  ]);

  /* ===== MONTH NAV ===== */
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const monthLabel =
    selectedMonth === month ? `🟣 ${getMonthName(month)}` : getMonthName(month);

  keyboard.push([
    { text: '◀️', callback_data: `month_${prevYear}_${prevMonth}` },
    { text: monthLabel, callback_data: `select_month_${year}_${month}` },
    { text: '▶️', callback_data: `month_${nextYear}_${nextMonth}` }
  ]);

  /* ===== ACTION BUTTONS ===== */
  keyboard.push([
    { text: '🧹 Clear Dates', callback_data: 'clear_dates' },
    { text: '❌ Cancel', callback_data: 'cancel_booking' }
  ]);

  if (startDate && endDate) {
    keyboard.push([
      { text: '✅ Confirm Booking', callback_data: 'confirm_booking' }
    ]);
  }

  return {
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
}

function getDateRangePickerKeyboard(
  step,
  startDate = null,
  endDate = null,
  selectedMonth = null,
  selectedYear = null
) {
  const today = new Date();

  return getDatePickerKeyboard(
    today.getFullYear(),
    today.getMonth(),
    startDate,
    endDate,
    selectedMonth,
    selectedYear
  );
}

module.exports = {
  getDatePickerKeyboard,
  getDateRangePickerKeyboard,
  formatShortDate
};

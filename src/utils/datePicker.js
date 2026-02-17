// utils/datePicker.js

function getMonthName(month) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[month];
}

function getDatePickerKeyboard(year, month, startDate = null, endDate = null) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const keyboard = [];
  let row = [];

  // Week headers
  const weekdays = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  keyboard.push(weekdays.map(d => ({ text: d, callback_data: 'ignore' })));

  // Empty start cells
  for (let i = 0; i < firstDay; i++) {
    row.push({ text: ' ', callback_data: 'ignore' });
  }

  // Days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

    let label = `${day}`;
    if (startDate === dateStr) label = `🔵 ${day}`;
    if (endDate === dateStr) label = `🟢 ${day}`;

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

  // YEAR NAV
  keyboard.push([
    { text: '⏪', callback_data: `year_prev_${year}_${month}` },
    { text: `${year}`, callback_data: 'ignore' },
    { text: '⏩', callback_data: `year_next_${year}_${month}` }
  ]);

  // MONTH NAV
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  keyboard.push([
    { text: '◀️', callback_data: `month_${prevYear}_${prevMonth}` },
    { text: `${getMonthName(month)}`, callback_data: 'ignore' },
    { text: '▶️', callback_data: `month_${nextYear}_${nextMonth}` }
  ]);

  // ACTION BUTTONS
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

module.exports = {
  getDatePickerKeyboard
};

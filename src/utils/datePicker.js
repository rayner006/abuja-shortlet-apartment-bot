// Simple date picker utility for Telegram

function getMonthName(month) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[month];
}

function getDatePickerKeyboard(year, month, selectedDate = null, highlightDate = null) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  
  const keyboard = [];
  let row = [];

  // Weekday headers
  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  row = weekdays.map(day => ({ text: day, callback_data: 'ignore' }));
  keyboard.push(row);

  // Empty cells
  row = [];
  for (let i = 0; i < firstDay; i++) {
    row.push({ text: ' ', callback_data: 'ignore' });
  }

  // Days loop
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const isSelected = selectedDate === dateStr;
    const isHighlighted = highlightDate === dateStr;

    let displayText = `${day}`;
    if (isSelected) displayText = `✅ ${day}`;
    else if (isHighlighted) displayText = `🔵 ${day}`;

    row.push({
      text: displayText,
      callback_data: `date_${dateStr}`
    });

    if (row.length === 7) {
      keyboard.push(row);
      row = [];
    }
  }

  if (row.length > 0) {
    keyboard.push(row);
  }

  // Year navigation
  keyboard.push([
    { text: '⏪ Year -', callback_data: `year_prev_${year}_${month}` },
    { text: `📅 ${year}`, callback_data: 'ignore' },
    { text: 'Year + ⏩', callback_data: `year_next_${year}_${month}` }
  ]);

  // Month navigation
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  keyboard.push([
    { text: '◀️ Prev', callback_data: `month_${prevYear}_${prevMonth}` },
    { text: `${getMonthName(month)} ${year}`, callback_data: 'ignore' },
    { text: 'Next ▶️', callback_data: `month_${nextYear}_${nextMonth}` }
  ]);

  // Action buttons
  keyboard.push([
    { text: '❌ Cancel', callback_data: 'cancel_booking' }
  ]);

  return {
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
}

function getDateRangePickerKeyboard(step, startDate = null) {
  const today = new Date();

  if (step === 'start') {
    return getDatePickerKeyboard(today.getFullYear(), today.getMonth());
  } else {
    const start = new Date(startDate);
    let endYear = start.getFullYear();
    let endMonth = start.getMonth() + 1;

    if (endMonth > 11) {
      endMonth = 0;
      endYear += 1;
    }

    return getDatePickerKeyboard(endYear, endMonth, null, startDate);
  }
}

module.exports = {
  getDatePickerKeyboard,
  getDateRangePickerKeyboard
};

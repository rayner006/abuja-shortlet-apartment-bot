function getMonthName(month) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[month];
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getDate()} ${getMonthName(d.getMonth())} ${d.getFullYear()}`;
}

function getDatePickerKeyboard(year, month, selectedDate = null, highlightDate = null) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const keyboard = [];
  let row = [];

  const weekdays = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  keyboard.push(weekdays.map(d => ({ text: d, callback_data: 'ignore' })));

  row = [];
  for (let i = 0; i < firstDay; i++) row.push({ text: ' ', callback_data: 'ignore' });

  const today = new Date();
  today.setHours(0,0,0,0);

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const thisDate = new Date(year, month, day);
    thisDate.setHours(0,0,0,0);

    const isSelected = selectedDate === dateStr;
    const isHighlighted = highlightDate === dateStr;

    let display = `${day}`;
    if (isSelected) display = `✅ ${day}`;
    else if (isHighlighted) display = `🔵 ${day}`;

    row.push({
      text: display,
      callback_data: thisDate < today ? 'ignore' : `date_${dateStr}`
    });

    if (row.length === 7) {
      keyboard.push(row);
      row = [];
    }
  }

  if (row.length) {
    while (row.length < 7) row.push({ text: ' ', callback_data: 'ignore' });
    keyboard.push(row);
  }

  keyboard.push([
    { text: '⏪', callback_data: `year_prev_${year}_${month}` },
    { text: `${year}`, callback_data: 'ignore' },
    { text: '⏩', callback_data: `year_next_${year}_${month}` }
  ]);

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  keyboard.push([
    { text: '◀️', callback_data: `month_${prevYear}_${prevMonth}` },
    { text: `${getMonthName(month)} ${year}`, callback_data: 'ignore' },
    { text: '▶️', callback_data: `month_${nextYear}_${nextMonth}` }
  ]);

  keyboard.push([{ text: '❌ Cancel', callback_data: 'cancel_booking' }]);

  return { reply_markup: { inline_keyboard: keyboard } };
}

function getDateRangePickerKeyboard(step, startDate = null) {
  const today = new Date();
  if (step === 'start') {
    return getDatePickerKeyboard(today.getFullYear(), today.getMonth());
  } else {
    const start = new Date(startDate);
    return getDatePickerKeyboard(start.getFullYear(), start.getMonth()+1, null, startDate);
  }
}

module.exports = {
  getDatePickerKeyboard,
  getDateRangePickerKeyboard,
  formatDate
};

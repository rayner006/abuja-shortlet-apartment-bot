// utils/datePicker.js

function getMonthName(month) {
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  return months[month];
}

function getDatePickerKeyboard(
  year,
  month,
  selectedDate = null,
  highlightDate = null,
  endDate = null
) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const keyboard = [];
  let row = [];

  // Weekday Header
  const weekdays = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  keyboard.push(weekdays.map(d => ({ text: d, callback_data: 'ignore' })));

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    row.push({ text: ' ', callback_data: 'ignore' });
  }

  // Today reference for disabling past days
  const today = new Date();
  today.setHours(0,0,0,0);

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr =
      `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

    const thisDate = new Date(year, month, day);
    thisDate.setHours(0,0,0,0);

    let text = `${day}`;

    // USER SELECTED CHECK-IN
    if (dateStr === selectedDate) text = `🔵 ${day}`;

    // USER SELECTED CHECK-OUT
    if (dateStr === endDate) text = `🟢 ${day}`;

    row.push({
      text,
      callback_data: thisDate < today ? 'ignore' : `date_${dateStr}`
    });

    if (row.length === 7) {
      keyboard.push(row);
      row = [];
    }
  }

  // Fill last row
  if (row.length) {
    while (row.length < 7) {
      row.push({ text:' ', callback_data:'ignore' });
    }
    keyboard.push(row);
  }

  // YEAR NAVIGATION
  keyboard.push([
    { text:'⏪', callback_data:`year_prev_${year}_${month}` },
    { text:`📅 ${year}`, callback_data:'ignore' },
    { text:'⏩', callback_data:`year_next_${year}_${month}` }
  ]);

  // MONTH NAVIGATION
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;

  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  keyboard.push([
    { text:'◀️', callback_data:`month_${prevYear}_${prevMonth}` },
    { text:`${getMonthName(month)}`, callback_data:'ignore' },
    { text:'▶️', callback_data:`month_${nextYear}_${nextMonth}` }
  ]);

  // CLEAR / CANCEL
  keyboard.push([
    { text:'🔄 Clear Dates', callback_data:'clear_dates' },
    { text:'❌ Cancel', callback_data:'cancel_booking' }
  ]);

  return {
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
}

// Range Picker Wrapper
function getDateRangePickerKeyboard(step, startDate = null, endDate = null) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  return getDatePickerKeyboard(
    year,
    month,
    step === 'end' ? startDate : null,
    null,
    endDate
  );
}

module.exports = {
  getDatePickerKeyboard,
  getDateRangePickerKeyboard
};

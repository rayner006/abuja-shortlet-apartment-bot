function getMonthName(month) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
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

  const weekdays = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  keyboard.push(weekdays.map(d => ({ text: d, callback_data: 'ignore' })));

  for (let i = 0; i < firstDay; i++) {
    row.push({ text: ' ', callback_data: 'ignore' });
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr =
      `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

    const thisDate = new Date(year, month, day);
    thisDate.setHours(0,0,0,0);

    let text = `${day}`;

    if (dateStr === selectedDate) text = `🔵 ${day}`; // Check-In
    if (dateStr === endDate) text = `🟢 ${day}`; // Check-Out
    if (thisDate.getTime() === today.getTime()) text = `🟡 ${day}`;

    row.push({
      text,
      callback_data: thisDate < today ? 'ignore' : `date_${dateStr}`
    });

    if (row.length === 7) {
      keyboard.push(row);
      row = [];
    }
  }

  if (row.length) {
    while (row.length < 7) row.push({ text:' ', callback_data:'ignore' });
    keyboard.push(row);
  }

  // Year Nav
  keyboard.push([
    { text:'⏪', callback_data:`year_prev_${year}_${month}` },
    { text:`📅 ${year}`, callback_data:'ignore' },
    { text:'⏩', callback_data:`year_next_${year}_${month}` }
  ]);

  // Month Nav
  const prevM = month===0?11:month-1;
  const prevY = month===0?year-1:year;
  const nextM = month===11?0:month+1;
  const nextY = month===11?year+1:year;

  keyboard.push([
    { text:'◀️', callback_data:`month_${prevY}_${prevM}` },
    { text:`${getMonthName(month)}`, callback_data:'ignore' },
    { text:'▶️', callback_data:`month_${nextY}_${nextM}` }
  ]);

  // Actions
  keyboard.push([
    { text:'🔄 Clear Dates', callback_data:'clear_dates' },
    { text:'❌ Cancel', callback_data:'cancel_booking' }
  ]);

  return { reply_markup:{ inline_keyboard:keyboard }};
}

function getDateRangePickerKeyboard(step, startDate=null, endDate=null) {
  const now = new Date();

  if (step === 'start') {
    return getDatePickerKeyboard(now.getFullYear(), now.getMonth());
  }

  const start = new Date(startDate);
  return getDatePickerKeyboard(
    start.getFullYear(),
    start.getMonth(),
    startDate,
    null,
    endDate
  );
}

module.exports = {
  getDatePickerKeyboard,
  getDateRangePickerKeyboard
};

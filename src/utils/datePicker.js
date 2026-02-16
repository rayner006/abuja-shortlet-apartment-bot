// Simple date picker utility for Telegram
function getMonthName(month) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[month];
}

function getDatePickerKeyboard(year, month, selectedDate = null) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
  
  const keyboard = [];
  let row = [];
  
  // Add weekday headers
  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  row = weekdays.map(day => ({ text: day, callback_data: 'ignore' }));
  keyboard.push(row);
  
  // Add empty cells for days before month starts
  row = [];
  for (let i = 0; i < firstDay; i++) {
    row.push({ text: ' ', callback_data: 'ignore' });
  }
  
  // Add days of month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isSelected = selectedDate === dateStr;
    const displayText = isSelected ? `✅ ${day}` : `${day}`;
    
    row.push({ 
      text: displayText, 
      callback_data: `date_${dateStr}` 
    });
    
    if (row.length === 7) {
      keyboard.push(row);
      row = [];
    }
  }
  
  // Push remaining row
  if (row.length > 0) {
    keyboard.push(row);
  }
  
  // Add month navigation
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  
  keyboard.push([
    { text: '◀️ Prev', callback_data: `month_${prevYear}_${prevMonth}` },
    { text: `${getMonthName(month)} ${year}`, callback_data: 'ignore' },
    { text: 'Next ▶️', callback_data: `month_${nextYear}_${nextMonth}` }
  ]);
  
  keyboard.push([
    { text: '✅ Confirm Date', callback_data: 'confirm_date' },
    { text: '❌ Cancel', callback_data: 'cancel_booking' }
  ]);
  
  return {
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
}

function getDateRangePickerKeyboard(step, startDate = null, endDate = null) {
  if (step === 'start') {
    const today = new Date();
    return getDatePickerKeyboard(today.getFullYear(), today.getMonth());
  } else {
    // For end date, show months after start date
    const start = new Date(startDate);
    return getDatePickerKeyboard(start.getFullYear(), start.getMonth());
  }
}

module.exports = {
  getDatePickerKeyboard,
  getDateRangePickerKeyboard
};

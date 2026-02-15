function validatePhone(phone) {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 11 && digits.startsWith('0')) {
    return { valid: true, formatted: '+234' + digits.slice(1) };
  }
  
  if (digits.length === 13 && digits.startsWith('234')) {
    return { valid: true, formatted: '+' + digits };
  }
  
  if (digits.length === 14 && digits.startsWith('234')) {
    return { valid: true, formatted: '+' + digits.slice(1) };
  }
  
  return { valid: false, formatted: phone };
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validateDate(date) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(date)) return false;
  
  const d = new Date(date);
  return d instanceof Date && !isNaN(d);
}

module.exports = {
  validatePhone,
  validateEmail,
  validateDate
};
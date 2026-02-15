function formatCurrency(amount) {
  return `₦${amount.toLocaleString()}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDateTime(date) {
  return new Date(date).toLocaleString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function truncate(text, length = 100) {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

module.exports = {
  formatCurrency,
  formatDate,
  formatDateTime,
  truncate
};
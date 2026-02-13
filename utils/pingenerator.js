// generate 5-digit pin for tenant verification
function generateaccesspin() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

// Tenant confirmation button
function tenantConfirmKeyboard(bookingCode) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { 
            text: "💰 I Have Paid the Owner", 
            callback_data: `confirm_tenant_${bookingCode}` 
          }
        ]
      ]
    }
  };
}

// Owner confirmation button
function ownerConfirmKeyboard(bookingCode) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { 
            text: "✅ Owner Confirms Payment", 
            callback_data: `confirm_owner_${bookingCode}` 
          }
        ]
      ]
    }
  };
}

// Commission payment button
function payCommissionKeyboard(bookingCode, amount) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { 
            text: `💵 Pay ₦${Number(amount).toLocaleString()} Commission`, 
            callback_data: `pay_commission_${bookingCode}` 
          }
        ]
      ]
    }
  };
}

// ONE export at the bottom - ALL functions together!
module.exports = {
  generateaccesspin,
  tenantConfirmKeyboard,
  ownerConfirmKeyboard,
  payCommissionKeyboard
};
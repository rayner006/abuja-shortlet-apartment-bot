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

// Property Owner confirmation button
function propertyOwnerConfirmKeyboard(bookingCode) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { 
            text: "✅ Owner Confirms Payment", 
            callback_data: `confirm_property_owner_${bookingCode}` 
          }
        ]
      ]
    }
  };
}

// Commission payment button (for Owner to pay YOU)
function payCommissionKeyboard(bookingCode, amount) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { 
            text: `💵 Pay 10% Commission (₦${Number(amount).toLocaleString()})`, 
            callback_data: `pay_commission_${bookingCode}` 
          }
        ]
      ]
    }
  };
}

module.exports = {
  tenantConfirmKeyboard,
  propertyOwnerConfirmKeyboard,
  payCommissionKeyboard
};
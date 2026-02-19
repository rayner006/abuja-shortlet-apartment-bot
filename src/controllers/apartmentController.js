const showLocationMenu = async (bot, chatId, messageId) => {
  const text = `
📍 *Search by Location*

Select a location to find apartments:
  `;
  
  const keyboard = {
    inline_keyboard: [
      // Row 1
      [
        { text: '🏛️ Asokoro', callback_data: 'search_loc_asokoro' },
        { text: '🏰 Maitama', callback_data: 'search_loc_maitama' },
        { text: '🏛️ Central Area', callback_data: 'search_loc_central' }
      ],
      // Row 2
      [
        { text: '🏢 Wuse', callback_data: 'search_loc_wuse' },
        { text: '🏙️ Garki', callback_data: 'search_loc_garki' },
        { text: '🌳 Jabi', callback_data: 'search_loc_jabi' }
      ],
      // Row 3
      [
        { text: '🏬 Utako', callback_data: 'search_loc_utako' },
        { text: '🏗️ Wuye', callback_data: 'search_loc_wuye' },
        { text: '🏡 Life Camp', callback_data: 'search_loc_life-camp' }
      ],
      // Row 4
      [
        { text: '🏠 Guzape', callback_data: 'search_loc_guzape' },
        { text: '🏘️ Gwarinpa', callback_data: 'search_loc_gwarinpa' },
        { text: '🏘️ Kubwa', callback_data: 'search_loc_kubwa' }
      ],
      // Row 5
      [
        { text: '🏠 Apo', callback_data: 'search_loc_apo' }
      ],
      // All locations and back
      [
        { text: '📍 All Locations', callback_data: 'search_loc_all' }
      ],
      [{ text: '« Back to Search Menu', callback_data: 'search_back' }]
    ]
  };
  
  await bot.editMessageText(text, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
};

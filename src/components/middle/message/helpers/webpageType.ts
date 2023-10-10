// https://github.com/telegramdesktop/tdesktop/blob/3da787791f6d227f69b32bf4003bc6071d05e2ac/Telegram/SourceFiles/history/view/history_view_view_button.cpp#L51
export function getWebpageButtonText(type?: string) {
  switch (type) {
    case 'telegram_channel_request':
    case 'telegram_megagroup_request':
    case 'telegram_chat_request':
      return 'lng_view_button_request_join';
    case 'telegram_message':
      return 'lng_view_button_message';
    case 'telegram_bot':
      return 'lng_view_button_bot';
    case 'telegram_voicechat':
      return 'lng_view_button_voice_chat';
    case 'telegram_livestream':
      return 'lng_view_button_voice_chat_channel';
    case 'telegram_megagroup':
    case 'telegram_chat':
      return 'lng_view_button_group';
    case 'telegram_channel':
      return 'lng_view_button_channel';
    case 'telegram_user':
      return 'lng_view_button_user';
    case 'telegram_botapp':
      return 'lng_view_button_bot_app';
    case 'telegram_chatlist':
      return 'ViewChatList';
    case 'telegram_story':
      return 'lng_view_button_story';
    case 'telegram_channel_boost':
      return 'lng_view_button_boost';
    default:
      return undefined;
  }
}

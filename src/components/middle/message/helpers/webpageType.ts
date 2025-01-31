import type { RegularLangKey } from '../../../../types/language';

// https://github.com/telegramdesktop/tdesktop/blob/3da787791f6d227f69b32bf4003bc6071d05e2ac/Telegram/SourceFiles/history/view/history_view_view_button.cpp#L51
export function getWebpageButtonLangKey(type?: string): RegularLangKey | undefined {
  switch (type) {
    case 'telegram_channel_request':
    case 'telegram_megagroup_request':
    case 'telegram_chat_request':
      return 'ViewButtonRequestJoin';
    case 'telegram_message':
      return 'ViewButtonMessage';
    case 'telegram_bot':
      return 'ViewButtonBot';
    case 'telegram_voicechat':
      return 'ViewButtonVoiceChat';
    case 'telegram_livestream':
      return 'ViewButtonVoiceChatChannel';
    case 'telegram_megagroup':
    case 'telegram_chat':
      return 'ViewButtonGroup';
    case 'telegram_channel':
      return 'ViewButtonChannel';
    case 'telegram_user':
      return 'ViewButtonUser';
    case 'telegram_botapp':
      return 'ViewButtonBotApp';
    case 'telegram_chatlist':
      return 'ViewChatList';
    case 'telegram_story':
      return 'ViewButtonStory';
    case 'telegram_channel_boost':
    case 'telegram_group_boost':
      return 'ViewButtonBoost';
    case 'telegram_stickerset':
      return 'ViewButtonStickerset';
    case 'telegram_nft':
      return 'ViewButtonGiftUnique';
    default:
      return undefined;
  }
}

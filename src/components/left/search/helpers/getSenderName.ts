import type { ApiChat, ApiMessage, ApiUser } from '../../../../api/types';
import type { LangFn } from '../../../../hooks/useLang';

import {
  getChatTitle,
  getSenderTitle,
  isChatGroup,
  isUserId,
} from '../../../../global/helpers';

export function getSenderName(
  lang: LangFn, message: ApiMessage, chatsById: Record<string, ApiChat>, usersById: Record<string, ApiUser>,
) {
  const { senderId } = message;
  if (!senderId) {
    return undefined;
  }

  const sender = isUserId(senderId) ? usersById[senderId] : chatsById[senderId];

  let senderName = getSenderTitle(lang, sender);

  const chat = chatsById[message.chatId];
  if (chat) {
    if ('isSelf' in sender && sender.isSelf) {
      senderName = `${lang('FromYou')} → ${getChatTitle(lang, chat)}`;
    } else if (isChatGroup(chat)) {
      senderName += ` → ${getChatTitle(lang, chat)}`;
    }
  }

  return senderName;
}

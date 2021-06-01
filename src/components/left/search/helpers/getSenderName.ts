import { ApiChat, ApiMessage, ApiUser } from '../../../../api/types';
import {
  getChatTitle,
  getSenderTitle,
  isChatPrivate,
  isChatGroup,
} from '../../../../modules/helpers';
import { LangFn } from '../../../../hooks/useLang';

export function getSenderName(
  lang: LangFn, message: ApiMessage, chatsById: Record<number, ApiChat>, usersById: Record<number, ApiUser>,
) {
  const { senderId } = message;
  if (!senderId) {
    return undefined;
  }

  const sender = isChatPrivate(senderId) ? usersById[senderId] : chatsById[senderId];

  let senderName = getSenderTitle(lang, sender);

  const chat = chatsById[message.chatId];
  if (chat) {
    if (isChatPrivate(senderId) && (sender as ApiUser).isSelf) {
      senderName = `${lang('FromYou')} → ${getChatTitle(lang, chat)}`;
    } else if (isChatGroup(chat)) {
      senderName += ` → ${getChatTitle(lang, chat)}`;
    }
  }

  return senderName;
}

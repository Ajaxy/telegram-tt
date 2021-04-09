import { ApiChat, ApiMessage, ApiUser } from '../../../../api/types';
import {
  getChatTitle,
  getSenderTitle,
  isChatPrivate,
  isChatGroup,
} from '../../../../modules/helpers';

export function getSenderName(
  message: ApiMessage, chatsById: Record<number, ApiChat>, usersById: Record<number, ApiUser>,
) {
  const { senderId } = message;
  if (!senderId) {
    return undefined;
  }

  const sender = isChatPrivate(senderId) ? usersById[senderId] : chatsById[senderId];

  let senderName = getSenderTitle(sender);

  const chat = chatsById[message.chatId];
  if (chat) {
    if (isChatPrivate(senderId) && (sender as ApiUser).isSelf) {
      senderName = `You → ${getChatTitle(chat)}`;
    } else if (isChatGroup(chat)) {
      senderName += ` → ${getChatTitle(chat)}`;
    }
  }

  return senderName;
}

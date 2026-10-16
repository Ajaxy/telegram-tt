import type { ApiChat, ApiMessage, ApiUser } from '../../../../api/types';
import type { LangFn } from '../../../../util/localization';

import {
  getChatTitle,
  isChatChannel,
  isChatGroup,
} from '../../../../global/helpers';
import { getPeerTitle } from '../../../../global/helpers/peers';
import { isUserId } from '../../../../util/entities/ids';

export function getSenderName(
  lang: LangFn, message: ApiMessage, chatsById: Record<string, ApiChat>, usersById: Record<string, ApiUser>,
) {
  const { senderId, chatId, isOutgoing } = message;
  const chat = chatsById[chatId];
  const chatTitle = chat ? getChatTitle(lang, chat) : undefined;

  // Private chat messages and channel posts have no sender, so the chat itself is used instead
  if (!senderId) {
    return isOutgoing && chatTitle ? `${lang('FromYou')} → ${chatTitle}` : chatTitle;
  }

  const sender = isUserId(senderId) ? usersById[senderId] : chatsById[senderId];
  if (!sender) {
    return chatTitle;
  }

  const senderName = getPeerTitle(lang, sender);
  if (!chat) {
    return senderName;
  }

  if ('isSelf' in sender && sender.isSelf) {
    return `${lang('FromYou')} → ${chatTitle}`;
  }

  if ((isChatGroup(chat) || isChatChannel(chat)) && sender.id !== chat.id) {
    return `${senderName} → ${chatTitle}`;
  }

  return senderName;
}

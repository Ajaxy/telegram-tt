import { MessageList, MessageListType } from '../global/types';
import { MAIN_THREAD_ID } from '../api/types';

import { LOCATION_HASH } from '../hooks/useHistoryBack';

export function createMessageHash(messageList: MessageList) {
  const typeOrThreadId = messageList.type !== 'thread' ? (
    `_${messageList.type}`
  ) : messageList.threadId !== -1 ? (
    `_${messageList.threadId}`
  ) : '';

  return `${messageList.chatId}${typeOrThreadId}`;
}

export function parseLocationHash() {
  if (!LOCATION_HASH) return undefined;

  const [chatId, typeOrThreadId] = LOCATION_HASH.replace(/^#/, '').split('_');
  if (!chatId?.match(/^-?\d+$/)) return undefined;

  const isType = ['thread', 'pinned', 'scheduled'].includes(typeOrThreadId);

  return {
    chatId,
    type: Boolean(typeOrThreadId) && isType ? (typeOrThreadId as MessageListType) : 'thread',
    threadId: Boolean(typeOrThreadId) && !isType ? Number(typeOrThreadId) : MAIN_THREAD_ID,
  };
}

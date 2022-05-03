import { MessageListType } from '../global/types';
import { MAIN_THREAD_ID } from '../api/types';
import { LOCATION_HASH } from '../hooks/useHistoryBack';

export const createMessageHash = (chatId: string, type: string, threadId: number): string => (
  chatId.toString()
  + (type !== 'thread' ? `_${type}`
    : (threadId !== -1 ? `_${threadId}` : ''))
);

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

import type { GlobalState } from '../types';

import { addUnreadCount, removeUnreadCount } from './unreadCounters';

export function addUnreadPollVotes<T extends GlobalState>({
  global, chatId, ids, totalCount,
}: {
  global: T;
  chatId: string;
  ids: number[];
  totalCount?: number;
}): T {
  return addUnreadCount({
    global,
    chatId,
    messageIds: ids,
    totalCount,
    unreadCountKey: 'unreadPollVotesCount',
  });
}

export function removeUnreadPollVotes<T extends GlobalState>({
  global, chatId, ids,
}: {
  global: T;
  chatId: string;
  ids: number[];
}): T {
  return removeUnreadCount({
    global,
    chatId,
    messageIds: ids,
    unreadCountKey: 'unreadPollVotesCount',
  });
}

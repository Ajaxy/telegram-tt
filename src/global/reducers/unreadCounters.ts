import type { ApiMessage, ApiTopicWithState } from '../../api/types';
import type { ThreadId, ThreadReadState } from '../../types';
import type { GlobalState } from '../types';

import { buildCollectionByKey, unique } from '../../util/iteratees';
import { groupMessageIdsByThreadId } from '../helpers';
import { selectThreadReadState } from '../selectors/threads';
import { addChatMessagesById } from './messages';
import { replaceThreadReadStateParam } from './threads';
import { updateTopicWithState } from './topics';

type UnreadCountIdsKey = 'unreadMentions' | 'unreadReactions' | 'unreadPollVotes';
export type UnreadCountKey = 'unreadMentionsCount' | 'unreadReactionsCount' | 'unreadPollVotesCount';

type AddUnreadCountArgs<T extends GlobalState, TKey extends UnreadCountKey> = {
  global: T;
  chatId: string;
  messageIds: number[];
  totalCount?: number;
  unreadCountKey: TKey;
};

type RemoveUnreadCountArgs<T extends GlobalState, TKey extends UnreadCountKey> = {
  global: T;
  chatId: string;
  messageIds: number[];
  unreadCountKey: TKey;
};

type UpdateUnreadCountersArgs<T extends GlobalState, TKey extends UnreadCountKey> = {
  global: T;
  chatId: string;
  threadId: ThreadId;
  messages: ApiMessage[];
  topics: ApiTopicWithState[];
  totalCount: number;
  unreadCountKey: TKey;
};

const unreadIdsKeyByCountKey = {
  unreadMentionsCount: 'unreadMentions',
  unreadReactionsCount: 'unreadReactions',
  unreadPollVotesCount: 'unreadPollVotes',
} satisfies Record<UnreadCountKey, UnreadCountIdsKey>;

function getUnreadIdsKey<TKey extends UnreadCountKey>(unreadCountKey: TKey) {
  return unreadIdsKeyByCountKey[unreadCountKey];
}

function replaceThreadUnreadIds<T extends GlobalState, TKey extends UnreadCountKey>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  unreadCountKey: TKey,
  messageIds: number[] | undefined,
) {
  return replaceThreadReadStateParam(global, chatId, threadId, getUnreadIdsKey(unreadCountKey), messageIds);
}

function replaceThreadUnreadCount<T extends GlobalState, TKey extends UnreadCountKey>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  unreadCountKey: TKey,
  count: number | undefined,
) {
  return replaceThreadReadStateParam(global, chatId, threadId, unreadCountKey, count);
}

function selectThreadUnreadIds<TKey extends UnreadCountKey>(
  readState: ThreadReadState | undefined,
  unreadCountKey: TKey,
) {
  return readState?.[getUnreadIdsKey(unreadCountKey)];
}

export function addUnreadCount<T extends GlobalState, TKey extends UnreadCountKey>({
  global,
  chatId,
  messageIds,
  totalCount,
  unreadCountKey,
}: AddUnreadCountArgs<T, TKey>): T {
  const messageIdsByThreadId = groupMessageIdsByThreadId(global, chatId, messageIds, false);

  for (const threadId in messageIdsByThreadId) {
    const threadMessageIds = messageIdsByThreadId[threadId];
    if (totalCount !== undefined) {
      global = replaceThreadUnreadIds(global, chatId, threadId, unreadCountKey, threadMessageIds);
      global = replaceThreadUnreadCount(global, chatId, threadId, unreadCountKey, totalCount);
      continue;
    }

    const readState = selectThreadReadState(global, chatId, threadId);
    const previousIds = selectThreadUnreadIds(readState, unreadCountKey) || [];
    const updatedIds = unique([...previousIds, ...threadMessageIds]).sort((a, b) => b - a);

    global = replaceThreadUnreadIds(global, chatId, threadId, unreadCountKey, updatedIds);

    const delta = updatedIds.length - previousIds.length;
    if (delta > 0) {
      global = replaceThreadUnreadCount(
        global,
        chatId,
        threadId,
        unreadCountKey,
        (readState?.[unreadCountKey] || 0) + delta,
      );
    }
  }

  return global;
}

export function removeUnreadCount<T extends GlobalState, TKey extends UnreadCountKey>({
  global,
  chatId,
  messageIds,
  unreadCountKey,
}: RemoveUnreadCountArgs<T, TKey>): T {
  const messageIdsByThreadId = groupMessageIdsByThreadId(global, chatId, messageIds, false);

  for (const threadId in messageIdsByThreadId) {
    const threadMessageIds = messageIdsByThreadId[threadId];
    const threadMessageIdSet = new Set(threadMessageIds);
    const readState = selectThreadReadState(global, chatId, threadId);
    const previousIds = selectThreadUnreadIds(readState, unreadCountKey) || [];
    const updatedIds = previousIds.filter((id) => !threadMessageIdSet.has(id));

    global = replaceThreadUnreadIds(global, chatId, threadId, unreadCountKey, updatedIds);

    const previousCount = readState?.[unreadCountKey];
    const delta = previousIds.length - updatedIds.length;

    if (delta > 0 && previousCount) {
      global = replaceThreadUnreadCount(
        global,
        chatId,
        threadId,
        unreadCountKey,
        Math.max(previousCount - delta, 0),
      );
    }
  }

  return global;
}

export function updateUnreadCounters<T extends GlobalState, TKey extends UnreadCountKey>({
  global,
  chatId,
  threadId,
  messages,
  topics,
  totalCount,
  unreadCountKey,
}: UpdateUnreadCountersArgs<T, TKey>): T {
  const messagesById = buildCollectionByKey(messages, 'id');

  global = addChatMessagesById(global, chatId, messagesById);
  topics.forEach((topicState) => {
    global = updateTopicWithState(global, chatId, topicState);
  });

  const messageIds = Object.keys(messagesById).map(Number).sort((a, b) => b - a);
  global = replaceThreadUnreadIds(global, chatId, threadId, unreadCountKey, messageIds);
  global = replaceThreadUnreadCount(global, chatId, threadId, unreadCountKey, totalCount);

  return global;
}

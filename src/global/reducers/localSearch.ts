import type { ApiMessageSearchType, ApiReaction } from '../../api/types';
import type { SharedMediaType, ThreadId } from '../../types';
import type { GlobalState, TabArgs } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { areSortedArraysEqual, unique } from '../../util/iteratees';
import { buildChatThreadKey } from '../helpers';
import { selectTabState } from '../selectors';
import { updateTabState } from './tabs';

interface TextSearchParams {
  query?: string;
  savedTag?: ApiReaction;
  results?: {
    totalCount?: number;
    nextOffsetId?: number;
    foundIds?: number[];
  };
}

interface MediaSearchParams {
  currentType?: SharedMediaType;
  resultsByType?: Partial<Record<SharedMediaType, {
    totalCount?: number;
    nextOffsetId: number;
    foundIds: number[];
  }>>;
}

function replaceLocalTextSearch<T extends GlobalState>(
  global: T,
  chatThreadKey: string,
  searchParams: TextSearchParams,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    localTextSearch: {
      byChatThreadKey: {
        ...selectTabState(global, tabId).localTextSearch.byChatThreadKey,
        [chatThreadKey]: searchParams,
      },
    },
  }, tabId);
}

export function updateLocalTextSearch<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  query?: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return replaceLocalTextSearch(global, chatThreadKey, {
    ...selectTabState(global, tabId).localTextSearch.byChatThreadKey[chatThreadKey],
    query,
  }, tabId);
}

export function updateLocalTextSearchTag<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  tag?: ApiReaction,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  const currentSearch = selectTabState(global, tabId).localTextSearch.byChatThreadKey[chatThreadKey];
  const query = currentSearch?.query || '';

  return replaceLocalTextSearch(global, chatThreadKey, {
    ...currentSearch,
    query,
    savedTag: tag,
  }, tabId);
}

export function replaceLocalTextSearchResults<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  foundIds?: number[],
  totalCount?: number,
  nextOffsetId?: number,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return replaceLocalTextSearch(global, chatThreadKey, {
    ...selectTabState(global, tabId).localTextSearch.byChatThreadKey[chatThreadKey],
    results: {
      foundIds,
      totalCount,
      nextOffsetId,
    },
  }, tabId);
}

export function updateLocalTextSearchResults<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  newFoundIds: number[],
  totalCount?: number,
  nextOffsetId?: number,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const chatThreadKey = buildChatThreadKey(chatId, threadId);
  const { results } = selectTabState(global, tabId).localTextSearch.byChatThreadKey[chatThreadKey] || {};
  const prevFoundIds = (results?.foundIds) || [];
  const foundIds = orderFoundIds(unique(Array.prototype.concat(prevFoundIds, newFoundIds)));
  const foundOrPrevFoundIds = areSortedArraysEqual(prevFoundIds, foundIds) ? prevFoundIds : foundIds;

  return replaceLocalTextSearchResults(global, chatId, threadId, foundOrPrevFoundIds, totalCount, nextOffsetId, tabId);
}

function replaceLocalMediaSearch<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  searchParams: MediaSearchParams,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return updateTabState(global, {
    localMediaSearch: {
      byChatThreadKey: {
        ...selectTabState(global, tabId).localMediaSearch.byChatThreadKey,
        [chatThreadKey]: searchParams,
      },
    },
  }, tabId);
}

export function updateLocalMediaSearchType<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  currentType: SharedMediaType | undefined,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return replaceLocalMediaSearch(global, chatId, threadId, {
    ...selectTabState(global, tabId).localMediaSearch.byChatThreadKey[chatThreadKey],
    currentType,
  }, tabId);
}

export function replaceLocalMediaSearchResults<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  type: ApiMessageSearchType,
  foundIds?: number[],
  totalCount?: number,
  nextOffsetId?: number,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return replaceLocalMediaSearch(global, chatId, threadId, {
    ...selectTabState(global, tabId).localMediaSearch.byChatThreadKey[chatThreadKey],
    resultsByType: {
      ...(selectTabState(global, tabId).localMediaSearch.byChatThreadKey[chatThreadKey] || {}).resultsByType,
      [type]: {
        foundIds,
        totalCount,
        nextOffsetId,
      },
    },
  }, tabId);
}

export function updateLocalMediaSearchResults<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  type: SharedMediaType,
  newFoundIds: number[],
  totalCount?: number,
  nextOffsetId?: number,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  const { resultsByType } = selectTabState(global, tabId).localMediaSearch.byChatThreadKey[chatThreadKey] || {};
  const prevFoundIds = resultsByType?.[type] ? resultsByType[type]!.foundIds : [];
  const foundIds = orderFoundIds(unique(Array.prototype.concat(prevFoundIds, newFoundIds)));
  const foundOrPrevFoundIds = areSortedArraysEqual(prevFoundIds, foundIds) ? prevFoundIds : foundIds;

  return replaceLocalMediaSearchResults(
    global,
    chatId,
    threadId,
    type,
    foundOrPrevFoundIds,
    totalCount,
    nextOffsetId,
    tabId,
  );
}

function orderFoundIds(listedIds: number[]) {
  return listedIds.sort((a, b) => b - a);
}

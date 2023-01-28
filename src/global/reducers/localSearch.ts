import type { GlobalState, TabArgs } from '../types';
import type { ApiMessageSearchType } from '../../api/types';

import { areSortedArraysEqual, unique } from '../../util/iteratees';
import type { SharedMediaType } from '../../types';
import { buildChatThreadKey } from '../helpers';
import { updateTabState } from './tabs';
import { selectTabState } from '../selectors';
import { getCurrentTabId } from '../../util/establishMultitabRole';

interface TextSearchParams {
  isActive: boolean;
  query?: string;
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
  threadId: number,
  isActive: boolean,
  query?: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return replaceLocalTextSearch(global, chatThreadKey, {
    ...selectTabState(global, tabId).localTextSearch.byChatThreadKey[chatThreadKey],
    isActive,
    query,
  }, tabId);
}

export function replaceLocalTextSearchResults<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: number,
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
  threadId: number,
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
  threadId: number,
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
  threadId: number,
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
  threadId: number,
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
  threadId: number,
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

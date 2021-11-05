import { GlobalState } from '../../global/types';
import { ApiMessageSearchType } from '../../api/types';

import { areSortedArraysEqual, unique } from '../../util/iteratees';
import { SharedMediaType } from '../../types';
import { buildChatThreadKey } from '../helpers';

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

function replaceLocalTextSearch(
  global: GlobalState,
  chatThreadKey: string,
  searchParams: TextSearchParams,
): GlobalState {
  return {
    ...global,
    localTextSearch: {
      byChatThreadKey: {
        ...global.localTextSearch.byChatThreadKey,
        [chatThreadKey]: searchParams,
      },
    },
  };
}

export function updateLocalTextSearch(
  global: GlobalState,
  chatId: string,
  threadId: number,
  isActive: boolean,
  query?: string,
): GlobalState {
  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return replaceLocalTextSearch(global, chatThreadKey, {
    ...global.localTextSearch.byChatThreadKey[chatThreadKey],
    isActive,
    query,
  });
}

export function replaceLocalTextSearchResults(
  global: GlobalState,
  chatId: string,
  threadId: number,
  foundIds?: number[],
  totalCount?: number,
  nextOffsetId?: number,
): GlobalState {
  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return replaceLocalTextSearch(global, chatThreadKey, {
    ...global.localTextSearch.byChatThreadKey[chatThreadKey],
    results: {
      foundIds,
      totalCount,
      nextOffsetId,
    },
  });
}

export function updateLocalTextSearchResults(
  global: GlobalState,
  chatId: string,
  threadId: number,
  newFoundIds: number[],
  totalCount?: number,
  nextOffsetId?: number,
): GlobalState {
  const chatThreadKey = buildChatThreadKey(chatId, threadId);
  const { results } = global.localTextSearch.byChatThreadKey[chatThreadKey] || {};
  const prevFoundIds = (results?.foundIds) || [];
  const foundIds = orderFoundIds(unique(Array.prototype.concat(prevFoundIds, newFoundIds)));
  const foundOrPrevFoundIds = areSortedArraysEqual(prevFoundIds, foundIds) ? prevFoundIds : foundIds;

  return replaceLocalTextSearchResults(global, chatId, threadId, foundOrPrevFoundIds, totalCount, nextOffsetId);
}

function replaceLocalMediaSearch(
  global: GlobalState,
  chatId: string,
  searchParams: MediaSearchParams,
): GlobalState {
  return {
    ...global,
    localMediaSearch: {
      byChatId: {
        ...global.localMediaSearch.byChatId,
        [chatId]: searchParams,
      },
    },
  };
}

export function updateLocalMediaSearchType(
  global: GlobalState,
  chatId: string,
  currentType: SharedMediaType | undefined,
): GlobalState {
  return replaceLocalMediaSearch(global, chatId, {
    ...global.localMediaSearch.byChatId[chatId],
    currentType,
  });
}

export function replaceLocalMediaSearchResults(
  global: GlobalState,
  chatId: string,
  type: ApiMessageSearchType,
  foundIds?: number[],
  totalCount?: number,
  nextOffsetId?: number,
): GlobalState {
  return replaceLocalMediaSearch(global, chatId, {
    ...global.localMediaSearch.byChatId[chatId],
    resultsByType: {
      ...(global.localMediaSearch.byChatId[chatId] || {}).resultsByType,
      [type]: {
        foundIds,
        totalCount,
        nextOffsetId,
      },
    },
  });
}

export function updateLocalMediaSearchResults(
  global: GlobalState,
  chatId: string,
  type: SharedMediaType,
  newFoundIds: number[],
  totalCount?: number,
  nextOffsetId?: number,
): GlobalState {
  const { resultsByType } = global.localMediaSearch.byChatId[chatId] || {};
  const prevFoundIds = resultsByType?.[type] ? resultsByType[type]!.foundIds : [];
  const foundIds = orderFoundIds(unique(Array.prototype.concat(prevFoundIds, newFoundIds)));
  const foundOrPrevFoundIds = areSortedArraysEqual(prevFoundIds, foundIds) ? prevFoundIds : foundIds;

  return replaceLocalMediaSearchResults(global, chatId, type, foundOrPrevFoundIds, totalCount, nextOffsetId);
}

function orderFoundIds(listedIds: number[]) {
  return listedIds.sort((a, b) => a - b);
}

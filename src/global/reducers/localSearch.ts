import type { ApiMessage, ApiMessageSearchType, ApiReaction } from '../../api/types';
import type {
  ChatMediaSearchParams, ChatMediaSearchSegment, LoadingState,
  SharedMediaType, ThreadId,
} from '../../types';
import type { GlobalState, TabArgs } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { areSortedArraysEqual, areSortedArraysIntersecting, unique } from '../../util/iteratees';
import { buildChatThreadKey, isMediaLoadableInViewer } from '../helpers';
import { selectTabState } from '../selectors';
import { selectChatMediaSearch } from '../selectors/localSearch';
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

interface SharedMediaSearchParams {
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
  const foundIds = orderFoundIdsByDescending(unique(Array.prototype.concat(prevFoundIds, newFoundIds)));
  const foundOrPrevFoundIds = areSortedArraysEqual(prevFoundIds, foundIds) ? prevFoundIds : foundIds;

  return replaceLocalTextSearchResults(global, chatId, threadId, foundOrPrevFoundIds, totalCount, nextOffsetId, tabId);
}

function replaceSharedMediaSearch<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  searchParams: SharedMediaSearchParams,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return updateTabState(global, {
    sharedMediaSearch: {
      byChatThreadKey: {
        ...selectTabState(global, tabId).sharedMediaSearch.byChatThreadKey,
        [chatThreadKey]: searchParams,
      },
    },
  }, tabId);
}

export function updateSharedMediaSearchType<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  currentType: SharedMediaType | undefined,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return replaceSharedMediaSearch(global, chatId, threadId, {
    ...selectTabState(global, tabId).sharedMediaSearch.byChatThreadKey[chatThreadKey],
    currentType,
  }, tabId);
}

export function replaceSharedMediaSearchResults<T extends GlobalState>(
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

  return replaceSharedMediaSearch(global, chatId, threadId, {
    ...selectTabState(global, tabId).sharedMediaSearch.byChatThreadKey[chatThreadKey],
    resultsByType: {
      ...(selectTabState(global, tabId).sharedMediaSearch.byChatThreadKey[chatThreadKey] || {}).resultsByType,
      [type]: {
        foundIds,
        totalCount,
        nextOffsetId,
      },
    },
  }, tabId);
}

export function updateSharedMediaSearchResults<T extends GlobalState>(
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

  const { resultsByType } = selectTabState(global, tabId).sharedMediaSearch.byChatThreadKey[chatThreadKey] || {};
  const prevFoundIds = resultsByType?.[type] ? resultsByType[type]!.foundIds : [];
  const foundIds = orderFoundIdsByDescending(unique(Array.prototype.concat(prevFoundIds, newFoundIds)));
  const foundOrPrevFoundIds = areSortedArraysEqual(prevFoundIds, foundIds) ? prevFoundIds : foundIds;

  return replaceSharedMediaSearchResults(
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

function orderFoundIdsByDescending(listedIds: number[]) {
  return listedIds.sort((a, b) => b - a);
}

function orderFoundIdsByAscending(array: number[]) {
  return array.sort((a, b) => a - b);
}

export function mergeWithChatMediaSearchSegment(
  foundIds: number[],
  loadingState: LoadingState,
  segment?: ChatMediaSearchSegment,
)
  : ChatMediaSearchSegment {
  if (!segment) {
    return {
      foundIds,
      loadingState,
    };
  }
  const mergedFoundIds = orderFoundIdsByAscending(unique(Array.prototype.concat(segment.foundIds, foundIds)));
  if (!areSortedArraysEqual(segment.foundIds, foundIds)) {
    segment.foundIds = mergedFoundIds;
  }
  const mergedLoadingState : LoadingState = {
    areAllItemsLoadedForwards: loadingState.areAllItemsLoadedForwards
    || segment.loadingState.areAllItemsLoadedForwards,
    areAllItemsLoadedBackwards: loadingState.areAllItemsLoadedBackwards
    || segment.loadingState.areAllItemsLoadedBackwards,
  };
  segment.loadingState = mergedLoadingState;
  return segment;
}

function mergeChatMediaSearchSegments(currentSegment: ChatMediaSearchSegment, segments: ChatMediaSearchSegment[]) {
  return segments.reduce((acc, segment) => {
    const hasIntersection = areSortedArraysIntersecting(segment.foundIds, currentSegment.foundIds);
    if (hasIntersection) {
      currentSegment = mergeWithChatMediaSearchSegment(
        currentSegment.foundIds,
        currentSegment.loadingState,
        segment,
      );
    } else {
      acc.push(segment);
    }
    return acc;
  }, [] as ChatMediaSearchSegment[]);
}

export function updateChatMediaSearchResults<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  currentSegment: ChatMediaSearchSegment,
  searchParams: ChatMediaSearchParams,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const segments = mergeChatMediaSearchSegments(currentSegment, searchParams.segments);

  return replaceChatMediaSearchResults(
    global,
    chatId,
    threadId,
    currentSegment,
    segments,
    tabId,
  );
}

function removeIdFromSegment(id: number, segment: ChatMediaSearchSegment): ChatMediaSearchSegment {
  const foundIds = segment.foundIds.filter((foundId) => foundId !== id);

  return {
    ...segment,
    foundIds,
  };
}

function removeIdsFromChatMediaSearchParams(
  id: number,
  searchParams: ChatMediaSearchParams,
): ChatMediaSearchParams {
  const currentSegment = removeIdFromSegment(id, searchParams.currentSegment);
  const segments = searchParams.segments.map((segment) => removeIdFromSegment(id, segment));

  return {
    ...searchParams,
    currentSegment,
    segments,
  };
}

export function removeIdFromSearchResults<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  id: number,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const searchParams = selectChatMediaSearch(global, chatId, threadId, tabId);
  if (!searchParams) return global;

  const updatedSearchParams = removeIdsFromChatMediaSearchParams(id, searchParams);

  return replaceChatMediaSearch(
    global,
    chatId,
    threadId,
    updatedSearchParams,
    tabId,
  );
}

function resetForwardsLoadingStateInParams(
  searchParams: ChatMediaSearchParams,
) {
  searchParams.currentSegment.loadingState.areAllItemsLoadedForwards = false;
  searchParams.segments.forEach((segment) => {
    segment.loadingState.areAllItemsLoadedForwards = false;
  });
}

export function updateChatMediaLoadingState<T extends GlobalState>(
  global: T,
  newMessage: ApiMessage,
  chatId: string,
  threadId: ThreadId,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  if (!isMediaLoadableInViewer(newMessage)) {
    return global;
  }
  const searchParams = selectChatMediaSearch(global, chatId, threadId, tabId);
  if (!searchParams) return global;
  resetForwardsLoadingStateInParams(searchParams);

  return replaceChatMediaSearch(
    global,
    chatId,
    threadId,
    searchParams,
    tabId,
  );
}

export function initializeChatMediaSearchResults<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const loadingState: LoadingState = {
    areAllItemsLoadedForwards: false,
    areAllItemsLoadedBackwards: false,
  };
  const currentSegment: ChatMediaSearchSegment = {
    foundIds: [],
    loadingState,
  };
  const segments: ChatMediaSearchSegment[] = [];

  const isLoading = false;

  return replaceChatMediaSearch(global, chatId, threadId, {
    currentSegment,
    segments,
    isLoading,
  }, tabId);
}

export function setChatMediaSearchLoading<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  isLoading: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const chatThreadKey = buildChatThreadKey(chatId, threadId);
  const searchParams = selectTabState(global, tabId).chatMediaSearch.byChatThreadKey[chatThreadKey];

  if (!searchParams) {
    return global;
  }

  return replaceChatMediaSearch(global, chatId, threadId, {
    ...searchParams,
    isLoading,
  }, tabId);
}

export function replaceChatMediaSearchResults<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  currentSegment: ChatMediaSearchSegment,
  segments: ChatMediaSearchSegment[],
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return replaceChatMediaSearch(global, chatId, threadId, {
    ...selectTabState(global, tabId).chatMediaSearch.byChatThreadKey[chatThreadKey],
    currentSegment,
    segments,
  }, tabId);
}

function replaceChatMediaSearch<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  searchParams: ChatMediaSearchParams,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const chatThreadKey = buildChatThreadKey(chatId, threadId);

  return updateTabState(global, {
    chatMediaSearch: {
      byChatThreadKey: {
        ...selectTabState(global, tabId).chatMediaSearch.byChatThreadKey,
        [chatThreadKey]: searchParams,
      },
    },
  }, tabId);
}

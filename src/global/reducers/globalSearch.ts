import type { GlobalState, TabState, TabArgs } from '../types';
import type { GlobalSearchContent } from '../../types';
import type { ApiGlobalMessageSearchType, ApiMessage } from '../../api/types';
import { areSortedArraysEqual } from '../../util/iteratees';
import { updateTabState } from './tabs';
import { selectTabState } from '../selectors';
import { getCurrentTabId } from '../../util/establishMultitabRole';

const getComplexKey = (message: ApiMessage) => `${message.chatId}_${message.id}`;

export function updateGlobalSearch<T extends GlobalState>(
  global: T,
  searchStatePartial: Partial<TabState['globalSearch']>,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    globalSearch: {
      ...selectTabState(global, tabId).globalSearch,
      ...searchStatePartial,
    },
  }, tabId);
}

export function updateGlobalSearchContent<T extends GlobalState>(
  global: T,
  currentContent: GlobalSearchContent | undefined,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateGlobalSearch(global, { currentContent }, tabId);
}

export function updateGlobalSearchResults<T extends GlobalState>(
  global: T,
  newFoundMessages: ApiMessage[],
  totalCount: number,
  type: ApiGlobalMessageSearchType,
  nextRate?: number,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const { resultsByType } = selectTabState(global, tabId).globalSearch || {};
  const newFoundMessagesById = newFoundMessages.reduce((result, message) => {
    result[getComplexKey(message)] = message;

    return result;
  }, {} as Record<string, ApiMessage>);
  const foundIdsForType = resultsByType?.[type]?.foundIds;

  if (foundIdsForType !== undefined
    && Object.keys(newFoundMessagesById).every(
      (newId) => foundIdsForType.includes(getComplexKey(newFoundMessagesById[newId])),
    )
  ) {
    return updateGlobalSearchFetchingStatus(global, { messages: false }, tabId);
  }

  const prevFoundIds = foundIdsForType || [];
  const newFoundIds = newFoundMessages.map((message) => getComplexKey(message));
  const foundIds = Array.prototype.concat(prevFoundIds, newFoundIds);
  const foundOrPrevFoundIds = areSortedArraysEqual(prevFoundIds, foundIds) ? prevFoundIds : foundIds;

  global = updateGlobalSearchFetchingStatus(global, { messages: false }, tabId);

  return updateGlobalSearch(global, {
    resultsByType: {
      ...(selectTabState(global, tabId).globalSearch || {}).resultsByType,
      [type]: {
        totalCount,
        nextOffsetId: nextRate,
        foundIds: foundOrPrevFoundIds,
      },
    },
  }, tabId);
}

export function updateGlobalSearchFetchingStatus<T extends GlobalState>(
  global: T, newState: { chats?: boolean; messages?: boolean },
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateGlobalSearch(global, {
    fetchingStatus: {
      ...selectTabState(global, tabId).globalSearch.fetchingStatus,
      ...newState,
    },
  }, tabId);
}

import type { ApiGlobalMessageSearchType, ApiMessage } from '../../api/types';
import type { GlobalSearchContent } from '../../types';
import type { GlobalState, TabArgs, TabState } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { areSortedArraysEqual } from '../../util/iteratees';
import { getSearchResultKey } from '../../util/keys/searchResultKey';
import { selectTabState } from '../selectors';
import { updateTabState } from './tabs';

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
  nextOffsetRate?: number,
  nextOffsetId?: number,
  nextOffsetPeerId?: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const { resultsByType } = selectTabState(global, tabId).globalSearch || {};
  const newFoundMessagesById = newFoundMessages.reduce((result, message) => {
    result[getSearchResultKey(message)] = message;

    return result;
  }, {} as Record<string, ApiMessage>);
  const foundIdsForType = resultsByType?.[type]?.foundIds;

  if (foundIdsForType !== undefined
    && Object.keys(newFoundMessagesById).every(
      (newId) => foundIdsForType.includes(getSearchResultKey(newFoundMessagesById[newId])),
    )
  ) {
    global = updateGlobalSearchFetchingStatus(global, { messages: false }, tabId);
    return updateGlobalSearch(global, {
      resultsByType: {
        ...(selectTabState(global, tabId).globalSearch || {}).resultsByType,
        [type]: {
          foundIds: foundIdsForType,
          totalCount,
          nextOffsetId,
          nextOffsetRate,
          nextOffsetPeerId,
        },
      },
    }, tabId);
  }

  const prevFoundIds = foundIdsForType || [];
  const newFoundIds = newFoundMessages
    .map((message) => getSearchResultKey(message))
    .filter((id) => !prevFoundIds.includes(id));
  const foundIds = Array.prototype.concat(prevFoundIds, newFoundIds);
  const foundOrPrevFoundIds = areSortedArraysEqual(prevFoundIds, foundIds) ? prevFoundIds : foundIds;

  global = updateGlobalSearchFetchingStatus(global, { messages: false }, tabId);

  return updateGlobalSearch(global, {
    resultsByType: {
      ...(selectTabState(global, tabId).globalSearch || {}).resultsByType,
      [type]: {
        totalCount,
        nextOffsetId,
        nextOffsetRate,
        nextOffsetPeerId,
        foundIds: foundOrPrevFoundIds,
      },
    },
  }, tabId);
}

export function updateGlobalSearchFetchingStatus<T extends GlobalState>(
  global: T, newState: { chats?: boolean; messages?: boolean; botApps?: boolean },
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateGlobalSearch(global, {
    fetchingStatus: {
      ...selectTabState(global, tabId).globalSearch.fetchingStatus,
      ...newState,
    },
  }, tabId);
}

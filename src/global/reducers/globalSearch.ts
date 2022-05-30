import type { GlobalState } from '../types';
import type { GlobalSearchContent } from '../../types';
import type { ApiGlobalMessageSearchType, ApiMessage } from '../../api/types';
import { areSortedArraysEqual } from '../../util/iteratees';

const getComplexKey = (message: ApiMessage) => `${message.chatId}_${message.id}`;

export function updateGlobalSearch(
  global: GlobalState,
  searchStatePartial: Partial<GlobalState['globalSearch']>,
) {
  return {
    ...global,
    globalSearch: {
      ...global.globalSearch,
      ...searchStatePartial,
    },
  };
}

export function updateGlobalSearchContent(
  global: GlobalState,
  currentContent: GlobalSearchContent | undefined,
): GlobalState {
  return updateGlobalSearch(global, { currentContent });
}

export function updateGlobalSearchResults(
  global: GlobalState,
  newFoundMessages: ApiMessage[],
  totalCount: number,
  type: ApiGlobalMessageSearchType,
  nextRate?: number,
): GlobalState {
  const { resultsByType } = global.globalSearch || {};
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
    return updateGlobalSearchFetchingStatus(global, { messages: false });
  }

  const prevFoundIds = foundIdsForType || [];
  const newFoundIds = newFoundMessages.map((message) => getComplexKey(message));
  const foundIds = Array.prototype.concat(prevFoundIds, newFoundIds);
  const foundOrPrevFoundIds = areSortedArraysEqual(prevFoundIds, foundIds) ? prevFoundIds : foundIds;

  global = updateGlobalSearchFetchingStatus(global, { messages: false });

  return updateGlobalSearch(global, {
    resultsByType: {
      ...(global.globalSearch || {}).resultsByType,
      [type]: {
        totalCount,
        nextOffsetId: nextRate,
        foundIds: foundOrPrevFoundIds,
      },
    },
  });
}

export function updateGlobalSearchFetchingStatus(
  global: GlobalState, newState: { chats?: boolean; messages?: boolean },
) {
  return updateGlobalSearch(global, {
    fetchingStatus: {
      ...global.globalSearch.fetchingStatus,
      ...newState,
    },
  });
}

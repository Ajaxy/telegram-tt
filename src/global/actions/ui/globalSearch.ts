import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler } from '../../index';
import { updateGlobalSearch, updateGlobalSearchContent } from '../../reducers';
import { selectTabState } from '../../selectors';

const MAX_RECENTLY_FOUND_IDS = 10;

addActionHandler('setGlobalSearchQuery', (global, actions, payload): ActionReturnType => {
  const { query, tabId = getCurrentTabId() } = payload!;
  const { chatId } = selectTabState(global, tabId).globalSearch;

  return updateGlobalSearch(global, {
    globalResults: {},
    localResults: {},
    resultsByType: undefined,
    ...(query ? { fetchingStatus: { chats: !chatId, messages: true } } : { fetchingStatus: undefined }),
    query,
  }, tabId);
});

addActionHandler('setGlobalSearchClosing', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId(), isClosing } = payload || {};
  return updateGlobalSearch(global, {
    isClosing,
  }, tabId);
});

addActionHandler('addRecentlyFoundChatId', (global, actions, payload): ActionReturnType => {
  const { id } = payload!;
  const { recentlyFoundChatIds } = global;

  if (!recentlyFoundChatIds) {
    return {
      ...global,
      recentlyFoundChatIds: [id],
    };
  }

  const newRecentIds = recentlyFoundChatIds.filter((chatId) => chatId !== id);
  newRecentIds.unshift(id);
  if (newRecentIds.length > MAX_RECENTLY_FOUND_IDS) {
    newRecentIds.pop();
  }

  return {
    ...global,
    recentlyFoundChatIds: newRecentIds,
  };
});

addActionHandler('clearRecentlyFoundChats', (global): ActionReturnType => {
  return {
    ...global,
    recentlyFoundChatIds: undefined,
  };
});

addActionHandler('setGlobalSearchContent', (global, actions, payload): ActionReturnType => {
  const { content, tabId = getCurrentTabId() } = payload;

  return updateGlobalSearchContent(global, content, tabId);
});

addActionHandler('setGlobalSearchChatId', (global, actions, payload): ActionReturnType => {
  const { id, tabId = getCurrentTabId() } = payload;

  return updateGlobalSearch(global, { chatId: id, query: undefined, resultsByType: undefined }, tabId);
});

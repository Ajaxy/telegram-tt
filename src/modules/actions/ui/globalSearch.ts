import { addReducer } from '../../../lib/teact/teactn';

import { updateGlobalSearch, updateGlobalSearchContent } from '../../reducers';

const MAX_RECENTLY_FOUND_IDS = 10;

addReducer('setGlobalSearchQuery', (global, actions, payload) => {
  const { query } = payload!;
  const { chatId } = global.globalSearch;

  return updateGlobalSearch(global, {
    globalResults: {},
    localResults: {},
    resultsByType: undefined,
    ...(query ? { fetchingStatus: { chats: !chatId, messages: true } } : { fetchingStatus: undefined }),
    query,
  });
});

addReducer('addRecentlyFoundChatId', (global, actions, payload) => {
  const { id } = payload!;
  const { recentlyFoundChatIds } = global.globalSearch;

  if (!recentlyFoundChatIds) {
    return updateGlobalSearch(global, { recentlyFoundChatIds: [id] });
  }

  const newRecentIds = recentlyFoundChatIds.filter((chatId) => chatId !== id);
  newRecentIds.unshift(id);
  if (newRecentIds.length > MAX_RECENTLY_FOUND_IDS) {
    newRecentIds.pop();
  }

  return updateGlobalSearch(global, { recentlyFoundChatIds: newRecentIds });
});

addReducer('clearRecentlyFoundChats', (global) => {
  return updateGlobalSearch(global, { recentlyFoundChatIds: undefined });
});

addReducer('setGlobalSearchContent', (global, actions, payload) => {
  const { content } = payload!;

  return updateGlobalSearchContent(global, content);
});

addReducer('setGlobalSearchChatId', (global, actions, payload) => {
  const { id } = payload!;

  return updateGlobalSearch(global, { chatId: id, query: undefined, resultsByType: undefined });
});

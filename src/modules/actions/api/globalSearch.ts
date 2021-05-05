import { addReducer, getGlobal, setGlobal } from '../../../lib/teact/teactn';

import { callApi } from '../../../api/gramjs';
import { ApiChat, ApiGlobalMessageSearchType } from '../../../api/types';

import {
  addChats,
  addMessages,
  addUsers,
  updateGlobalSearch,
  updateGlobalSearchFetchingStatus,
  updateGlobalSearchResults,
} from '../../reducers';
import { throttle } from '../../../util/schedulers';
import { selectChat, selectCurrentGlobalSearchQuery } from '../../selectors';
import { buildCollectionByKey } from '../../../util/iteratees';
import { GLOBAL_SEARCH_SLICE } from '../../../config';
import { timestampPlusDay } from '../../../util/dateFormat';

const searchThrottled = throttle((cb) => cb(), 500, false);

addReducer('setGlobalSearchQuery', (global, actions, payload) => {
  const { chatId } = global.globalSearch;
  const { query } = payload!;

  if (query && !chatId) {
    void searchThrottled(() => {
      searchChats(query);
    });
  }
});

addReducer('setGlobalSearchDate', (global, actions, payload) => {
  const { date } = payload!;
  const maxDate = date ? timestampPlusDay(date) : date;
  const newGlobal = updateGlobalSearch(global, {
    date,
    query: '',
    resultsByType: {
      ...global.globalSearch.resultsByType,
      text: {
        totalCount: undefined,
        foundIds: [],
        nextOffsetId: 0,
      },
    },
  });
  setGlobal(newGlobal);
  const { chatId } = global.globalSearch;
  const chat = chatId ? selectChat(global, chatId) : undefined;
  searchMessagesGlobal('', 'text', undefined, chat, maxDate, date);
});

addReducer('searchMessagesGlobal', (global, actions, payload) => {
  const {
    query, resultsByType, chatId, date,
  } = global.globalSearch;
  const maxDate = date ? timestampPlusDay(date) : date;
  const { type } = payload;
  const { nextOffsetId } = (resultsByType && resultsByType[type as ApiGlobalMessageSearchType]) || {};

  const chat = chatId ? selectChat(global, chatId) : undefined;

  searchMessagesGlobal(query, type, nextOffsetId, chat, maxDate, date);
});

async function searchChats(query: string) {
  const result = await callApi('searchChats', { query });

  let global = getGlobal();
  const currentSearchQuery = selectCurrentGlobalSearchQuery(global);
  if (!result || !currentSearchQuery || (query !== currentSearchQuery)) {
    setGlobal(updateGlobalSearchFetchingStatus(global, { chats: false }));
    return;
  }

  const {
    localChats, localUsers, globalChats, globalUsers,
  } = result;

  if (localChats.length || globalChats.length) {
    global = addChats(global, buildCollectionByKey([...localChats, ...globalChats], 'id'));
  }

  if (localUsers.length || globalUsers.length) {
    global = addUsers(global, buildCollectionByKey([...localUsers, ...globalUsers], 'id'));
  }

  global = updateGlobalSearchFetchingStatus(global, { chats: false });
  global = updateGlobalSearch(global, {
    localResults: {
      chatIds: localChats.map(({ id }) => id),
      userIds: localUsers.map(({ id }) => id),
    },
    globalResults: {
      ...global.globalSearch.globalResults,
      chatIds: globalUsers.map(({ id }) => id),
      userIds: globalChats.map(({ id }) => id),
    },
  });

  setGlobal(global);
}

async function searchMessagesGlobal(
  query = '', type: ApiGlobalMessageSearchType, offsetRate?: number, chat?: ApiChat, maxDate?: number, minDate?: number,
) {
  let result;

  if (chat) {
    const localResult = await callApi('searchMessagesLocal', {
      chatOrUser: chat,
      query,
      type,
      limit: GLOBAL_SEARCH_SLICE,
      offsetId: offsetRate,
      minDate,
      maxDate,
    });

    if (localResult) {
      const {
        messages, users, totalCount, nextOffsetId,
      } = localResult;

      result = {
        messages,
        users,
        chats: [],
        totalCount,
        nextRate: nextOffsetId,
      };
    }
  } else {
    result = await callApi('searchMessagesGlobal', {
      query,
      offsetRate,
      limit: GLOBAL_SEARCH_SLICE,
      type,
      maxDate,
      minDate,
    });
  }

  let global = getGlobal();
  const currentSearchQuery = selectCurrentGlobalSearchQuery(global);
  if (!result || (query !== '' && query !== currentSearchQuery)) {
    setGlobal(updateGlobalSearchFetchingStatus(global, { messages: false }));
    return;
  }

  const {
    messages, users, chats, totalCount, nextRate,
  } = result;

  if (chats.length) {
    global = addChats(global, buildCollectionByKey(chats, 'id'));
  }

  if (users.length) {
    global = addUsers(global, buildCollectionByKey(users, 'id'));
  }

  if (messages.length) {
    global = addMessages(global, messages);
  }

  global = updateGlobalSearchResults(
    global,
    messages,
    totalCount,
    type,
    nextRate,
  );

  setGlobal(global);
}

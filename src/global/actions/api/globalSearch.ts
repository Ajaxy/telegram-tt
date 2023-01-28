import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { callApi } from '../../../api/gramjs';
import type {
  ApiChat, ApiTopic, ApiGlobalMessageSearchType, ApiMessage, ApiUser,
} from '../../../api/types';

import {
  addChats,
  addMessages,
  addUsers,
  updateTopics,
  updateGlobalSearch,
  updateGlobalSearchFetchingStatus,
  updateGlobalSearchResults,
} from '../../reducers';
import { throttle } from '../../../util/schedulers';
import { selectChat, selectCurrentGlobalSearchQuery, selectTabState } from '../../selectors';
import { buildCollectionByKey } from '../../../util/iteratees';
import { GLOBAL_SEARCH_SLICE, GLOBAL_TOPIC_SEARCH_SLICE } from '../../../config';
import { timestampPlusDay } from '../../../util/dateFormat';
import type { ActionReturnType, GlobalState, TabArgs } from '../../types';
import { getCurrentTabId } from '../../../util/establishMultitabRole';

const searchThrottled = throttle((cb) => cb(), 500, false);

addActionHandler('setGlobalSearchQuery', (global, actions, payload): ActionReturnType => {
  const { query, tabId = getCurrentTabId() } = payload!;
  const { chatId } = selectTabState(global, tabId).globalSearch;

  if (query && !chatId) {
    void searchThrottled(async () => {
      const result = await callApi('searchChats', { query });

      global = getGlobal();
      const currentSearchQuery = selectCurrentGlobalSearchQuery(global, tabId);
      if (!result || !currentSearchQuery || (query !== currentSearchQuery)) {
        global = updateGlobalSearchFetchingStatus(global, { chats: false }, tabId);
        setGlobal(global);
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

      global = updateGlobalSearchFetchingStatus(global, { chats: false }, tabId);
      global = updateGlobalSearch(global, {
        localResults: {
          chatIds: localChats.map(({ id }) => id),
          userIds: localUsers.map(({ id }) => id),
        },
        globalResults: {
          ...selectTabState(global, tabId).globalSearch.globalResults,
          chatIds: globalChats.map(({ id }) => id),
          userIds: globalUsers.map(({ id }) => id),
        },
      }, tabId);

      setGlobal(global);
    });
  }
});

addActionHandler('setGlobalSearchDate', (global, actions, payload): ActionReturnType => {
  const { date, tabId = getCurrentTabId() } = payload!;
  const maxDate = date ? timestampPlusDay(date) : date;

  global = updateGlobalSearch(global, {
    date,
    query: '',
    resultsByType: {
      ...selectTabState(global, tabId).globalSearch.resultsByType,
      text: {
        totalCount: undefined,
        foundIds: [],
        nextOffsetId: 0,
      },
    },
  }, tabId);
  setGlobal(global);

  const { chatId } = selectTabState(global, tabId).globalSearch;
  const chat = chatId ? selectChat(global, chatId) : undefined;
  searchMessagesGlobal(global, '', 'text', undefined, chat, maxDate, date, tabId);
});

addActionHandler('searchMessagesGlobal', (global, actions, payload): ActionReturnType => {
  const { type, tabId = getCurrentTabId() } = payload;
  const {
    query, resultsByType, chatId, date,
  } = selectTabState(global, tabId).globalSearch;
  const maxDate = date ? timestampPlusDay(date) : date;
  const nextOffsetId = (resultsByType?.[type as ApiGlobalMessageSearchType])?.nextOffsetId;

  const chat = chatId ? selectChat(global, chatId) : undefined;

  searchMessagesGlobal(global, query, type, nextOffsetId, chat, maxDate, date, tabId);
});

async function searchMessagesGlobal<T extends GlobalState>(
  global: T,
  query = '', type: ApiGlobalMessageSearchType, offsetRate?: number, chat?: ApiChat, maxDate?: number, minDate?: number,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  let result: {
    messages: ApiMessage[];
    users: ApiUser[];
    chats: ApiChat[];
    topics?: ApiTopic[];
    totalTopicsCount?: number;
    totalCount: number;
    nextRate: number | undefined;
  } | undefined;

  if (chat) {
    const localResultRequest = callApi('searchMessagesLocal', {
      chat,
      query,
      type,
      limit: GLOBAL_SEARCH_SLICE,
      offsetId: offsetRate,
      minDate,
      maxDate,
    });
    const topicsRequest = chat.isForum ? callApi('fetchTopics', {
      chat,
      query,
      limit: GLOBAL_TOPIC_SEARCH_SLICE,
    }) : undefined;

    const [localResult, topics] = await Promise.all([localResultRequest, topicsRequest]);

    if (localResult) {
      const {
        messages, users, totalCount, nextOffsetId,
      } = localResult;

      const { topics: localTopics, count } = topics || {};

      result = {
        topics: localTopics,
        totalTopicsCount: count,
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

  global = getGlobal();
  const currentSearchQuery = selectCurrentGlobalSearchQuery(global, tabId);
  if (!result || (query !== '' && query !== currentSearchQuery)) {
    global = updateGlobalSearchFetchingStatus(global, { messages: false }, tabId);
    setGlobal(global);
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
    tabId,
  );

  if (result.topics) {
    global = updateTopics(global, chat!.id, result.totalTopicsCount!, result.topics);
  }

  const sortedTopics = result.topics?.map(({ id }) => id).sort((a, b) => b - a);
  global = updateGlobalSearch(global, {
    foundTopicIds: sortedTopics,
  }, tabId);

  setGlobal(global);
}

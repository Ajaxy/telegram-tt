import type {
  ApiChat, ApiGlobalMessageSearchType, ApiMessage, ApiTopic, ApiUser,
} from '../../../api/types';
import type { ActionReturnType, GlobalState, TabArgs } from '../../types';

import { GLOBAL_SEARCH_SLICE, GLOBAL_TOPIC_SEARCH_SLICE } from '../../../config';
import { timestampPlusDay } from '../../../util/dates/dateFormat';
import { isDeepLink, tryParseDeepLink } from '../../../util/deepLinkParser';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey } from '../../../util/iteratees';
import { throttle } from '../../../util/schedulers';
import { callApi } from '../../../api/gramjs';
import { isChatChannel, isChatGroup, toChannelId } from '../../helpers/chats';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  addChats,
  addMessages,
  addUsers,
  updateGlobalSearch,
  updateGlobalSearchFetchingStatus,
  updateGlobalSearchResults,
  updateTopics,
} from '../../reducers';
import {
  selectChat, selectChatByUsername, selectChatMessage, selectCurrentGlobalSearchQuery, selectTabState,
} from '../../selectors';

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
        accountResultIds, globalResultIds, users, chats,
      } = result;

      global = addChats(global, buildCollectionByKey(chats, 'id'));

      global = addUsers(global, buildCollectionByKey(users, 'id'));

      global = updateGlobalSearchFetchingStatus(global, { chats: false }, tabId);
      global = updateGlobalSearch(global, {
        localResults: {
          peerIds: accountResultIds,
        },
        globalResults: {
          ...selectTabState(global, tabId).globalSearch.globalResults,
          peerIds: globalResultIds,
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
    minDate: date,
    maxDate,
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

  actions.searchMessagesGlobal({ type: 'text', tabId });
});

addActionHandler('searchMessagesGlobal', (global, actions, payload): ActionReturnType => {
  const { type, tabId = getCurrentTabId() } = payload;
  const {
    query, resultsByType, chatId,
  } = selectTabState(global, tabId).globalSearch;
  const offsetId = (resultsByType?.[type])?.nextOffsetId;
  const offsetRate = (resultsByType?.[type])?.nextOffsetRate;
  const offsetPeerId = (resultsByType?.[type])?.nextOffsetPeerId;

  const chat = chatId ? selectChat(global, chatId) : undefined;
  const offsetPeer = offsetPeerId ? selectChat(global, offsetPeerId) : undefined;

  searchMessagesGlobal(global, {
    query,
    type,
    offsetRate,
    offsetId,
    offsetPeer,
    chat,
    tabId,
  });
});

addActionHandler('searchPopularBotApps', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};
  const popularBotApps = selectTabState(global, tabId).globalSearch.popularBotApps;
  const offset = popularBotApps?.nextOffset;
  if (popularBotApps?.peerIds && !offset) return; // Already fetched all

  global = updateGlobalSearchFetchingStatus(global, { botApps: true }, tabId);
  setGlobal(global);

  const result = await callApi('fetchPopularAppBots', { offset });

  global = getGlobal();
  if (!result) {
    global = updateGlobalSearchFetchingStatus(global, { botApps: false }, tabId);
    setGlobal(global);
    return;
  }

  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));
  const peerIds = result.users.map(({ id }) => id);
  global = updateGlobalSearch(global, {
    popularBotApps: {
      peerIds: [...(popularBotApps?.peerIds || []), ...peerIds],
      nextOffset: result.nextOffset,
    },
  }, tabId);
  global = updateGlobalSearchFetchingStatus(global, { botApps: false }, tabId);

  setGlobal(global);
});

async function searchMessagesGlobal<T extends GlobalState>(global: T, params: {
  query?: string;
  type: ApiGlobalMessageSearchType;
  offsetRate?: number;
  offsetId?: number;
  offsetPeer?: ApiChat;
  chat?: ApiChat;
  maxDate?: number;
  minDate?: number;
  tabId: TabArgs<T>[0];
}) {
  const {
    query = '', type, offsetRate, offsetId, offsetPeer, chat, maxDate, minDate, tabId = getCurrentTabId(),
  } = params;
  let result: {
    messages: ApiMessage[];
    users: ApiUser[];
    chats: ApiChat[];
    topics?: ApiTopic[];
    totalTopicsCount?: number;
    totalCount: number;
    nextOffsetRate?: number;
    nextOffsetId?: number;
    nextOffsetPeerId?: string;
  } | undefined;

  let messageLink: ApiMessage | undefined;

  if (chat) {
    const inChatResultRequest = callApi('searchMessagesInChat', {
      chat,
      query,
      type,
      limit: GLOBAL_SEARCH_SLICE,
      offsetId,
      minDate,
      maxDate,
    });
    const topicsRequest = chat.isForum ? callApi('fetchTopics', {
      chat,
      query,
      limit: GLOBAL_TOPIC_SEARCH_SLICE,
    }) : undefined;

    const [inChatResult, topics] = await Promise.all([inChatResultRequest, topicsRequest]);

    if (inChatResult) {
      const {
        messages, users, totalCount, nextOffsetId,
      } = inChatResult;

      const { topics: localTopics, count } = topics || {};

      result = {
        topics: localTopics,
        totalTopicsCount: count,
        messages,
        users,
        chats: [],
        totalCount,
        nextOffsetId,
      };
    }
  } else {
    result = await callApi('searchMessagesGlobal', {
      query,
      offsetRate,
      offsetId,
      offsetPeer,
      limit: GLOBAL_SEARCH_SLICE,
      type,
      maxDate,
      minDate,
    });
    if (isDeepLink(query)) {
      const link = tryParseDeepLink(query);
      if (link?.type === 'publicMessageLink') {
        messageLink = await getMessageByPublicLink(global, link);
      } else if (link?.type === 'privateMessageLink') {
        messageLink = await getMessageByPrivateLink(global, link);
      }
    }
  }

  global = getGlobal();
  const currentSearchQuery = selectCurrentGlobalSearchQuery(global, tabId);
  if (!result || (query !== '' && query !== currentSearchQuery)) {
    global = updateGlobalSearchFetchingStatus(global, { messages: false }, tabId);
    setGlobal(global);
    return;
  }

  if (messageLink) {
    result.totalCount = result.messages.unshift(messageLink);
  }

  const {
    messages, users, chats, totalCount, nextOffsetRate, nextOffsetId, nextOffsetPeerId,
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
    nextOffsetRate,
    nextOffsetId,
    nextOffsetPeerId,
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

async function getMessageByPublicLink(global: GlobalState, link: { username: string; messageId: number }) {
  const { username, messageId } = link;
  const localChat = selectChatByUsername(global, username);
  if (localChat) {
    return getChatGroupOrChannelMessage(global, localChat, messageId);
  }
  const { chat } = await callApi('getChatByUsername', username) ?? {};
  if (!chat) {
    return undefined;
  }
  return getChatGroupOrChannelMessage(global, chat, messageId);
}

function getMessageByPrivateLink(global: GlobalState, link: { channelId: string; messageId: number }) {
  const { channelId, messageId } = link;
  const internalChannelId = toChannelId(channelId);
  const chat = selectChat(global, internalChannelId);
  if (!chat) {
    return undefined;
  }
  return getChatGroupOrChannelMessage(global, chat, messageId);
}

async function getChatGroupOrChannelMessage(global: GlobalState, chat: ApiChat, messageId: number) {
  if (!isChatGroup(chat) && !isChatChannel(chat)) {
    return undefined;
  }
  const localMessage = selectChatMessage(global, chat.id, messageId);
  if (localMessage) {
    return localMessage;
  }
  const result = await callApi('fetchMessage', { chat, messageId });
  return result === 'MESSAGE_DELETED' ? undefined : result?.message;
}

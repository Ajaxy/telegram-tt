import {
  addCallback, addReducer, getGlobal, removeCallback,
} from '../lib/teact/teactn';

import { GlobalState } from './types';
import { MAIN_THREAD_ID } from '../api/types';

import { onIdle, throttle } from '../util/schedulers';
import {
  DEBUG,
  GLOBAL_STATE_CACHE_DISABLED,
  GLOBAL_STATE_CACHE_KEY,
  GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT,
  GRAMJS_SESSION_ID_KEY,
  MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN, GLOBAL_STATE_CACHE_USER_LIST_LIMIT,
} from '../config';
import { IS_MOBILE_SCREEN } from '../util/environment';
import { pick } from '../util/iteratees';
import { INITIAL_STATE } from './initial';
import { selectCurrentMessageList } from '../modules/selectors';

const UPDATE_THROTTLE = 1000;

const updateCacheThrottled = throttle(updateCache, UPDATE_THROTTLE, false);

let isAllowed = false;

export function initCache() {
  if (GLOBAL_STATE_CACHE_DISABLED) {
    return;
  }

  addReducer('saveSession', () => {
    isAllowed = true;
    addCallback(updateCacheThrottled);
  });

  addReducer('reset', () => {
    isAllowed = false;
    removeCallback(updateCacheThrottled);
    localStorage.removeItem(GLOBAL_STATE_CACHE_KEY);
  });
}

export function loadCache(initialState: GlobalState) {
  if (!GLOBAL_STATE_CACHE_DISABLED) {
    const hasActiveSession = localStorage.getItem(GRAMJS_SESSION_ID_KEY);
    if (hasActiveSession) {
      isAllowed = true;
      addCallback(updateCacheThrottled);
      return readCache(initialState);
    } else {
      isAllowed = false;
    }
  }

  return undefined;
}

function readCache(initialState: GlobalState) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.time('global-state-cache-read');
  }

  const json = localStorage.getItem(GLOBAL_STATE_CACHE_KEY);
  const cached = json ? JSON.parse(json) as GlobalState : undefined;

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.timeEnd('global-state-cache-read');
  }

  if (cached) {
    // Pre-fill defaults in nested objects which may be missing in older cache
    cached.settings.byKey = {
      ...initialState.settings.byKey,
      ...cached.settings.byKey,
    };
    cached.settings.themes = {
      ...initialState.settings.themes,
      ...cached.settings.themes,
    };
    cached.chatFolders = {
      ...initialState.chatFolders,
      ...cached.chatFolders,
    };
  }

  return {
    ...initialState,
    ...cached,
  };
}

function updateCache() {
  onIdle(() => {
    if (!isAllowed) {
      return;
    }

    const global = getGlobal();

    if (global.isLoggingOut) {
      return;
    }

    const reducedGlobal: GlobalState = {
      ...INITIAL_STATE,
      ...pick(global, [
        'authState',
        'authPhoneNumber',
        'authRememberMe',
        'authNearestCountry',
        'currentUserId',
        'contactList',
        'chatFolders',
        'topPeers',
        'recentEmojis',
        'push',
      ]),
      isChatInfoShown: reduceShowChatInfo(global),
      users: reduceUsers(global),
      chats: reduceChats(global),
      messages: reduceMessages(global),
      globalSearch: {
        recentlyFoundChatIds: global.globalSearch.recentlyFoundChatIds,
      },
      settings: reduceSettings(global),
    };

    const json = JSON.stringify(reducedGlobal);
    localStorage.setItem(GLOBAL_STATE_CACHE_KEY, json);
  });
}

function reduceShowChatInfo(global: GlobalState): boolean {
  return window.innerWidth > MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN
    ? global.isChatInfoShown
    : false;
}

function reduceUsers(global: GlobalState): GlobalState['users'] {
  const { users: { byId, selectedId } } = global;
  const idsToSave = [
    ...(global.chats.listIds.active || []).slice(0, GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT).filter((cid) => cid > 0),
    ...Object.keys(byId),
  ].slice(0, GLOBAL_STATE_CACHE_USER_LIST_LIMIT);

  return {
    byId: pick(byId, idsToSave as number[]),
    selectedId: window.innerWidth > MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN ? selectedId : undefined,
  };
}

function reduceChats(global: GlobalState): GlobalState['chats'] {
  const chatIdsToSave = [
    ...(global.chats.listIds.active || []).slice(0, GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT),
  ];
  const { chatId: currentChatId } = selectCurrentMessageList(global) || {};

  return {
    ...global.chats,
    byId: pick(global.chats.byId, currentChatId ? [...chatIdsToSave, currentChatId] : chatIdsToSave),
    listIds: {
      active: chatIdsToSave,
    },
    isFullyLoaded: {},
    orderedPinnedIds: {
      active: global.chats.orderedPinnedIds.active,
    },
  };
}

function reduceMessages(global: GlobalState): GlobalState['messages'] {
  const byChatId: GlobalState['messages']['byChatId'] = {};
  const { chatId: currentChatId } = selectCurrentMessageList(global) || {};

  const chatIdsToSave = [
    ...(global.chats.listIds.active || []).slice(0, GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT),
    ...(currentChatId ? [currentChatId] : []),
  ];
  chatIdsToSave.forEach((chatId) => {
    const current = global.messages.byChatId[chatId];
    if (!current) {
      return;
    }

    const mainThread = current.threadsById[MAIN_THREAD_ID];
    if (!mainThread || !mainThread.viewportIds) {
      return;
    }

    byChatId[chatId] = {
      byId: pick(current.byId, mainThread.viewportIds),
      threadsById: {
        [MAIN_THREAD_ID]: mainThread,
      },
    };
  });

  const currentMessageList = selectCurrentMessageList(global);

  return {
    byChatId,
    messageLists: !currentMessageList || IS_MOBILE_SCREEN ? undefined : [{
      ...currentMessageList,
      threadId: MAIN_THREAD_ID,
      type: 'thread',
    }],
  };
}

function reduceSettings(global: GlobalState): GlobalState['settings'] {
  const { byKey, themes } = global.settings;

  return {
    byKey,
    themes,
    privacy: {},
    notifyExceptions: {},
  };
}

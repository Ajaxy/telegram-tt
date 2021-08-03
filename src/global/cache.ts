import {
  addCallback, addReducer, getGlobal, removeCallback,
} from '../lib/teact/teactn';

import { GlobalState } from './types';
import { MAIN_THREAD_ID } from '../api/types';

import { onBeforeUnload, onIdle, throttle } from '../util/schedulers';
import {
  DEBUG,
  GLOBAL_STATE_CACHE_DISABLED,
  GLOBAL_STATE_CACHE_KEY,
  GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT,
  MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN,
  GLOBAL_STATE_CACHE_USER_LIST_LIMIT,
} from '../config';
import { IS_SINGLE_COLUMN_LAYOUT } from '../util/environment';
import { ANIMATION_END_EVENT, ANIMATION_START_EVENT } from '../hooks/useHeavyAnimationCheck';
import { pick } from '../util/iteratees';
import { selectCurrentMessageList } from '../modules/selectors';
import { hasStoredSession } from '../util/sessions';
import { INITIAL_STATE } from './initial';

const UPDATE_THROTTLE = 5000;

const updateCacheThrottled = throttle(() => onIdle(updateCache), UPDATE_THROTTLE, false);

let isCaching = false;
let isHeavyAnimating = false;
let unsubscribeFromBeforeUnload: NoneToVoidFunction | undefined;

setupHeavyAnimationListeners();

export function initCache() {
  if (GLOBAL_STATE_CACHE_DISABLED) {
    return;
  }

  addReducer('saveSession', () => {
    if (isCaching) {
      return;
    }

    setupCaching();
  });

  addReducer('reset', () => {
    localStorage.removeItem(GLOBAL_STATE_CACHE_KEY);

    if (!isCaching) {
      return;
    }

    clearCaching();
  });
}

export function loadCache(initialState: GlobalState) {
  if (GLOBAL_STATE_CACHE_DISABLED) {
    return undefined;
  }

  if (hasStoredSession(true)) {
    setupCaching();

    return readCache(initialState);
  } else {
    clearCaching();

    return undefined;
  }
}

function setupCaching() {
  isCaching = true;
  unsubscribeFromBeforeUnload = onBeforeUnload(updateCache, true);
  window.addEventListener('blur', updateCache);
  addCallback(updateCacheThrottled);
}

function clearCaching() {
  isCaching = false;
  removeCallback(updateCacheThrottled);
  window.removeEventListener('blur', updateCache);
  if (unsubscribeFromBeforeUnload) {
    unsubscribeFromBeforeUnload();
  }
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

    if (!cached.messages.messageLists) {
      cached.messages.messageLists = [];
    }
  }

  return {
    ...initialState,
    ...cached,
  };
}

function updateCache() {
  if (!isCaching || isHeavyAnimating) {
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
      'topPeers',
      'topInlineBots',
      'recentEmojis',
      'push',
      'shouldShowContextMenuHint',
    ]),
    isChatInfoShown: reduceShowChatInfo(global),
    users: reduceUsers(global),
    chats: reduceChats(global),
    messages: reduceMessages(global),
    globalSearch: {
      recentlyFoundChatIds: global.globalSearch.recentlyFoundChatIds,
    },
    settings: reduceSettings(global),
    chatFolders: reduceChatFolders(global),
  };

  const json = JSON.stringify(reducedGlobal);
  localStorage.setItem(GLOBAL_STATE_CACHE_KEY, json);
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
    messageLists: !currentMessageList || IS_SINGLE_COLUMN_LAYOUT ? [] : [{
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

function reduceChatFolders(global: GlobalState): GlobalState['chatFolders'] {
  return {
    ...global.chatFolders,
    activeChatFolder: 0,
  };
}

function setupHeavyAnimationListeners() {
  document.addEventListener(ANIMATION_START_EVENT, () => {
    isHeavyAnimating = true;
  });
  document.addEventListener(ANIMATION_END_EVENT, () => {
    isHeavyAnimating = false;
  });
}

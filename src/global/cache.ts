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
  DEFAULT_VOLUME,
  DEFAULT_PLAYBACK_RATE,
} from '../config';
import { IS_SINGLE_COLUMN_LAYOUT } from '../util/environment';
import { ANIMATION_END_EVENT, ANIMATION_START_EVENT } from '../hooks/useHeavyAnimationCheck';
import { pick } from '../util/iteratees';
import { selectCurrentMessageList } from '../modules/selectors';
import { hasStoredSession } from '../util/sessions';
import { INITIAL_STATE } from './initial';
import { parseLocationHash } from '../util/routing';
import { LOCATION_HASH } from '../hooks/useHistoryBack';
import { isUserId } from '../modules/helpers';

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

export function loadCache(initialState: GlobalState): GlobalState | undefined {
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

function readCache(initialState: GlobalState): GlobalState {
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
    migrateCache(cached, initialState);
  }

  const newState = {
    ...initialState,
    ...cached,
  };

  const parsedMessageList = !IS_SINGLE_COLUMN_LAYOUT ? parseLocationHash(LOCATION_HASH) : undefined;

  return {
    ...newState,
    messages: {
      ...newState.messages,
      messageLists: parsedMessageList ? [parsedMessageList] : [],
    },
  };
}

function migrateCache(cached: GlobalState, initialState: GlobalState) {
  if ('shouldAutoDownloadMediaFromContacts' in cached.settings.byKey) {
    const {
      shouldAutoDownloadMediaFromContacts,
      shouldAutoDownloadMediaInPrivateChats,
      shouldAutoDownloadMediaInGroups,
      shouldAutoDownloadMediaInChannels,
      shouldAutoPlayVideos,
      shouldAutoPlayGifs,
      ...rest
    } = cached.settings.byKey;

    cached.settings.byKey = {
      ...rest,
      canAutoLoadPhotoFromContacts: shouldAutoDownloadMediaFromContacts,
      canAutoLoadVideoFromContacts: shouldAutoDownloadMediaFromContacts,
      canAutoLoadPhotoInPrivateChats: shouldAutoDownloadMediaInPrivateChats,
      canAutoLoadVideoInPrivateChats: shouldAutoDownloadMediaInPrivateChats,
      canAutoLoadPhotoInGroups: shouldAutoDownloadMediaInGroups,
      canAutoLoadVideoInGroups: shouldAutoDownloadMediaInGroups,
      canAutoLoadPhotoInChannels: shouldAutoDownloadMediaInChannels,
      canAutoLoadVideoInChannels: shouldAutoDownloadMediaInChannels,
      canAutoPlayVideos: shouldAutoPlayVideos,
      canAutoPlayGifs: shouldAutoPlayGifs,
    };
  }

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

  if (!cached.stickers.greeting) {
    cached.stickers.greeting = initialState.stickers.greeting;
  }

  if (!cached.activeDownloads) {
    cached.activeDownloads = {
      byChatId: {},
    };
  }

  if (!cached.serviceNotifications) {
    cached.serviceNotifications = [];
  }

  if (cached.audioPlayer.volume === undefined) {
    cached.audioPlayer.volume = DEFAULT_VOLUME;
  }

  if (cached.audioPlayer.playbackRate === undefined) {
    cached.audioPlayer.playbackRate = DEFAULT_PLAYBACK_RATE;
  }

  if (!cached.groupCalls) {
    cached.groupCalls = initialState.groupCalls;
  }

  if (!cached.users.statusesById) {
    cached.users.statusesById = {};
  }
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
      'leftColumnWidth',
      'serviceNotifications',
    ]),
    audioPlayer: {
      volume: global.audioPlayer.volume,
      playbackRate: global.audioPlayer.playbackRate,
      isMuted: global.audioPlayer.isMuted,
    },
    isChatInfoShown: reduceShowChatInfo(global),
    users: reduceUsers(global),
    chats: reduceChats(global),
    messages: reduceMessages(global),
    globalSearch: {
      recentlyFoundChatIds: global.globalSearch.recentlyFoundChatIds,
    },
    settings: reduceSettings(global),
    chatFolders: reduceChatFolders(global),
    groupCalls: reduceGroupCalls(global),
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
  const { users: { byId, statusesById, selectedId } } = global;
  const chatIds = (global.chats.listIds.active || []).slice(0, GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT).filter(isUserId);
  const userIds = Object.keys(byId);
  const idsToSave = chatIds.concat(userIds).slice(0, GLOBAL_STATE_CACHE_USER_LIST_LIMIT);

  return {
    byId: pick(byId, idsToSave),
    statusesById: pick(statusesById, idsToSave),
    selectedId: window.innerWidth > MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN ? selectedId : undefined,
  };
}

function reduceChats(global: GlobalState): GlobalState['chats'] {
  const newListIds = (global.chats.listIds.active || []).slice(0, GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT);
  const { chatId: currentChatId } = selectCurrentMessageList(global) || {};
  const idsToSave = newListIds.concat(currentChatId ? [currentChatId] : []);

  return {
    ...global.chats,
    byId: pick(global.chats.byId, idsToSave),
    listIds: {
      active: newListIds,
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

  const chatIds = (global.chats.listIds.active || []).slice(0, GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT);
  const chatIdsToSave = chatIds.concat(currentChatId ? [currentChatId] : []);

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

  return {
    byChatId,
    messageLists: [],
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

function reduceGroupCalls(global: GlobalState): GlobalState['groupCalls'] {
  return {
    ...global.groupCalls,
    byId: {},
    activeGroupCallId: undefined,
    isGroupCallPanelHidden: undefined,
    isFallbackConfirmOpen: undefined,
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

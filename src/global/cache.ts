import { addCallback, removeCallback } from '../lib/teact/teactn';

import { addActionHandler, getGlobal } from './index';

import type { GlobalState } from './types';
import { MAIN_THREAD_ID } from '../api/types';

import { onBeforeUnload, onIdle, throttle } from '../util/schedulers';
import {
  DEBUG,
  GLOBAL_STATE_CACHE_DISABLED,
  GLOBAL_STATE_CACHE_KEY,
  GLOBAL_STATE_CACHE_USER_LIST_LIMIT,
  GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT,
  GLOBAL_STATE_CACHE_CHATS_WITH_MESSAGES_LIMIT,
  GLOBAL_STATE_CACHE_CUSTOM_EMOJI_LIMIT,
  ALL_FOLDER_ID,
  ARCHIVED_FOLDER_ID,
  MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN,
  DEFAULT_VOLUME,
  DEFAULT_PLAYBACK_RATE,
  DEFAULT_PATTERN_COLOR,
  DEFAULT_LIMITS,
} from '../config';
import { IS_SINGLE_COLUMN_LAYOUT } from '../util/environment';
import { isHeavyAnimating } from '../hooks/useHeavyAnimationCheck';
import { pick, unique } from '../util/iteratees';
import {
  selectCurrentChat,
  selectCurrentMessageList,
  selectVisibleUsers,
} from './selectors';
import { hasStoredSession } from '../util/sessions';
import { INITIAL_STATE } from './initialState';
import { parseLocationHash } from '../util/routing';
import { isUserId } from './helpers';
import { getOrderedIds } from '../util/folderManager';
import { clearGlobalForLockScreen } from './reducers';
import { encryptSession } from '../util/passcode';

const UPDATE_THROTTLE = 5000;

const updateCacheThrottled = throttle(() => onIdle(updateCache), UPDATE_THROTTLE, false);

let isCaching = false;
let unsubscribeFromBeforeUnload: NoneToVoidFunction | undefined;

export function initCache() {
  if (GLOBAL_STATE_CACHE_DISABLED) {
    return;
  }

  const resetCache = () => {
    localStorage.removeItem(GLOBAL_STATE_CACHE_KEY);

    if (!isCaching) {
      return;
    }

    clearCaching();
  };

  addActionHandler('saveSession', () => {
    if (isCaching) {
      return;
    }

    setupCaching();
  });

  addActionHandler('reset', resetCache);
}

export function loadCache(initialState: GlobalState): GlobalState | undefined {
  if (GLOBAL_STATE_CACHE_DISABLED) {
    return undefined;
  }

  const cache = readCache(initialState);

  if (cache.passcode.hasPasscode || hasStoredSession(true)) {
    setupCaching();

    return cache;
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

  const parsedMessageList = !IS_SINGLE_COLUMN_LAYOUT ? parseLocationHash() : undefined;

  return {
    ...newState,
    messages: {
      ...newState.messages,
      messageLists: parsedMessageList ? [parsedMessageList] : [],
    },
  };
}

export function migrateCache(cached: GlobalState, initialState: GlobalState) {
  // Migrate from legacy setting names
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

  // Pre-fill settings with defaults
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

  if (!cached.stickers.premium) {
    cached.stickers.premium = initialState.stickers.premium;
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

  if (cached.mediaViewer.volume === undefined) {
    cached.mediaViewer.volume = DEFAULT_VOLUME;
  }

  if (cached.mediaViewer.playbackRate === undefined) {
    cached.mediaViewer.playbackRate = DEFAULT_PLAYBACK_RATE;
  }

  if (!cached.groupCalls) {
    cached.groupCalls = initialState.groupCalls;
  }

  if (!cached.users.statusesById) {
    cached.users.statusesById = {};
  }

  if (!cached.messages.sponsoredByChatId) {
    cached.messages.sponsoredByChatId = {};
  }

  if (!cached.activeReactions) {
    cached.activeReactions = {};
  }

  if (!cached.pollModal) {
    cached.pollModal = {
      isOpen: false,
    };
  }

  if (!cached.attachMenu) {
    cached.attachMenu = {
      bots: {},
    };
  }

  if (!cached.trustedBotIds) {
    cached.trustedBotIds = [];
  }

  if (!cached.passcode) {
    cached.passcode = {};
  }

  if (cached.activeSessions?.byHash === undefined) {
    cached.activeSessions = {
      byHash: {},
      orderedHashes: [],
    };
  }

  if (!cached.activeWebSessions) {
    cached.activeWebSessions = {
      byHash: {},
      orderedHashes: [],
    };
  }

  if (!cached.transcriptions) {
    cached.transcriptions = {};
  }

  if (cached.appConfig && !cached.appConfig.limits) {
    cached.appConfig.limits = DEFAULT_LIMITS;
  }

  if (!cached.customEmojis) {
    cached.customEmojis = {
      added: {},
      byId: {},
      lastRendered: [],
    };
  }

  if (!cached.stickers.premiumSet) {
    cached.stickers.premiumSet = {
      stickers: [],
    };
  }

  // TODO This was re-designed but can be hardcoded in cache
  const { light: lightTheme } = cached.settings.themes;
  if (lightTheme?.patternColor === 'rgba(90, 110, 70, 0.6)' || !lightTheme?.patternColor) {
    cached.settings.themes.light = {
      ...lightTheme,
      patternColor: DEFAULT_PATTERN_COLOR,
    };
  }
}

function updateCache() {
  const global = getGlobal();
  if (!isCaching || global.isLoggingOut || isHeavyAnimating()) {
    return;
  }

  forceUpdateCache();
}

export function forceUpdateCache(noEncrypt = false) {
  const global = getGlobal();
  const { hasPasscode, isScreenLocked } = global.passcode;
  const serializedGlobal = serializeGlobal(global);

  if (hasPasscode) {
    if (!isScreenLocked && !noEncrypt) {
      void encryptSession(undefined, serializedGlobal);
    }

    const serializedGlobalClean = JSON.stringify(clearGlobalForLockScreen(global));
    localStorage.setItem(GLOBAL_STATE_CACHE_KEY, serializedGlobalClean);

    return;
  }

  localStorage.setItem(GLOBAL_STATE_CACHE_KEY, serializedGlobal);
}

export function serializeGlobal(global: GlobalState) {
  const reducedGlobal: GlobalState = {
    ...INITIAL_STATE,
    ...pick(global, [
      'appConfig',
      'authState',
      'authPhoneNumber',
      'authRememberMe',
      'authNearestCountry',
      'currentUserId',
      'contactList',
      'topPeers',
      'topInlineBots',
      'recentEmojis',
      'recentCustomEmojis',
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
    customEmojis: reduceCustomEmojis(global),
    mediaViewer: {
      volume: global.mediaViewer.volume,
      playbackRate: global.mediaViewer.playbackRate,
      isMuted: global.mediaViewer.isMuted,
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
    availableReactions: reduceAvailableReactions(global),
    isCallPanelVisible: undefined,
    trustedBotIds: global.trustedBotIds,
    passcode: pick(global.passcode, [
      'isScreenLocked',
      'hasPasscode',
      'invalidAttemptsCount',
    ]),
  };

  return JSON.stringify(reducedGlobal);
}

function reduceCustomEmojis(global: GlobalState): GlobalState['customEmojis'] {
  const { lastRendered, byId } = global.customEmojis;
  const idsToSave = lastRendered.slice(0, GLOBAL_STATE_CACHE_CUSTOM_EMOJI_LIMIT);
  const byIdToSave = pick(byId, idsToSave);

  return {
    byId: byIdToSave,
    lastRendered: idsToSave,
    added: {},
  };
}

function reduceShowChatInfo(global: GlobalState): boolean {
  return window.innerWidth > MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN
    ? global.isChatInfoShown
    : false;
}

function reduceUsers(global: GlobalState): GlobalState['users'] {
  const { users: { byId, statusesById }, currentUserId } = global;
  const { chatId: currentChatId } = selectCurrentMessageList(global) || {};
  const visibleUserIds = selectVisibleUsers(global)?.map(({ id }) => id);

  const idsToSave = unique([
    ...currentUserId ? [currentUserId] : [],
    ...currentChatId && isUserId(currentChatId) ? [currentChatId] : [],
    ...visibleUserIds || [],
    ...global.topPeers.userIds || [],
    ...getOrderedIds(ALL_FOLDER_ID)?.filter(isUserId) || [],
    ...getOrderedIds(ARCHIVED_FOLDER_ID)?.filter(isUserId) || [],
    ...global.contactList?.userIds || [],
    ...global.globalSearch.recentlyFoundChatIds?.filter(isUserId) || [],
    ...Object.keys(byId),
  ]).slice(0, GLOBAL_STATE_CACHE_USER_LIST_LIMIT);

  return {
    byId: pick(byId, idsToSave),
    statusesById: pick(statusesById, idsToSave),
  };
}

function reduceChats(global: GlobalState): GlobalState['chats'] {
  const { chats: { byId }, currentUserId } = global;
  const currentChat = selectCurrentChat(global);
  const idsToSave = unique([
    ...currentUserId ? [currentUserId] : [],
    ...currentChat ? [currentChat.id] : [],
    ...getOrderedIds(ALL_FOLDER_ID) || [],
    ...getOrderedIds(ARCHIVED_FOLDER_ID) || [],
    ...global.globalSearch.recentlyFoundChatIds || [],
    ...Object.keys(byId),
  ]).slice(0, GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT);

  return {
    ...global.chats,
    isFullyLoaded: {},
    byId: pick(global.chats.byId, idsToSave),
  };
}

function reduceMessages(global: GlobalState): GlobalState['messages'] {
  const { currentUserId } = global;
  const byChatId: GlobalState['messages']['byChatId'] = {};
  const { chatId: currentChatId, threadId, type } = selectCurrentMessageList(global) || {};
  const chatIdsToSave = [
    ...currentChatId ? [currentChatId] : [],
    ...currentUserId ? [currentUserId] : [],
    ...getOrderedIds(ALL_FOLDER_ID)?.slice(0, GLOBAL_STATE_CACHE_CHATS_WITH_MESSAGES_LIMIT) || [],
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

  return {
    byChatId,
    messageLists: currentChatId && threadId && type ? [{ chatId: currentChatId, threadId, type }] : [],
    sponsoredByChatId: {},
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
  };
}

function reduceAvailableReactions(global: GlobalState): GlobalState['availableReactions'] {
  return global.availableReactions
    ?.map((r) => pick(r, ['reaction', 'staticIcon', 'title', 'isInactive']));
}

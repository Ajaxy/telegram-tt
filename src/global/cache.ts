/* eslint-disable eslint-multitab-tt/no-immediate-global */
import { addCallback, removeCallback } from '../lib/teact/teactn';

import { addActionHandler, getGlobal } from './index';

import type { ActionReturnType, GlobalState, MessageList } from './types';
import type {
  ApiChat, ApiChatFullInfo, ApiUser, ApiUserFullInfo,
} from '../api/types';
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
  DEFAULT_PATTERN_COLOR,
  DEFAULT_LIMITS,
  ANIMATION_LEVEL_MIN,
  ANIMATION_LEVEL_MED,
} from '../config';
import { isHeavyAnimating } from '../hooks/useHeavyAnimationCheck';
import {
  compact, pick, pickTruthy, unique,
} from '../util/iteratees';
import {
  selectChat,
  selectCurrentMessageList, selectThreadOriginChat,
  selectVisibleUsers,
} from './selectors';
import { hasStoredSession } from '../util/sessions';
import { INITIAL_GLOBAL_STATE, INITIAL_PERFORMANCE_STATE_MID, INITIAL_PERFORMANCE_STATE_MIN } from './initialState';
import { isUserId } from './helpers';
import { getOrderedIds } from '../util/folderManager';
import { clearGlobalForLockScreen } from './reducers';
import { encryptSession } from '../util/passcode';
import { getIsMobile } from '../hooks/useAppLayout';

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

  addActionHandler('saveSession', (): ActionReturnType => {
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

export function setupCaching() {
  isCaching = true;
  unsubscribeFromBeforeUnload = onBeforeUnload(updateCache, true);
  window.addEventListener('blur', updateCache);
  addCallback(updateCacheThrottled);
}

export function clearCaching() {
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

  return newState;
}

export function migrateCache(cached: GlobalState, initialState: GlobalState) {
  try {
    unsafeMigrateCache(cached, initialState);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
}

function unsafeMigrateCache(cached: GlobalState, initialState: GlobalState) {
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

  if (!cached.settings.performance) {
    if (cached.settings.byKey.animationLevel === ANIMATION_LEVEL_MIN) {
      cached.settings.performance = INITIAL_PERFORMANCE_STATE_MIN;
    } else if (cached.settings.byKey.animationLevel === ANIMATION_LEVEL_MED) {
      cached.settings.performance = INITIAL_PERFORMANCE_STATE_MID;
    } else {
      cached.settings.performance = initialState.settings.performance;
    }
  }

  if ('canAutoPlayVideos' in cached.settings.byKey) {
    cached.settings.performance.autoplayVideos = cached.settings.byKey.canAutoPlayVideos;
    delete cached.settings.byKey.canAutoPlayVideos;
  }

  if ('canAutoPlayGifs' in cached.settings.byKey) {
    cached.settings.performance.autoplayGifs = cached.settings.byKey.canAutoPlayGifs;
    delete cached.settings.byKey.canAutoPlayGifs;
  }

  cached.settings.performance = {
    ...initialState.settings.performance,
    ...cached.settings.performance,
  };

  if (!cached.stickers.premium) {
    cached.stickers.premium = initialState.stickers.premium;
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
      forEmoji: {},
      statusRecent: {},
    };
  }

  if (!cached.customEmojis.statusRecent) {
    cached.customEmojis.statusRecent = {};
  }

  if (!cached.recentCustomEmojis) {
    cached.recentCustomEmojis = [];
  }

  if (!cached.stickers.premiumSet) {
    cached.stickers.premiumSet = {
      stickers: [],
    };
  }

  if (!cached.customEmojis.forEmoji) {
    cached.customEmojis.forEmoji = {};
  }

  if (!cached.users.fullInfoById) {
    const result = Object.entries(cached.users.byId).reduce((acc, [id, user]) => {
      if ('fullInfo' in user) {
        if (user.fullInfo !== undefined) {
          acc.fullInfo[id] = user.fullInfo as ApiUserFullInfo;
        }
        delete user.fullInfo;
      }
      acc.users[id] = user;

      return acc;
    }, {
      users: {} as Record<string, ApiUser>,
      fullInfo: {} as Record<string, ApiUserFullInfo>,
    });

    cached.users.fullInfoById = result.fullInfo;
    cached.users.byId = result.users;
  }

  if (!cached.chats.fullInfoById) {
    const result = Object.entries(cached.chats.byId).reduce((acc, [id, chat]) => {
      if ('fullInfo' in chat) {
        if (chat.fullInfo !== undefined) {
          acc.fullInfo[id] = chat.fullInfo as ApiChatFullInfo;
        }
        delete chat.fullInfo;
      }
      acc.chats[id] = chat;

      return acc;
    }, {
      chats: {} as Record<string, ApiChat>,
      fullInfo: {} as Record<string, ApiChatFullInfo>,
    });

    cached.chats.fullInfoById = result.fullInfo;
    cached.chats.byId = result.chats;
  }

  // TODO Remove in Jan 2023 (this was re-designed but can be hardcoded in cache)
  const { light: lightTheme } = cached.settings.themes;
  if (lightTheme?.patternColor === 'rgba(90, 110, 70, 0.6)' || !lightTheme?.patternColor) {
    cached.settings.themes.light = {
      ...lightTheme,
      patternColor: DEFAULT_PATTERN_COLOR,
    };
  }

  cached.serviceNotifications.forEach((notification) => {
    const { isHidden } = notification as any;
    if (isHidden) {
      notification.isDeleted = isHidden;
    }
  });

  // TODO Remove in Mar 2023 (this was re-designed but can be hardcoded in cache)
  if (cached.users.byId && Object.values(cached.users.byId).some((u) => 'username' in u)) {
    cached.users.byId = Object.entries(cached.users.byId).reduce((acc, [id, user]) => {
      if ('username' in user) {
        delete user.username;
      }
      acc[id] = user;

      return acc;
    }, {} as Record<string, ApiUser>);
  }

  // TODO Remove in Mar 2023 (this was re-designed but can be hardcoded in cache)
  if (cached.chats.byId && Object.values(cached.chats.byId).some((c) => 'username' in c)) {
    cached.chats.byId = Object.entries(cached.chats.byId).reduce((acc, [id, user]) => {
      if ('username' in user) {
        delete user.username;
      }
      acc[id] = user;

      return acc;
    }, {} as Record<string, ApiChat>);
  }

  // TODO Remove in Apr 2023 (this was re-designed but can be hardcoded in cache)
  if (cached.messages.byChatId) {
    const wasUpdated = Object.values(cached.messages.byChatId)
      .some((messages) => Object.values(messages.byId).some(({ reactions }) => {
        return reactions?.results[0]?.reaction && typeof reactions.results[0].reaction !== 'string';
      }));
    if (!wasUpdated) {
      for (const messages of Object.values(cached.messages.byChatId)) {
        for (const message of Object.values(messages.byId)) {
          delete message.reactions;
        }
      }
    }
  }
  if (typeof cached.config?.defaultReaction === 'string') {
    cached.config.defaultReaction = { emoticon: cached.config.defaultReaction };
  }
  if (typeof cached.availableReactions?.[0].reaction === 'string') {
    cached.availableReactions = cached.availableReactions
      .map((r) => ({ ...r, reaction: { emoticon: r.reaction as unknown as string } }));
  }

  if (!cached.archiveSettings) {
    cached.archiveSettings = initialState.archiveSettings;
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

    const serializedGlobalClean = JSON.stringify(clearGlobalForLockScreen(global, false));
    localStorage.setItem(GLOBAL_STATE_CACHE_KEY, serializedGlobalClean);

    return;
  }

  localStorage.setItem(GLOBAL_STATE_CACHE_KEY, serializedGlobal);
}

export function serializeGlobal<T extends GlobalState>(global: T) {
  const reducedGlobal: GlobalState = {
    ...INITIAL_GLOBAL_STATE,
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
      'topReactions',
      'recentReactions',
      'push',
      'serviceNotifications',
      'attachmentSettings',
      'leftColumnWidth',
      'archiveSettings',
      'mediaViewer',
      'audioPlayer',
      'shouldShowContextMenuHint',
      'trustedBotIds',
      'recentlyFoundChatIds',
    ]),
    lastIsChatInfoShown: !getIsMobile() ? global.lastIsChatInfoShown : undefined,
    customEmojis: reduceCustomEmojis(global),
    users: reduceUsers(global),
    chats: reduceChats(global),
    messages: reduceMessages(global),
    settings: reduceSettings(global),
    chatFolders: reduceChatFolders(global),
    groupCalls: reduceGroupCalls(global),
    availableReactions: reduceAvailableReactions(global),
    passcode: pick(global.passcode, [
      'isScreenLocked',
      'hasPasscode',
      'invalidAttemptsCount',
      'timeoutUntil',
    ]),
  };

  return JSON.stringify(reducedGlobal);
}

function reduceCustomEmojis<T extends GlobalState>(global: T): GlobalState['customEmojis'] {
  const { lastRendered, byId } = global.customEmojis;
  const idsToSave = lastRendered.slice(0, GLOBAL_STATE_CACHE_CUSTOM_EMOJI_LIMIT);
  const byIdToSave = pick(byId, idsToSave);

  return {
    byId: byIdToSave,
    lastRendered: idsToSave,
    forEmoji: {},
    added: {},
    statusRecent: {},
  };
}

function reduceUsers<T extends GlobalState>(global: T): GlobalState['users'] {
  const { users: { byId, statusesById, fullInfoById }, currentUserId } = global;
  const currentChatIds = compact(
    Object.values(global.byTabId)
      .map(({ id: tabId }) => selectCurrentMessageList(global, tabId)),
  ).map(({ chatId }) => chatId).filter((chatId) => isUserId(chatId));

  const visibleUserIds = unique(compact(Object.values(global.byTabId)
    .flatMap(({ id: tabId }) => selectVisibleUsers(global, tabId)?.map((u) => u.id) || [])));

  const idsToSave = unique([
    ...currentUserId ? [currentUserId] : [],
    ...currentChatIds,
    ...visibleUserIds || [],
    ...global.topPeers.userIds || [],
    ...getOrderedIds(ALL_FOLDER_ID)?.filter(isUserId) || [],
    ...getOrderedIds(ARCHIVED_FOLDER_ID)?.filter(isUserId) || [],
    ...global.contactList?.userIds || [],
    ...global.recentlyFoundChatIds?.filter(isUserId) || [],
    ...Object.keys(byId),
  ]).slice(0, GLOBAL_STATE_CACHE_USER_LIST_LIMIT);

  return {
    byId: pick(byId, idsToSave),
    statusesById: pick(statusesById, idsToSave),
    fullInfoById: pick(fullInfoById, idsToSave),
  };
}

function reduceChats<T extends GlobalState>(global: T): GlobalState['chats'] {
  const { chats: { byId }, currentUserId } = global;
  const currentChatIds = compact(
    Object.values(global.byTabId)
      .flatMap(({ id: tabId }): MessageList[] | undefined => {
        const messageList = selectCurrentMessageList(global, tabId);
        if (!messageList) return undefined;

        const { chatId, threadId } = messageList;
        const origin = selectThreadOriginChat(global, chatId, threadId);
        return origin ? [{
          chatId: origin.id,
          threadId: MAIN_THREAD_ID,
          type: 'thread',
        }, messageList] : [messageList];
      }),
  ).map(({ chatId }) => chatId);

  const idsToSave = unique([
    ...currentUserId ? [currentUserId] : [],
    ...currentChatIds,
    ...getOrderedIds(ALL_FOLDER_ID) || [],
    ...getOrderedIds(ARCHIVED_FOLDER_ID) || [],
    ...global.recentlyFoundChatIds || [],
    ...Object.keys(byId),
  ]).slice(0, GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT);

  return {
    ...global.chats,
    isFullyLoaded: {},
    byId: pick(global.chats.byId, idsToSave),
    fullInfoById: pick(global.chats.fullInfoById, idsToSave),
  };
}

function reduceMessages<T extends GlobalState>(global: T): GlobalState['messages'] {
  const { currentUserId } = global;
  const byChatId: GlobalState['messages']['byChatId'] = {};
  const currentChatIds = compact(
    Object.values(global.byTabId)
      .map(({ id: tabId }) => selectCurrentMessageList(global, tabId)),
  ).map(({ chatId }) => chatId);
  const forumPanelChatIds = compact(
    Object.values(global.byTabId)
      .map(({ forumPanelChatId }) => forumPanelChatId),
  );
  const chatIdsToSave = unique([
    ...currentChatIds,
    ...currentUserId ? [currentUserId] : [],
    ...forumPanelChatIds,
    ...getOrderedIds(ALL_FOLDER_ID)?.slice(0, GLOBAL_STATE_CACHE_CHATS_WITH_MESSAGES_LIMIT) || [],
  ]);

  chatIdsToSave.forEach((chatId) => {
    const current = global.messages.byChatId[chatId];
    if (!current) {
      return;
    }

    const chat = selectChat(global, chatId);

    const threadIds = compact(Object.values(global.byTabId).map(({ id: tabId }) => {
      const { chatId: tabChatId, threadId } = selectCurrentMessageList(global, tabId) || {};
      if (!tabChatId || tabChatId !== chatId || !threadId || threadId === MAIN_THREAD_ID) {
        return undefined;
      }

      return threadId;
    }));

    const threadIdsToSave = threadIds.length ? [MAIN_THREAD_ID, ...threadIds] : [MAIN_THREAD_ID];
    const threadsToSave = pickTruthy(current.threadsById, threadIdsToSave);
    if (!Object.keys(threadsToSave).length) {
      return;
    }

    const viewportIdsToSave = unique(Object.values(threadsToSave).flatMap((thread) => thread.lastViewportIds || []));
    const lastMessageIdsToSave = chat?.topics
      ? Object.values(chat.topics).map(({ lastMessageId }) => lastMessageId) : [];
    const byId = pick(current.byId, viewportIdsToSave.concat(lastMessageIdsToSave));
    const threadsById = Object.keys(threadsToSave).reduce((acc, key) => {
      const t = threadsToSave[Number(key)];
      acc[Number(key)] = {
        ...t,
        listedIds: t.lastViewportIds,
        pinnedIds: undefined,
      };
      return acc;
    }, {} as GlobalState['messages']['byChatId'][string]['threadsById']);

    byChatId[chatId] = {
      byId,
      threadsById,
    };
  });

  return {
    byChatId,
    sponsoredByChatId: {},
  };
}

function reduceSettings<T extends GlobalState>(global: T): GlobalState['settings'] {
  const { byKey, themes, performance } = global.settings;

  return {
    byKey,
    themes,
    performance,
    privacy: {},
    notifyExceptions: {},
  };
}

function reduceChatFolders<T extends GlobalState>(global: T): GlobalState['chatFolders'] {
  return {
    ...global.chatFolders,
  };
}

function reduceGroupCalls<T extends GlobalState>(global: T): GlobalState['groupCalls'] {
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

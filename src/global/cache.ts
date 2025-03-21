/* eslint-disable eslint-multitab-tt/no-immediate-global */
import { getIsHeavyAnimating, onFullyIdle } from '../lib/teact/teact';
import { addCallback, removeCallback } from '../lib/teact/teactn';

import type {
  ApiAvailableReaction,
  ApiMessage,
} from '../api/types';
import type { MessageList, ThreadId } from '../types';
import type { ActionReturnType, GlobalState } from './types';
import { MAIN_THREAD_ID } from '../api/types';

import {
  ALL_FOLDER_ID,
  ANIMATION_LEVEL_MED,
  ANIMATION_LEVEL_MIN,
  ARCHIVED_FOLDER_ID,
  DEBUG,
  DEFAULT_LIMITS,
  GLOBAL_STATE_CACHE_ARCHIVED_CHAT_LIST_LIMIT,
  GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT,
  GLOBAL_STATE_CACHE_CUSTOM_EMOJI_LIMIT,
  GLOBAL_STATE_CACHE_DISABLED,
  GLOBAL_STATE_CACHE_KEY,
  GLOBAL_STATE_CACHE_USER_LIST_LIMIT,
  IS_SCREEN_LOCKED_CACHE_KEY,
  SAVED_FOLDER_ID,
} from '../config';
import { MAIN_IDB_STORE } from '../util/browser/idb';
import { getOrderedIds } from '../util/folderManager';
import {
  compact, pick, pickTruthy, unique,
} from '../util/iteratees';
import { encryptSession } from '../util/passcode';
import { onBeforeUnload, throttle } from '../util/schedulers';
import { hasStoredSession } from '../util/sessions';
import { isUserId } from './helpers';
import { addActionHandler, getGlobal } from './index';
import { INITIAL_GLOBAL_STATE, INITIAL_PERFORMANCE_STATE_MID, INITIAL_PERFORMANCE_STATE_MIN } from './initialState';
import { clearGlobalForLockScreen } from './reducers';
import {
  selectChatLastMessageId,
  selectChatMessages,
  selectCurrentMessageList,
  selectTopics,
  selectViewportIds,
  selectVisibleUsers,
} from './selectors';

import { getIsMobile } from '../hooks/useAppLayout';

const UPDATE_THROTTLE = 5000;

const updateCacheThrottled = throttle(() => onFullyIdle(() => updateCache()), UPDATE_THROTTLE, false);
const updateCacheForced = () => updateCache(true);

let isCaching = false;
let isRemovingCache = false;
let unsubscribeFromBeforeUnload: NoneToVoidFunction | undefined;

export function cacheGlobal(global: GlobalState) {
  return MAIN_IDB_STORE.set(GLOBAL_STATE_CACHE_KEY, global);
}

export function loadCachedGlobal() {
  return MAIN_IDB_STORE.get<GlobalState>(GLOBAL_STATE_CACHE_KEY);
}

export function removeGlobalFromCache() {
  return MAIN_IDB_STORE.del(GLOBAL_STATE_CACHE_KEY);
}

function cacheIsScreenLocked(global: GlobalState) {
  if (global?.passcode?.isScreenLocked) localStorage.setItem(IS_SCREEN_LOCKED_CACHE_KEY, 'true');
}

export function initCache() {
  if (GLOBAL_STATE_CACHE_DISABLED) {
    return;
  }

  const resetCache = () => {
    isRemovingCache = true;
    removeGlobalFromCache().finally(() => {
      localStorage.removeItem(IS_SCREEN_LOCKED_CACHE_KEY);
      isRemovingCache = false;
      if (!isCaching) {
        return;
      }

      clearCaching();
    });
  };

  addActionHandler('saveSession', (): ActionReturnType => {
    if (isCaching) {
      return;
    }

    setupCaching();
    updateCacheForced();
  });

  addActionHandler('reset', resetCache);
}

export async function loadCache(initialState: GlobalState): Promise<GlobalState | undefined> {
  if (GLOBAL_STATE_CACHE_DISABLED) {
    return undefined;
  }

  const cache = await readCache(initialState);

  if (cache.passcode.hasPasscode || hasStoredSession()) {
    setupCaching();

    return cache;
  } else {
    clearCaching();

    return undefined;
  }
}

export function setupCaching() {
  isCaching = true;
  unsubscribeFromBeforeUnload = onBeforeUnload(updateCacheForced, true);
  window.addEventListener('blur', updateCacheForced);
  addCallback(updateCacheThrottled);
}

export function clearCaching() {
  isCaching = false;
  removeCallback(updateCacheThrottled);
  window.removeEventListener('blur', updateCacheForced);
  if (unsubscribeFromBeforeUnload) {
    unsubscribeFromBeforeUnload();
  }
}

async function readCache(initialState: GlobalState): Promise<GlobalState> {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.time('global-state-cache-read');
  }

  const json = localStorage.getItem(GLOBAL_STATE_CACHE_KEY);
  const cachedFromLocalStorage = json ? JSON.parse(json) as GlobalState : undefined;
  if (cachedFromLocalStorage) localStorage.removeItem(GLOBAL_STATE_CACHE_KEY);

  const cached = cachedFromLocalStorage || await loadCachedGlobal();

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
  const untypedCached = cached as any;
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

  cached.settings.performance = {
    ...initialState.settings.performance,
    ...cached.settings.performance,
  };

  if (cached.appConfig && !cached.appConfig.limits) {
    cached.appConfig.limits = DEFAULT_LIMITS;
  }

  if (!cached.chats.similarChannelsById) {
    cached.chats.similarChannelsById = initialState.chats.similarChannelsById;
  }

  if (!cached.chats.similarBotsById) {
    cached.chats.similarBotsById = initialState.chats.similarBotsById;
  }

  if (!cached.chats.lastMessageIds) {
    cached.chats.lastMessageIds = initialState.chats.lastMessageIds;
  }

  // Clear old color storage to optimize cache size
  if (untypedCached?.appConfig?.peerColors) {
    untypedCached.appConfig.peerColors = undefined;
    untypedCached.appConfig.darkPeerColors = undefined;
  }

  if (!cached.fileUploads.byMessageKey) {
    cached.fileUploads.byMessageKey = {};
  }

  if (!cached.reactions) {
    cached.reactions = initialState.reactions;
  }

  if (!cached.quickReplies) {
    cached.quickReplies = initialState.quickReplies;
  }

  if (!cached.users.previewMediaByBotId) {
    cached.users.previewMediaByBotId = initialState.users.previewMediaByBotId;
  }
  if (!cached.chats.loadingParameters) {
    cached.chats.loadingParameters = initialState.chats.loadingParameters;
  }
  if (!cached.topBotApps) {
    cached.topBotApps = initialState.topBotApps;
  }

  if (!cached.reactions.defaultTags?.[0]?.type) {
    cached.reactions = initialState.reactions;
  }

  if (!cached.users.commonChatsById) {
    cached.users.commonChatsById = initialState.users.commonChatsById;
  }
  if (!cached.users.botAppPermissionsById) {
    cached.users.botAppPermissionsById = initialState.users.botAppPermissionsById;
  }
  if (!cached.chats.topicsInfoById) {
    cached.chats.topicsInfoById = initialState.chats.topicsInfoById;
  }

  if (!cached.messages.pollById) {
    cached.messages.pollById = initialState.messages.pollById;
  }
  if (!cached.settings.botVerificationShownPeerIds) {
    cached.settings.botVerificationShownPeerIds = initialState.settings.botVerificationShownPeerIds;
  }

  if (!cached.peers) {
    cached.peers = initialState.peers;
  }

  if (!cached.cacheVersion) {
    cached.cacheVersion = initialState.cacheVersion;
    // Reset because of the new action message structure
    cached.messages = initialState.messages;
    cached.chats.listIds = initialState.chats.listIds;
  }

  if (!cached.messages.playbackByChatId) {
    cached.messages.playbackByChatId = initialState.messages.playbackByChatId;
  }

  if (cached.cacheVersion < 2) {
    if (cached.settings.themes.dark) {
      cached.settings.themes.dark.patternColor = initialState.settings.themes.dark!.patternColor;
    }

    if (cached.settings.themes.light) {
      cached.settings.themes.light.patternColor = initialState.settings.themes.light!.patternColor;
    }

    cached.cacheVersion = 2;
  }

  if (!cached.chats.notifyExceptionById) {
    cached.chats.notifyExceptionById = initialState.chats.notifyExceptionById;
  }
}

function updateCache(force?: boolean) {
  const global = getGlobal();
  if (isRemovingCache || !isCaching || global.isLoggingOut || (!force && getIsHeavyAnimating())) {
    return;
  }

  forceUpdateCache();
}

export function forceUpdateCache(noEncrypt = false) {
  const global = getGlobal();
  const { hasPasscode, isScreenLocked } = global.passcode;

  if (hasPasscode) {
    if (!isScreenLocked && !noEncrypt) {
      const serializedGlobal = serializeGlobal(global);
      void encryptSession(undefined, serializedGlobal);
    }

    cacheIsScreenLocked(global);
    cacheGlobal(clearGlobalForLockScreen(global, false));
    return;
  }

  cacheIsScreenLocked(global);
  cacheGlobal(reduceGlobal(global));
}

function reduceGlobal<T extends GlobalState>(global: T) {
  const reducedGlobal: GlobalState = {
    ...INITIAL_GLOBAL_STATE,
    ...pick(global, [
      'appConfig',
      'config',
      'authState',
      'authPhoneNumber',
      'authRememberMe',
      'authNearestCountry',
      'attachMenu',
      'currentUserId',
      'contactList',
      'topPeers',
      'topInlineBots',
      'topBotApps',
      'recentEmojis',
      'recentCustomEmojis',
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
      'peerColors',
      'savedReactionTags',
      'timezones',
      'availableEffectById',
    ]),
    lastIsChatInfoShown: !getIsMobile() ? global.lastIsChatInfoShown : undefined,
    customEmojis: reduceCustomEmojis(global),
    users: reduceUsers(global),
    chats: reduceChats(global),
    messages: reduceMessages(global),
    settings: reduceSettings(global),
    chatFolders: reduceChatFolders(global),
    groupCalls: reduceGroupCalls(global),
    reactions: {
      ...pick(global.reactions, [
        'defaultTags',
        'recentReactions',
        'topReactions',
        'effectReactions',
        'hash',
      ]),
      availableReactions: reduceAvailableReactions(global.reactions.availableReactions),
    },
    passcode: pick(global.passcode, [
      'isScreenLocked',
      'hasPasscode',
      'invalidAttemptsCount',
      'timeoutUntil',
    ]),
  };

  return reducedGlobal;
}

export function serializeGlobal<T extends GlobalState>(global: T) {
  return JSON.stringify(reduceGlobal(global));
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
  const {
    users: {
      byId, statusesById, fullInfoById, botAppPermissionsById,
    }, currentUserId,
  } = global;
  const currentChatIds = compact(
    Object.values(global.byTabId)
      .map(({ id: tabId }) => selectCurrentMessageList(global, tabId)),
  ).map(({ chatId }) => chatId).filter((chatId) => isUserId(chatId));

  const visibleUserIds = unique(compact(Object.values(global.byTabId)
    .flatMap(({ id: tabId }) => selectVisibleUsers(global, tabId)?.map((u) => u.id) || [])));

  const chatStoriesUserIds = currentChatIds
    .flatMap((chatId) => Object.values(selectChatMessages(global, chatId) || {}))
    .map((message) => message.content.storyData?.peerId || message.content.webPage?.story?.peerId)
    .filter((id): id is string => Boolean(id) && isUserId(id));

  const attachBotIds = Object.keys(global.attachMenu?.bots || {});

  const idsToSave = unique([
    ...currentUserId ? [currentUserId] : [],
    ...currentChatIds,
    ...chatStoriesUserIds,
    ...visibleUserIds || [],
    ...attachBotIds,
    ...global.topPeers.userIds || [],
    ...global.recentlyFoundChatIds?.filter(isUserId) || [],
    ...getOrderedIds(ARCHIVED_FOLDER_ID)?.slice(0, GLOBAL_STATE_CACHE_ARCHIVED_CHAT_LIST_LIMIT).filter(isUserId) || [],
    ...getOrderedIds(ALL_FOLDER_ID)?.filter(isUserId) || [],
    ...global.contactList?.userIds || [],
    ...Object.keys(byId),
  ]).slice(0, GLOBAL_STATE_CACHE_USER_LIST_LIMIT);

  return {
    ...INITIAL_GLOBAL_STATE.users,
    byId: pickTruthy(byId, idsToSave),
    statusesById: pickTruthy(statusesById, idsToSave),
    fullInfoById: pickTruthy(fullInfoById, idsToSave),
    botAppPermissionsById,
  };
}

function reduceChats<T extends GlobalState>(global: T): GlobalState['chats'] {
  const { chats: { byId }, currentUserId } = global;
  const currentChatIds = compact(
    Object.values(global.byTabId)
      .map(({ id: tabId }): MessageList | undefined => {
        return selectCurrentMessageList(global, tabId);
      }),
  ).map(({ chatId }) => chatId);

  const messagesChatIds = compact(Object.values(global.byTabId).flatMap(({ id: tabId }) => {
    const messageList = selectCurrentMessageList(global, tabId);
    if (!messageList) return undefined;

    const messages = selectChatMessages(global, messageList.chatId);
    const viewportIds = selectViewportIds(global, messageList.chatId, messageList.threadId, tabId);
    return viewportIds?.map((id) => {
      const message = messages[id];
      if (!message) return undefined;
      const content = message.content;
      const replyPeer = message.replyInfo?.type === 'message' && message.replyInfo.replyToPeerId;
      return content.storyData?.peerId || content.webPage?.story?.peerId || replyPeer;
    });
  }));

  const idsToSave = unique([
    ...currentUserId ? [currentUserId] : [],
    ...currentChatIds,
    ...messagesChatIds,
    ...global.recentlyFoundChatIds || [],
    ...getOrderedIds(ARCHIVED_FOLDER_ID)?.slice(0, GLOBAL_STATE_CACHE_ARCHIVED_CHAT_LIST_LIMIT) || [],
    ...getOrderedIds(ALL_FOLDER_ID) || [],
    ...getOrderedIds(SAVED_FOLDER_ID) || [],
    ...Object.keys(byId),
  ]).slice(0, GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT);

  return {
    ...global.chats,
    similarChannelsById: {},
    similarBotsById: {},
    isFullyLoaded: {},
    notifyExceptionById: {},
    loadingParameters: INITIAL_GLOBAL_STATE.chats.loadingParameters,
    byId: pickTruthy(global.chats.byId, idsToSave),
    fullInfoById: pickTruthy(global.chats.fullInfoById, idsToSave),
    lastMessageIds: {
      all: pickTruthy(global.chats.lastMessageIds.all || {}, idsToSave),
      saved: global.chats.lastMessageIds.saved,
    },
    topicsInfoById: pickTruthy(global.chats.topicsInfoById, currentChatIds),
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
    ...getOrderedIds(ALL_FOLDER_ID) || [],
    ...getOrderedIds(ARCHIVED_FOLDER_ID)?.slice(0, GLOBAL_STATE_CACHE_ARCHIVED_CHAT_LIST_LIMIT) || [],
  ]);

  const openedChatThreadIds = Object.values(global.byTabId).reduce((acc, { id: tabId }) => {
    const { chatId: tabChatId, threadId } = selectCurrentMessageList(global, tabId) || {};
    if (!tabChatId || !threadId || threadId === MAIN_THREAD_ID) {
      return acc;
    }
    const current = acc[tabChatId] || new Set();
    current.add(threadId);
    acc[tabChatId] = current;

    return acc;
  }, {} as Record<string, Set<ThreadId>>);

  const pollIdsToSave: string[] = [];

  chatIdsToSave.forEach((chatId) => {
    const current = global.messages.byChatId[chatId];
    if (!current) {
      return;
    }

    const chatLastMessageId = selectChatLastMessageId(global, chatId);

    const openedThreadIds = Array.from(openedChatThreadIds[chatId] || []);
    const commentThreadIds = Object.values(global.messages.byChatId[chatId].threadsById || {})
      .map(({ threadInfo }) => (threadInfo?.isCommentsInfo ? threadInfo?.originMessageId : undefined))
      .filter(Boolean);
    const threadIds = unique(openedThreadIds.concat(commentThreadIds));

    const threadsToSave = pickTruthy(current.threadsById, [MAIN_THREAD_ID, ...threadIds]);

    const viewportIdsToSave = unique(Object.values(threadsToSave).flatMap((thread) => thread.lastViewportIds || []));
    const topics = selectTopics(global, chatId);
    const topicLastMessageIds = topics && forumPanelChatIds.includes(chatId)
      ? Object.values(topics).map(({ lastMessageId }) => lastMessageId) : [];
    const savedLastMessageIds = chatId === currentUserId && global.chats.lastMessageIds.saved
      ? Object.values(global.chats.lastMessageIds.saved) : [];
    const lastMessageIdsToSave = [chatLastMessageId].concat(topicLastMessageIds).concat(savedLastMessageIds)
      .filter(Boolean);
    const byId = pick(current.byId, viewportIdsToSave.concat(lastMessageIdsToSave));
    const threadsById = Object.keys(threadsToSave).reduce((acc, key) => {
      const thread = threadsToSave[Number(key)];
      acc[Number(key)] = {
        ...thread,
        listedIds: thread.lastViewportIds,
        pinnedIds: undefined,
        typingStatus: undefined,
      };
      return acc;
    }, {} as GlobalState['messages']['byChatId'][string]['threadsById']);

    const cleanedById = Object.values(byId).reduce((acc, message) => {
      if (!message) return acc;

      let cleanedMessage = omitLocalMedia(message);
      cleanedMessage = omitLocalPaidReactions(cleanedMessage);
      acc[message.id] = cleanedMessage;

      if (message.content.pollId) {
        pollIdsToSave.push(message.content.pollId);
      }

      return acc;
    }, {} as Record<number, ApiMessage>);

    byChatId[chatId] = {
      byId: cleanedById,
      threadsById,
    };
  });

  return {
    byChatId,
    pollById: pickTruthy(global.messages.pollById, pollIdsToSave),
    sponsoredByChatId: {},
    playbackByChatId: {},
  };
}

function omitLocalPaidReactions(message: ApiMessage): ApiMessage {
  if (!message.reactions?.results.length) return message;
  return {
    ...message,
    reactions: {
      ...message.reactions,
      results: message.reactions.results.map((reaction) => {
        if (reaction.localAmount) {
          return {
            ...reaction,
            localAmount: undefined,
          };
        }
        return reaction;
      }),
    },
  };
}

function omitLocalMedia(message: ApiMessage): ApiMessage {
  const {
    photo, video, document, sticker,
  } = message.content;

  return {
    ...message,
    content: {
      ...message.content,
      photo: photo && {
        ...photo,
        blobUrl: undefined,
      },
      video: video && {
        ...video,
        blobUrl: undefined,
        previewBlobUrl: undefined,
      },
      document: document && {
        ...document,
        previewBlobUrl: undefined,
      },
      sticker: sticker && {
        ...sticker,
        isPreloadedGlobally: undefined,
      },
    },
    previousLocalId: undefined,
  };
}

function reduceSettings<T extends GlobalState>(global: T): GlobalState['settings'] {
  const {
    byKey, themes, performance, botVerificationShownPeerIds, miniAppsCachedPosition, miniAppsCachedSize,
  } = global.settings;

  return {
    byKey,
    themes,
    performance,
    privacy: {},
    botVerificationShownPeerIds,
    miniAppsCachedPosition,
    miniAppsCachedSize,
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

function reduceAvailableReactions(availableReactions?: ApiAvailableReaction[]): ApiAvailableReaction[] | undefined {
  return availableReactions
    ?.map((r) => pick(r, ['reaction', 'staticIcon', 'title', 'isInactive']));
}

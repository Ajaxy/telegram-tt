/* eslint-disable eslint-multitab-tt/no-immediate-global */
import { addCallback, removeCallback } from '../lib/teact/teactn';

import type { ApiAvailableReaction, ApiMessage } from '../api/types';
import type { ActionReturnType, GlobalState, MessageList } from './types';
import { MAIN_THREAD_ID } from '../api/types';

import {
  ALL_FOLDER_ID,
  ANIMATION_LEVEL_MED,
  ANIMATION_LEVEL_MIN,
  ARCHIVED_FOLDER_ID,
  DEBUG,
  DEFAULT_LIMITS,
  GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT,
  GLOBAL_STATE_CACHE_CUSTOM_EMOJI_LIMIT,
  GLOBAL_STATE_CACHE_DISABLED,
  GLOBAL_STATE_CACHE_KEY,
  GLOBAL_STATE_CACHE_USER_LIST_LIMIT,
  SAVED_FOLDER_ID,
} from '../config';
import { getOrderedIds } from '../util/folderManager';
import {
  compact, pick, pickTruthy, unique,
} from '../util/iteratees';
import { encryptSession } from '../util/passcode';
import { onBeforeUnload, onIdle, throttle } from '../util/schedulers';
import { hasStoredSession } from '../util/sessions';
import { isUserId } from './helpers';
import { addActionHandler, getGlobal } from './index';
import { INITIAL_GLOBAL_STATE, INITIAL_PERFORMANCE_STATE_MID, INITIAL_PERFORMANCE_STATE_MIN } from './initialState';
import { clearGlobalForLockScreen } from './reducers';
import {
  selectChat,
  selectChatLastMessageId,
  selectChatMessages,
  selectCurrentMessageList,
  selectViewportIds,
  selectVisibleUsers,
} from './selectors';

import { getIsMobile } from '../hooks/useAppLayout';
import { isHeavyAnimating } from '../hooks/useHeavyAnimationCheck';

const UPDATE_THROTTLE = 5000;

const updateCacheThrottled = throttle(() => onIdle(() => updateCache()), UPDATE_THROTTLE, false);
const updateCacheForced = () => updateCache(true);

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
    updateCacheForced();
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

  if (!cached.archiveSettings) {
    cached.archiveSettings = initialState.archiveSettings;
  }

  if (!cached.stories) {
    cached.stories = initialState.stories;
  }

  if (!cached.stories.stealthMode) {
    cached.stories.stealthMode = initialState.stories.stealthMode;
  }

  if (!cached.stories.byPeerId) {
    cached.stories.byPeerId = initialState.stories.byPeerId;
    cached.stories.orderedPeerIds = initialState.stories.orderedPeerIds;
  }

  if (!cached.chats.similarChannelsById) {
    cached.chats.similarChannelsById = initialState.chats.similarChannelsById;
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
}

function updateCache(force?: boolean) {
  const global = getGlobal();
  if (!isCaching || global.isLoggingOut || (!force && isHeavyAnimating())) {
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

  const chatStoriesUserIds = currentChatIds
    .flatMap((chatId) => Object.values(selectChatMessages(global, chatId) || {}))
    .map((message) => message.content.storyData?.peerId || message.content.webPage?.story?.peerId)
    .filter((id): id is string => Boolean(id) && isUserId(id));

  const idsToSave = unique([
    ...currentUserId ? [currentUserId] : [],
    ...currentChatIds,
    ...chatStoriesUserIds,
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
    ...getOrderedIds(SAVED_FOLDER_ID) || [],
    ...getOrderedIds(ALL_FOLDER_ID) || [],
    ...getOrderedIds(ARCHIVED_FOLDER_ID) || [],
    ...global.recentlyFoundChatIds || [],
    ...Object.keys(byId),
  ]).slice(0, GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT);

  return {
    ...global.chats,
    similarChannelsById: {},
    isFullyLoaded: {},
    byId: pick(global.chats.byId, idsToSave),
    fullInfoById: pick(global.chats.fullInfoById, idsToSave),
    lastMessageIds: {
      all: pick(global.chats.lastMessageIds.all || {}, idsToSave),
      saved: global.chats.lastMessageIds.saved,
    },
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
  ]);

  chatIdsToSave.forEach((chatId) => {
    const current = global.messages.byChatId[chatId];
    if (!current) {
      return;
    }

    const chat = selectChat(global, chatId);
    const chatLastMessageId = selectChatLastMessageId(global, chatId);

    const threadIds = unique(compact(Object.values(global.byTabId).map(({ id: tabId }) => {
      const { chatId: tabChatId, threadId } = selectCurrentMessageList(global, tabId) || {};
      if (!tabChatId || tabChatId !== chatId || !threadId || threadId === MAIN_THREAD_ID) {
        return undefined;
      }

      return threadId;
    }).concat(
      Object.values(global.messages.byChatId[chatId].threadsById || {})
        .map(({ threadInfo }) => (threadInfo?.isCommentsInfo ? threadInfo?.originMessageId : undefined)),
    )));

    const threadsToSave = pickTruthy(current.threadsById, [MAIN_THREAD_ID, ...threadIds]);
    if (!Object.keys(threadsToSave).length) {
      return;
    }

    const viewportIdsToSave = unique(Object.values(threadsToSave).flatMap((thread) => thread.lastViewportIds || []));
    const topicLastMessageIds = chat?.topics ? Object.values(chat.topics).map(({ lastMessageId }) => lastMessageId)
      : [];
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

      const cleanedMessage = omitLocalMedia(message);
      acc[message.id] = cleanedMessage;
      return acc;
    }, {} as Record<number, ApiMessage>);

    byChatId[chatId] = {
      byId: cleanedById,
      threadsById,
    };
  });

  return {
    byChatId,
    sponsoredByChatId: {},
  };
}

function omitLocalMedia(message: ApiMessage): ApiMessage {
  const {
    photo, video, document, sticker,
  } = message.content;

  if (photo) {
    photo.blobUrl = undefined;
  }

  if (video) {
    video.blobUrl = undefined;
    video.previewBlobUrl = undefined;
  }

  if (document) {
    document.previewBlobUrl = undefined;
  }

  if (sticker) {
    sticker.isPreloadedGlobally = undefined;
  }

  message.previousLocalId = undefined;

  return message;
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

function reduceAvailableReactions(availableReactions?: ApiAvailableReaction[]): ApiAvailableReaction[] | undefined {
  return availableReactions
    ?.map((r) => pick(r, ['reaction', 'staticIcon', 'title', 'isInactive']));
}

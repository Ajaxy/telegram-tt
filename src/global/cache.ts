import { getIsHeavyAnimating, onFullyIdle } from '../lib/teact/teact';
import { addCallback, removeCallback } from '../lib/teact/teactn';

import type {
  ApiAvailableReaction,
  ApiDocument,
  ApiMessage,
  ApiPhoto,
  ApiVideo,
} from '../api/types';
import type {
  IThemeSettings, MessageList, ThemeKey, ThreadId, TopicsInfo,
} from '../types';
import type { ActionReturnType, GlobalState, SharedState } from './types';
import { ApiMessageEntityTypes, MAIN_THREAD_ID } from '../api/types';

import {
  ALL_FOLDER_ID, ANIMATION_LEVEL_DEFAULT,
  ARCHIVED_FOLDER_ID,
  DEBUG,
  EPHEMERAL_MESSAGE_TTL_SECONDS,
  FOLDERS_POSITION_DEFAULT,
  GLOBAL_STATE_CACHE_ARCHIVED_CHAT_LIST_LIMIT,
  GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT,
  GLOBAL_STATE_CACHE_CUSTOM_EMOJI_LIMIT,
  GLOBAL_STATE_CACHE_DISABLED,
  GLOBAL_STATE_CACHE_USER_LIST_LIMIT,
  INSTANT_VIEW_FONT_SIZE_ADJUST_DEFAULT,
  IS_SCREEN_LOCKED_CACHE_KEY,
  SAVED_FOLDER_ID,
  SHARED_STATE_CACHE_KEY,
} from '../config';
import { MAIN_IDB_STORE } from '../util/browser/idb';
import { isUserId } from '../util/entities/ids';
import { getOrderedIds } from '../util/folderManager';
import {
  compact, pick, pickTruthy, unique,
} from '../util/iteratees';
import { GLOBAL_STATE_CACHE_KEY } from '../util/multiaccount';
import { encryptSession } from '../util/passcode';
import { onBeforeUnload, throttle } from '../util/schedulers';
import { getServerTime } from '../util/serverTime';
import { hasStoredSession } from '../util/sessions';
import { getSystemTheme } from '../util/systemTheme';
import { getDefaultPatternColor } from '../util/wallpaper';
import { migrateLegacyWallpaperBlobs, prefetchWallpaperUrl } from '../util/wallpaperStorage';
import { selectSharedSettings } from './selectors/sharedState';
import { selectThreadInfo } from './selectors/threads';
import { addActionHandler, getGlobal } from './index';
import {
  INITIAL_GLOBAL_STATE, INITIAL_PERFORMANCE_STATE_MED, SHARED_STATE_CACHE_VERSION,
} from './initialState';
import { clearGlobalForLockScreen, clearSharedStateForLockScreen } from './reducers';
import {
  selectChatLastMessageId,
  selectChatMessages,
  selectCurrentMessageList,
  selectFullWebPageFromMessage,
  selectTopics,
  selectTopicsInfo,
  selectViewportIds,
  selectVisibleUsers,
} from './selectors';

import { getIsMobile } from '../hooks/useAppLayout';

const UPDATE_THROTTLE = 5000;

// `patternColor` values the cache migration recognizes as defaults and replaces with the
// wallpaper-derived ones
const LEGACY_DEFAULT_PATTERN_COLOR = '#4A8E3A8C';
const LEGACY_DARK_THEME_PATTERN_COLOR = '#48576166';
const updateCacheThrottled = throttle(() => onFullyIdle(() => updateCache()), UPDATE_THROTTLE, false);
const updateCacheForced = () => updateCache(true);

let isCaching = false;
let isRemovingCache = false;
let cacheUpdateSuspensionTimestamp = 0;
let unsubscribeFromBeforeUnload: NoneToVoidFunction | undefined;

export function cacheGlobal(global: GlobalState) {
  return MAIN_IDB_STORE.set(GLOBAL_STATE_CACHE_KEY, global);
}

export function cacheSharedState(state: SharedState) {
  return MAIN_IDB_STORE.set(SHARED_STATE_CACHE_KEY, state);
}

export function loadCachedGlobal() {
  return MAIN_IDB_STORE.get<GlobalState>(GLOBAL_STATE_CACHE_KEY);
}

export function loadCachedSharedState() {
  return MAIN_IDB_STORE.get<SharedState>(SHARED_STATE_CACHE_KEY);
}

export function removeGlobalFromCache() {
  return MAIN_IDB_STORE.del(GLOBAL_STATE_CACHE_KEY);
}

export function removeSharedStateFromCache() {
  return MAIN_IDB_STORE.del(SHARED_STATE_CACHE_KEY);
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
    localStorage.removeItem(IS_SCREEN_LOCKED_CACHE_KEY);
    removeGlobalFromCache().finally(() => {
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
    // Start resolving the wallpaper early without delaying the initial render
    void prefetchCurrentWallpaperUrl(cache);

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

  let cached = cachedFromLocalStorage || await loadCachedGlobal();
  const cachedSharedState = await loadCachedSharedState();
  const cachedAccountThemes = (cached as any)?.settings?.themes as (
    Partial<Record<ThemeKey, IThemeSettings>> | undefined
  );
  const cachedSharedThemes = cachedSharedState?.settings?.themes;
  const shouldMigrateAccountThemes = Boolean(cachedAccountThemes && !cachedSharedThemes);

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.timeEnd('global-state-cache-read');
  }

  if (cached) {
    migrateCache(cached, initialState);
  }

  const sharedState = migrateSharedCache(
    cachedSharedState,
    cached?.sharedState.settings.themes,
    initialState.sharedState,
  );

  if (cached) {
    cached = {
      ...cached,
      sharedState,
    };
  }

  if (shouldMigrateAccountThemes) {
    await migrateLegacyWallpaperBlobs(cachedAccountThemes!);
  }

  const newState: GlobalState = {
    ...initialState,
    ...cached,
    sharedState: {
      ...initialState.sharedState,
      ...sharedState,
      ...cached?.sharedState, // Allow migration to override shared state
      settings: {
        ...initialState.sharedState.settings,
        ...sharedState.settings,
        ...cached?.sharedState.settings,
      },
    },
  };

  return newState;
}

function migrateSharedCache(
  cached: SharedState | undefined,
  fallbackThemes: Partial<Record<ThemeKey, IThemeSettings>> | undefined,
  initialState: SharedState,
): SharedState {
  const cacheVersion = cached?.cacheVersion ?? 0;
  const cachedSettings = cached?.settings;
  const settings = cachedSettings || initialState.settings;
  let migrated = cached || initialState;

  if (cacheVersion < SHARED_STATE_CACHE_VERSION) {
    migrated = {
      ...migrated,
      cacheVersion: SHARED_STATE_CACHE_VERSION,
      settings: {
        ...settings,
        themes: cachedSettings?.themes
          || (fallbackThemes ? cloneThemeSettings(fallbackThemes) : initialState.settings.themes),
      },
    };
  }

  return migrated;
}

function prefetchCurrentWallpaperUrl(global: GlobalState) {
  const { theme, themes, shouldUseSystemTheme } = selectSharedSettings(global);
  const currentTheme = shouldUseSystemTheme ? getSystemTheme() : theme;
  return prefetchWallpaperUrl(themes[currentTheme]?.background);
}

export function migrateCache(cached: GlobalState, initialState: GlobalState) {
  try {
    unsafeMigrateCache(cached, initialState);
    pruneExpiredEphemeralMessages(cached);
    clearCachedDraftLocalFlags(cached);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
}

function pruneExpiredEphemeralMessages(cached: GlobalState) {
  const serverTime = getServerTime();
  Object.values(cached.messages.byChatId).forEach(({ ephemeralById }) => {
    Object.values(ephemeralById).forEach((message) => {
      if (message.date + EPHEMERAL_MESSAGE_TTL_SECONDS <= serverTime) {
        delete ephemeralById[message.id];
      }
    });
  });
}

function unsafeMigrateCache(cached: GlobalState, initialState: GlobalState) {
  const untypedCached = cached as any;
  Object.values(cached.messages.byChatId).forEach((messageStore) => {
    messageStore.ephemeralById ||= {};
  });

  // Pre-fill settings with defaults
  cached.settings.byKey = {
    ...initialState.settings.byKey,
    ...cached.settings.byKey,
  };

  cached.chatFolders = {
    ...initialState.chatFolders,
    ...cached.chatFolders,
  };

  if (!cached.chats.similarChannelsById) {
    cached.chats.similarChannelsById = initialState.chats.similarChannelsById;
  }

  if (!cached.chats.similarBotsById) {
    cached.chats.similarBotsById = initialState.chats.similarBotsById;
  }

  if (!cached.chats.lastMessageIds) {
    cached.chats.lastMessageIds = initialState.chats.lastMessageIds;
  }

  if (!cached.emojiGroups) {
    cached.emojiGroups = initialState.emojiGroups;
  }

  // Clear old color storage to optimize cache size
  if (untypedCached?.appConfig.peerColors) {
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
  if (!cached.topPeerCategories) {
    cached.topPeerCategories = initialState.topPeerCategories;
  }

  if (!cached.reactions.defaultTags?.[0]?.type) {
    cached.reactions = initialState.reactions;
  }

  if (!cached.users.commonChatsById) {
    cached.users.commonChatsById = initialState.users.commonChatsById;
  }
  if (!cached.users.savedMusicByPeerId) {
    cached.users.savedMusicByPeerId = initialState.users.savedMusicByPeerId;
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

  if (!cached.settings.accountDaysTtl) {
    cached.settings.accountDaysTtl = initialState.settings.accountDaysTtl;
  }

  if (!cached.cacheVersion) {
    // Reset because of the new action message structure (the same reset the version 3 migration
    // below performs)
    cached.messages = initialState.messages;
    cached.chats.listIds = initialState.chats.listIds;
    // Treat unversioned caches as version 3, so every later migration still runs — stamping the
    // current version would skip them all
    cached.cacheVersion = 3;
  }

  if (!cached.messages.playbackByChatId) {
    cached.messages.playbackByChatId = initialState.messages.playbackByChatId;
  }

  if (cached.cacheVersion < 2) {
    if (untypedCached.settings.themes?.dark) {
      untypedCached.settings.themes.dark.patternColor = initialState.sharedState.settings.themes.dark!.patternColor;
    }

    if (untypedCached.settings.themes?.light) {
      untypedCached.settings.themes.light.patternColor = initialState.sharedState.settings.themes.light!.patternColor;
    }

    cached.cacheVersion = 2;
  }

  if (!cached.chats.notifyExceptionById) {
    cached.chats.notifyExceptionById = initialState.chats.notifyExceptionById;
  }

  if (!cached.sharedState) {
    cached.sharedState = initialState.sharedState;
    cached.sharedState.settings = {
      canDisplayChatInTitle: untypedCached.settings.byKey.canDisplayChatInTitle,
      animationLevel: untypedCached.settings.byKey.animationLevel,
      foldersPosition: FOLDERS_POSITION_DEFAULT,
      messageSendKeyCombo: untypedCached.settings.byKey.messageSendKeyCombo,
      shouldReplaceTextShortcuts: true,
      messageTextSize: untypedCached.settings.byKey.messageTextSize,
      instantViewFontSizeAdjust: INSTANT_VIEW_FONT_SIZE_ADJUST_DEFAULT,
      performance: untypedCached.settings.performance,
      theme: untypedCached.settings.byKey.theme,
      themes: untypedCached.settings.themes
        ? cloneThemeSettings(untypedCached.settings.themes)
        : initialState.sharedState.settings.themes,
      timeFormat: untypedCached.settings.byKey.timeFormat,
      wasTimeFormatSetManually: untypedCached.settings.byKey.wasTimeFormatSetManually,
      shouldUseSystemTheme: untypedCached.settings.byKey.shouldUseSystemTheme,
      isConnectionStatusMinimized: untypedCached.settings.byKey.isConnectionStatusMinimized,
      shouldForceHttpTransport: untypedCached.settings.byKey.shouldForceHttpTransport,
      language: untypedCached.settings.byKey.language,
      languages: untypedCached.settings.languages,
      shouldSkipBrowserCloseConfirmation: Boolean(untypedCached.settings.byKey.shouldSkipBrowserCloseConfirmation),
      browserCachedPosition: untypedCached.settings.browserCachedPosition,
      browserCachedSize: untypedCached.settings.browserCachedSize,
      shouldAllowHttpTransport: untypedCached.settings.byKey.shouldAllowHttpTransport,
      shouldCollectDebugLogs: untypedCached.settings.byKey.shouldCollectDebugLogs,
      shouldDebugExportedSenders: untypedCached.settings.byKey.shouldDebugExportedSenders,
      shouldWarnAboutFiles: untypedCached.settings.byKey.shouldWarnAboutFiles,
    };
  }

  if (!cached.messages.webPageById) {
    cached.messages.webPageById = initialState.messages.webPageById;
  }

  const cachedSharedSettings = cached.sharedState.settings;
  if (cachedSharedSettings.instantViewFontSizeAdjust === undefined) {
    cachedSharedSettings.instantViewFontSizeAdjust = INSTANT_VIEW_FONT_SIZE_ADJUST_DEFAULT;
  }

  if (!cachedSharedSettings.wasAnimationLevelSetManually) {
    cachedSharedSettings.animationLevel = ANIMATION_LEVEL_DEFAULT;
    cachedSharedSettings.performance = INITIAL_PERFORMANCE_STATE_MED;
  }

  if (cachedSharedSettings.performance.messageBlur === undefined) {
    cachedSharedSettings.performance.messageBlur = false;
  }

  if (cachedSharedSettings.performance.textStreaming === undefined) {
    cachedSharedSettings.performance.textStreaming = true;
  }

  if (!cachedSharedSettings.foldersPosition) {
    cachedSharedSettings.foldersPosition = FOLDERS_POSITION_DEFAULT;
  }

  if (cachedSharedSettings.shouldReplaceTextShortcuts === undefined) {
    cachedSharedSettings.shouldReplaceTextShortcuts = true;
  }

  if (!cached.appConfig) {
    cached.appConfig = initialState.appConfig;
  }

  if (cached.appConfig.webAppAllowedProtocols === undefined) {
    cached.appConfig.webAppAllowedProtocols = initialState.appConfig.webAppAllowedProtocols;
  }

  if (cached.appConfig.isMessagePrimaryEditedDateEnabled === undefined) {
    cached.appConfig.isMessagePrimaryEditedDateEnabled = initialState.appConfig.isMessagePrimaryEditedDateEnabled;
  }

  if (cached.appConfig.richMessageLengthLimit === undefined) {
    cached.appConfig.richMessageLengthLimit = initialState.appConfig.richMessageLengthLimit;
    cached.appConfig.richMessageMaxBlocks = initialState.appConfig.richMessageMaxBlocks;
    cached.appConfig.richMessageMaxDepth = initialState.appConfig.richMessageMaxDepth;
    cached.appConfig.richMessageMaxMedia = initialState.appConfig.richMessageMaxMedia;
    cached.appConfig.richMessageMaxTableColumns = initialState.appConfig.richMessageMaxTableColumns;
  }

  if (untypedCached.sharedState?.settings?.shouldWarnAboutSvg) {
    cached.sharedState.settings.shouldWarnAboutFiles = true;
    untypedCached.sharedState.settings.shouldWarnAboutSvg = undefined;
  }

  if (cached.cacheVersion < 3) {
    cached.cacheVersion = 3;
    cached.messages = initialState.messages;
    cached.chats.listIds = initialState.chats.listIds;
  }

  if (cached.cacheVersion < 4) {
    // The default `patternColor` is now derived from the default wallpapers (`getDefaultPatternColor`).
    // Replace the old constant defaults so chips and wallpaper-aware surfaces agree, but keep any
    // wallpaper-derived color the user's own selection produced.
    if (untypedCached.settings.themes?.light?.patternColor === LEGACY_DEFAULT_PATTERN_COLOR) {
      untypedCached.settings.themes.light.patternColor = getDefaultPatternColor('light');
    }

    if (untypedCached.settings.themes?.dark?.patternColor === LEGACY_DARK_THEME_PATTERN_COLOR) {
      untypedCached.settings.themes.dark.patternColor = getDefaultPatternColor('dark');
    }

    cached.cacheVersion = 4;
  }

  if (cached.cacheVersion < 5) {
    // The account cache contains the authoritative themes until this migration moves them to shared state
    cachedSharedSettings.themes = untypedCached.settings.themes
      || cachedSharedSettings.themes
      || initialState.sharedState.settings.themes;
    delete untypedCached.settings.themes;
    cached.cacheVersion = 5;
  }

  if (!cached.auth) {
    cached.auth = initialState.auth;
    cached.auth.rememberMe = untypedCached.rememberMe;
  }

  if (cached.audioPlayer.volume === undefined) {
    cached.audioPlayer.volume = initialState.audioPlayer.volume;
  }
}

function cloneThemeSettings(themes: Partial<Record<ThemeKey, IThemeSettings>>) {
  return {
    light: themes.light ? { ...themes.light } : undefined,
    dark: themes.dark ? { ...themes.dark } : undefined,
  };
}

function clearCachedDraftLocalFlags(cached: GlobalState) {
  Object.values(cached.messages.byChatId).forEach(({ threadsById }) => {
    Object.values(threadsById).forEach(({ localState }) => {
      const { draft } = localState;
      if (!draft) return;

      draft.isLocal = undefined;
    });
  });
}

function updateCache(force?: boolean) {
  const global = getGlobal();
  if (isRemovingCache || !isCaching || global.auth.isLoggingOut || (!force && getIsHeavyAnimating())) {
    return;
  }

  forceUpdateCache();
}

export function temporarilySuspendCacheUpdate() {
  cacheUpdateSuspensionTimestamp = Date.now() + UPDATE_THROTTLE;
}

export function forceUpdateCache(noEncrypt = false) {
  if (Date.now() < cacheUpdateSuspensionTimestamp) {
    return;
  }

  const global = getGlobal();
  const { hasPasscode, isScreenLocked } = global.passcode;

  if (hasPasscode) {
    if (!isScreenLocked && !noEncrypt) {
      const serializedGlobal = serializeGlobal(global);
      void encryptSession(undefined, serializedGlobal, serializeShared(global.sharedState));
    }

    cacheIsScreenLocked(global);
    cacheGlobal(clearGlobalForLockScreen(global, false));
    cacheSharedState(clearSharedStateForLockScreen(global.sharedState));
    return;
  }

  cacheIsScreenLocked(global);
  cacheGlobal(reduceGlobal(global));
  cacheSharedState(reduceSharedState(global.sharedState));
}

function reduceGlobal<T extends GlobalState>(global: T) {
  const reducedGlobal: GlobalState = {
    ...INITIAL_GLOBAL_STATE,
    ...pick(global, [
      'cacheVersion',
      'appConfig',
      'config',
      'auth',
      'attachMenu',
      'currentUserId',
      'contactList',
      'topPeerCategories',
      'recentEmojis',
      'recentCustomEmojis',
      'emojiGroups',
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
    stickers: reduceStickers(global),
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

function reduceSharedState(sharedState: SharedState): SharedState {
  return {
    ...sharedState,
    settings: {
      ...sharedState.settings,
      languages: undefined,
    },
    isInitial: undefined,
  };
}

export function serializeGlobal<T extends GlobalState>(global: T) {
  return JSON.stringify(reduceGlobal(global));
}

export function serializeShared(sharedState: SharedState) {
  return JSON.stringify(reduceSharedState(sharedState));
}

function reduceStickers<T extends GlobalState>(global: T): GlobalState['stickers'] {
  const { diceSetIdByEmoji, setsById, featured } = global.stickers;
  return {
    ...INITIAL_GLOBAL_STATE.stickers,
    diceSetIdByEmoji,
    setsById: pickTruthy(setsById, Object.values(diceSetIdByEmoji || {})),
    featured: {
      hiddenSetId: featured.hiddenSetId,
    },
  };
}

function reduceCustomEmojis<T extends GlobalState>(global: T): GlobalState['customEmojis'] {
  const { lastRendered, byId } = global.customEmojis;
  const folderEmojiIds = Object.values(global.chatFolders.byId)
    .flatMap((folder) => (
      folder.title.entities
        ?.filter((entity) => entity.type === ApiMessageEntityTypes.CustomEmoji)
        ?.map((entity) => entity.documentId) || []
    ));
  const idsToSave = unique([...folderEmojiIds, ...lastRendered]).slice(0, GLOBAL_STATE_CACHE_CUSTOM_EMOJI_LIMIT);
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
    .map((message) => {
      const webPage = selectFullWebPageFromMessage(global, message);
      return message.content.storyData?.peerId || webPage?.story?.peerId;
    })
    .filter((id): id is string => Boolean(id) && isUserId(id));

  const attachBotIds = Object.keys(global.attachMenu?.bots || {});
  const topPeerIds = getTopPeerIds(global);

  const idsToSave = unique([
    ...currentUserId ? [currentUserId] : [],
    ...currentChatIds,
    ...chatStoriesUserIds,
    ...visibleUserIds || [],
    ...attachBotIds,
    ...topPeerIds.filter(isUserId),
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
      const webPage = selectFullWebPageFromMessage(global, message);
      const replyPeer = message.replyInfo?.type === 'message' && message.replyInfo.replyToPeerId;
      return content.storyData?.peerId || webPage?.story?.peerId || replyPeer;
    });
  }));
  const topPeerIds = getTopPeerIds(global);

  const unlinkedIdsToSave = [
    ...currentUserId ? [currentUserId] : [],
    ...currentChatIds,
    ...messagesChatIds,
    ...topPeerIds,
    ...global.recentlyFoundChatIds || [],
    ...getOrderedIds(ARCHIVED_FOLDER_ID)?.slice(0, GLOBAL_STATE_CACHE_ARCHIVED_CHAT_LIST_LIMIT) || [],
    ...getOrderedIds(ALL_FOLDER_ID) || [],
    ...getOrderedIds(SAVED_FOLDER_ID) || [],
    ...Object.keys(byId),
  ];

  let idsToSave: string[] = [];

  for (const id of unlinkedIdsToSave) {
    const chat = byId[id];
    if (!chat) continue;

    idsToSave.push(id);

    if (chat.linkedMonoforumId) {
      idsToSave.push(chat.linkedMonoforumId);
    }
  }

  idsToSave = unique(idsToSave).slice(0, GLOBAL_STATE_CACHE_CHAT_LIST_LIMIT);

  return {
    ...global.chats,
    similarChannelsById: {},
    similarBotsById: {},
    isFullyLoaded: {},
    notifyExceptionById: pickTruthy(global.chats.notifyExceptionById, idsToSave),
    loadingParameters: INITIAL_GLOBAL_STATE.chats.loadingParameters,
    byId: pickTruthy(global.chats.byId, idsToSave),
    fullInfoById: pickTruthy(global.chats.fullInfoById, idsToSave),
    lastMessageIds: {
      all: pickTruthy(global.chats.lastMessageIds.all || {}, idsToSave),
      saved: global.chats.lastMessageIds.saved,
    },
    topicsInfoById: reduceTopicsInfo(global.chats.topicsInfoById, currentChatIds),
  };
}

function reduceTopicsInfo(
  topicsInfoById: Record<string, TopicsInfo>, chatIds: string[],
): GlobalState['chats']['topicsInfoById'] {
  const topicsInfoToSave = pickTruthy(topicsInfoById, chatIds);

  return Object.entries(topicsInfoToSave).reduce((acc, [chatId, topicsInfo]) => {
    acc[chatId] = {
      ...topicsInfo,
      isCache: true,
    };

    return acc;
  }, {} as GlobalState['chats']['topicsInfoById']);
}

function getTopPeerIds<T extends GlobalState>(global: T) {
  return unique(Object.values(global.topPeerCategories).flatMap((category) => category?.peerIds || []));
}

function reduceMessages<T extends GlobalState>(global: T): GlobalState['messages'] {
  const { currentUserId } = global;
  const byChatId: GlobalState['messages']['byChatId'] = {};
  const serverTime = getServerTime();
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
    ...Object.entries(global.messages.byChatId)
      .filter(([, { ephemeralById }]) => Object.keys(ephemeralById).length)
      .map(([chatId]) => chatId),
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
  const webPageIdsToSave: string[] = [];

  chatIdsToSave.forEach((chatId) => {
    const current = global.messages.byChatId[chatId];
    if (!current) {
      return;
    }

    const chatLastMessageId = selectChatLastMessageId(global, chatId);

    const topicsInfo = selectTopicsInfo(global, chatId);
    const openedThreadIds = Array.from(openedChatThreadIds[chatId] || []);
    const commentThreadIds = Object.values(global.messages.byChatId[chatId].threadsById || {})
      .map(({ threadInfo }) => (threadInfo?.isCommentsInfo ? threadInfo?.originMessageId : undefined))
      .filter(Boolean);
    const threadIds = unique(openedThreadIds.concat(commentThreadIds, topicsInfo?.listedTopicIds || []));

    const topics = selectTopics(global, chatId);
    const threadsToSave = pickTruthy(current.threadsById, [MAIN_THREAD_ID, ...threadIds]);

    const viewportIdsToSave = unique(Object.values(threadsToSave)
      .flatMap((thread) => thread.localState?.lastViewportIds || []));
    const topicLastMessageIds = topics && forumPanelChatIds.includes(chatId)
      ? Object.values(topics).map(({ id }) => selectThreadInfo(global, chatId, id)?.lastMessageId).filter(Boolean) : [];
    const savedLastMessageIds = chatId === currentUserId && global.chats.lastMessageIds.saved
      ? Object.values(global.chats.lastMessageIds.saved) : [];
    const lastMessageIdsToSave = [chatLastMessageId].concat(topicLastMessageIds).concat(savedLastMessageIds)
      .filter(Boolean);
    const byId = pick(current.byId, viewportIdsToSave.concat(lastMessageIdsToSave));
    const threadsById = Object.keys(threadsToSave).reduce((acc, key) => {
      const thread = threadsToSave[Number(key)];
      acc[Number(key)] = {
        ...thread,
        localState: {
          ...thread.localState,
          listedIds: thread.localState?.lastViewportIds,
          draft: thread.localState?.draft,
          typingStatusByPeerId: undefined,
        },
      };
      return acc;
    }, {} as GlobalState['messages']['byChatId'][string]['threadsById']);

    const cleanedById = Object.values(byId).reduce((acc, message) => {
      if (!message || message.isTypingDraft) return acc;

      let cleanedMessage = omitLocalMedia(message);
      cleanedMessage = omitLocalPaidReactions(cleanedMessage);
      acc[message.id] = cleanedMessage;

      if (message.content.pollId) {
        pollIdsToSave.push(message.content.pollId);
      }

      if (message.content.webPage) {
        webPageIdsToSave.push(message.content.webPage.id);
      }

      return acc;
    }, {} as Record<number, ApiMessage>);
    const ephemeralById = Object.values(current.ephemeralById).reduce((acc, message) => {
      if (
        message.sendingState
        || message.date + EPHEMERAL_MESSAGE_TTL_SECONDS <= serverTime
      ) {
        return acc;
      }

      acc[message.id] = omitLocalMedia(message);

      if (message.content.webPage) {
        webPageIdsToSave.push(message.content.webPage.id);
      }

      return acc;
    }, {} as Record<number, ApiMessage>);

    byChatId[chatId] = {
      byId: cleanedById,
      ephemeralById,
      threadsById,
      summaryById: {},
    };
  });

  return {
    byChatId,
    pollById: pickTruthy(global.messages.pollById, pollIdsToSave),
    webPageById: pickTruthy(global.messages.webPageById, webPageIdsToSave),
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
    photo, video, document,
  } = message.content;

  return {
    ...message,
    content: {
      ...message.content,
      photo: photo && omitLocalPhoto(photo),
      video: video && omitLocalVideo(video),
      document: document && omitLocalDocument(document),
    },
    previousLocalId: undefined,
  };
}

function omitLocalPhoto(photo: ApiPhoto): ApiPhoto {
  return {
    ...photo,
    blobUrl: undefined,
  };
}

function omitLocalVideo(video: ApiVideo): ApiVideo {
  return {
    ...video,
    blobUrl: undefined,
    previewBlobUrl: undefined,
  };
}

function omitLocalDocument(document: ApiDocument): ApiDocument {
  return {
    ...document,
    previewBlobUrl: undefined,
  };
}

function reduceSettings<T extends GlobalState>(global: T): GlobalState['settings'] {
  const {
    byKey, botVerificationShownPeerIds, notifyDefaults, lastPremiumBandwithNotificationDate, accountDaysTtl,
  } = global.settings;

  return {
    byKey,
    privacy: {},
    botVerificationShownPeerIds,
    lastPremiumBandwithNotificationDate,
    notifyDefaults,
    accountDaysTtl,
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
    ?.map((r) => ({ ...pick(r, ['reaction', 'staticIcon', 'title', 'isInactive']), isLocalCache: true }));
}

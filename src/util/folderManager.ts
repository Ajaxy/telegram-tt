import { onFullyIdle } from '../lib/teact/teact';
import { addCallback } from '../lib/teact/teactn';
import { addActionHandler, getGlobal } from '../global';

import type {
  ApiChat, ApiChatFolder, ApiNotifyPeerType, ApiPeerNotifySettings, ApiUser,
} from '../api/types';
import type { GlobalState } from '../global/types';
import type { CallbackManager } from './callbacks';

import {
  ALL_FOLDER_ID, ARCHIVED_FOLDER_ID, DEBUG, SAVED_FOLDER_ID, SERVICE_NOTIFICATIONS_USER_ID,
} from '../config';
import { getIsChatMuted } from '../global/helpers/notifications';
import {
  selectChatLastMessage,
  selectNotifyDefaults,
  selectTabState,
  selectTopics,
} from '../global/selectors';
import arePropsShallowEqual from './arePropsShallowEqual';
import { createCallbackManager } from './callbacks';
import { areSortedArraysEqual, unique } from './iteratees';
import { throttle } from './schedulers';

interface FolderSummary {
  id: number;
  listIds?: Set<string>;
  orderedPinnedIds?: string[];
  contacts?: true;
  nonContacts?: true;
  groups?: true;
  channels?: true;
  bots?: true;
  excludeMuted?: true;
  excludeRead?: true;
  excludeArchived?: true;
  excludedChatIds?: Set<string>;
  includedChatIds?: Set<string>;
  pinnedChatIds?: Set<string>;
}

interface ChatSummary {
  id: string;
  type: ApiChat['type'];
  isListedInAll: boolean;
  isListedInSaved: boolean;
  isArchived: boolean;
  isMuted: boolean;
  isUnread: boolean;
  unreadCount?: number;
  unreadMentionsCount?: number;
  orderInAll: number;
  orderInSaved: number;
  isUserBot?: boolean;
  isUserContact?: boolean;
}

const UPDATE_THROTTLE = 500;
const DEBUG_DURATION_LIMIT = 6;

const initials = buildInitials();

let prevGlobal: {
  allFolderListIds?: GlobalState['chats']['listIds']['active'];
  allFolderPinnedIds?: GlobalState['chats']['orderedPinnedIds']['active'];
  archivedFolderListIds?: GlobalState['chats']['listIds']['archived'];
  archivedFolderPinnedIds?: GlobalState['chats']['orderedPinnedIds']['archived'];
  savedFolderListIds?: GlobalState['chats']['listIds']['saved'];
  savedFolderPinnedIds?: GlobalState['chats']['orderedPinnedIds']['saved'];
  isAllFolderFullyLoaded?: boolean;
  isArchivedFolderFullyLoaded?: boolean;
  isSavedFolderFullyLoaded?: boolean;
  lastAllMessageIds?: GlobalState['chats']['lastMessageIds']['all'];
  lastSavedMessageIds?: GlobalState['chats']['lastMessageIds']['saved'];
  topicsInfoById: GlobalState['chats']['topicsInfoById'];
  chatsById: Record<string, ApiChat>;
  foldersById: Record<string, ApiChatFolder>;
  usersById: Record<string, ApiUser>;
  notifyDefaults?: Record<ApiNotifyPeerType, ApiPeerNotifySettings>;
  notifyExceptions?: Record<number, ApiPeerNotifySettings>;
} = initials.prevGlobal;

let prepared: {
  folderSummariesById: Record<string, FolderSummary>;
  chatSummariesById: Map<string, ChatSummary>;
  folderIdsByChatId: Record<string, number[]>;
  chatIdsByFolderId: Record<number, Set<string> | undefined>;
  isOrderedListJustPatched: Record<number, boolean | undefined>;
} = initials.prepared;

let results: {
  orderedIdsByFolderId: Record<string, string[] | undefined>;
  pinnedCountByFolderId: Record<string, number | undefined>; // Also watched by `callbacks.orderedIdsByFolderId`
  chatsCountByFolderId: Record<string, number | undefined>;
  unreadCountersByFolderId: Record<string, {
    chatsCount: number;
    notificationsCount: number;
  } | undefined>;
} = initials.results;

let callbacks: {
  orderedIdsByFolderId: Record<number, CallbackManager>;
  chatsCountByFolderId: CallbackManager;
  unreadCountersByFolderId: CallbackManager;
} = initials.callbacks;

if (DEBUG) {
  (window as any).DEBUG_getFolderManager = () => ({
    prepared,
    results,
  });
}

const updateFolderManagerThrottled = throttle(() => {
  onFullyIdle(() => {
    updateFolderManager(getGlobal());
  });
}, UPDATE_THROTTLE);

let inited = false;

/* Getters */

export function init() {
  inited = true;

  addCallback(updateFolderManagerThrottled);
  addActionHandler('reset', reset);

  const global = getGlobal();
  if (!selectTabState(global).isMasterTab) {
    updateFolders(global, true, true, true, true);
  }
  updateFolderManager(global);
}

export function getOrderedIds(folderId: number) {
  if (!inited) init();

  return results.orderedIdsByFolderId[folderId];
}

export function getPinnedChatsCount(folderId: number) {
  if (!inited) init();

  return results.pinnedCountByFolderId[folderId] || 0;
}

export function getChatsCount() {
  if (!inited) init();

  return results.chatsCountByFolderId;
}

export function getUnreadCounters() {
  if (!inited) init();

  return results.unreadCountersByFolderId;
}

export function getAllNotificationsCount() {
  return getUnreadCounters()[ALL_FOLDER_ID]?.notificationsCount || 0;
}

export function getOrderKey(chatId: string, isForSaved?: boolean) {
  const summary = prepared.chatSummariesById.get(chatId)!;
  return isForSaved ? summary.orderInSaved : summary.orderInAll;
}

/* Callback managers */

export function addOrderedIdsCallback(folderId: number, callback: (orderedIds: string[]) => void) {
  if (!callbacks.orderedIdsByFolderId[folderId]) {
    callbacks.orderedIdsByFolderId[folderId] = createCallbackManager();
  }

  return callbacks.orderedIdsByFolderId[folderId].addCallback(callback);
}

export function addChatsCountCallback(callback: (chatsCount: typeof results.chatsCountByFolderId) => void) {
  return callbacks.chatsCountByFolderId.addCallback(callback);
}

export function addUnreadCountersCallback(callback: (unreadCounters: typeof results.unreadCountersByFolderId) => void) {
  return callbacks.unreadCountersByFolderId.addCallback(callback);
}

/* Global update handlers */

function updateFolderManager(global: GlobalState) {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  let DEBUG_startedAt: number;
  if (DEBUG) {
    DEBUG_startedAt = performance.now();
  }

  const isAllFolderChanged = Boolean(
    global.chats.listIds.active
    && isMainFolderChanged(ALL_FOLDER_ID, global.chats.listIds.active, global.chats.orderedPinnedIds.active),
  );
  const isArchivedFolderChanged = Boolean(
    global.chats.listIds.archived
    && isMainFolderChanged(ARCHIVED_FOLDER_ID, global.chats.listIds.archived, global.chats.orderedPinnedIds.archived),
  );
  const isSavedFolderChanged = Boolean(
    global.chats.listIds.saved
    && isMainFolderChanged(SAVED_FOLDER_ID, global.chats.listIds.saved, global.chats.orderedPinnedIds.saved),
  );
  const isAllFullyLoadedChanged = global.chats.isFullyLoaded.active !== prevGlobal.isAllFolderFullyLoaded;
  const isArchivedFullyLoadedChanged = global.chats.isFullyLoaded.archived !== prevGlobal.isArchivedFolderFullyLoaded;
  const isSavedFolderFullyLoadedChanged = global.chats.isFullyLoaded.saved !== prevGlobal.isSavedFolderFullyLoaded;

  const areFoldersChanged = global.chatFolders.byId !== prevGlobal.foldersById;
  const areChatsChanged = global.chats.byId !== prevGlobal.chatsById;
  const areSavedLastMessageIdsChanged = global.chats.lastMessageIds.saved !== prevGlobal.lastSavedMessageIds;
  const areAllLastMessageIdsChanged = global.chats.lastMessageIds.all !== prevGlobal.lastAllMessageIds;
  const areTopicsChanged = global.chats.topicsInfoById !== prevGlobal.topicsInfoById;
  const areUsersChanged = global.users.byId !== prevGlobal.usersById;
  const areNotifyDefaultsChanged = selectNotifyDefaults(global) !== prevGlobal.notifyDefaults;
  const areNotifyExceptionsChanged = global.chats.notifyExceptionById !== prevGlobal.notifyExceptions;

  let affectedFolderIds: number[] = [];

  if (isAllFullyLoadedChanged || isArchivedFullyLoadedChanged || isSavedFolderFullyLoadedChanged) {
    affectedFolderIds = affectedFolderIds.concat(
      updateFullyLoaded(global, isArchivedFullyLoadedChanged, isSavedFolderFullyLoadedChanged),
    );
  }

  if (!(
    isAllFolderChanged || isArchivedFolderChanged || isSavedFolderChanged || areFoldersChanged
    || areChatsChanged || areUsersChanged || areTopicsChanged || areNotifyDefaultsChanged || areNotifyExceptionsChanged
    || areSavedLastMessageIdsChanged || areAllLastMessageIdsChanged
  )
  ) {
    if (affectedFolderIds.length) {
      updateResults(affectedFolderIds);
    }

    return;
  }

  const prevAllFolderListIds = prevGlobal.allFolderListIds;
  const prevArchivedFolderListIds = prevGlobal.archivedFolderListIds;
  const prevSavedFolderListIds = prevGlobal.savedFolderListIds;

  updateFolders(global, isAllFolderChanged, isArchivedFolderChanged, isSavedFolderChanged, areFoldersChanged);

  affectedFolderIds = affectedFolderIds.concat(updateChats(
    global,
    areFoldersChanged || isAllFolderChanged || isArchivedFolderChanged || isSavedFolderChanged,
    areNotifyDefaultsChanged,
    areNotifyExceptionsChanged,
    prevAllFolderListIds,
    prevArchivedFolderListIds,
    prevSavedFolderListIds,
  ));

  updateResults(unique(affectedFolderIds));

  if (DEBUG) {
    const duration = performance.now() - DEBUG_startedAt!;
    if (duration > DEBUG_DURATION_LIMIT) {
      // eslint-disable-next-line no-console
      console.warn(`Slow \`updateFolderManager\`: ${Math.round(duration)} ms`);
    }
  }
}

function isMainFolderChanged(folderId: number, newListIds?: string[], newPinnedIds?: string[]) {
  const currentListIds = folderId === ALL_FOLDER_ID
    ? prevGlobal.allFolderListIds
    : folderId === SAVED_FOLDER_ID
      ? prevGlobal.savedFolderListIds : prevGlobal.archivedFolderListIds;
  const currentPinnedIds = folderId === ALL_FOLDER_ID
    ? prevGlobal.allFolderPinnedIds
    : folderId === SAVED_FOLDER_ID
      ? prevGlobal.savedFolderPinnedIds : prevGlobal.archivedFolderPinnedIds;

  return currentListIds !== newListIds || currentPinnedIds !== newPinnedIds;
}

function updateFullyLoaded(
  global: GlobalState,
  isArchivedFullyLoadedChanged = false,
  isSavedFolderFullyLoadedChanged = false,
) {
  let affectedFolderIds = [];

  if (isArchivedFullyLoadedChanged) {
    affectedFolderIds.push(ARCHIVED_FOLDER_ID);
  }

  if (isSavedFolderFullyLoadedChanged) {
    affectedFolderIds.push(SAVED_FOLDER_ID);
  }

  const isAllFolderFullyLoaded = global.chats.isFullyLoaded.active;
  const isArchivedFolderFullyLoaded = global.chats.isFullyLoaded.archived;
  const isSavedFolderFullyLoaded = global.chats.isFullyLoaded.saved;

  if (isAllFolderFullyLoaded && isArchivedFolderFullyLoaded) {
    const emptyFolderIds = Object.keys(prepared.folderSummariesById)
      .filter((folderId) => !results.orderedIdsByFolderId[folderId])
      .map(Number);

    affectedFolderIds = affectedFolderIds.concat(emptyFolderIds);
  }

  prevGlobal.isAllFolderFullyLoaded = isAllFolderFullyLoaded;
  prevGlobal.isArchivedFolderFullyLoaded = isArchivedFolderFullyLoaded;
  prevGlobal.isSavedFolderFullyLoaded = isSavedFolderFullyLoaded;

  return affectedFolderIds;
}

function updateFolders(
  global: GlobalState,
  isAllFolderChanged: boolean,
  isArchivedFolderChanged: boolean,
  isSavedFolderChanged: boolean,
  areFoldersChanged: boolean,
) {
  const changedFolders = [];

  if (isAllFolderChanged) {
    const newListIds = global.chats.listIds.active!;
    const newPinnedIds = global.chats.orderedPinnedIds.active;

    prepared.folderSummariesById[ALL_FOLDER_ID] = buildFolderSummaryFromMainList(
      ALL_FOLDER_ID, newListIds, newPinnedIds,
    );

    prevGlobal.allFolderListIds = newListIds;
    prevGlobal.allFolderPinnedIds = newPinnedIds;

    changedFolders.push(ALL_FOLDER_ID);
  }

  if (isArchivedFolderChanged) {
    const newListIds = global.chats.listIds.archived!;
    const newPinnedIds = global.chats.orderedPinnedIds.archived;

    prepared.folderSummariesById[ARCHIVED_FOLDER_ID] = buildFolderSummaryFromMainList(
      ARCHIVED_FOLDER_ID, newListIds, newPinnedIds,
    );

    prevGlobal.archivedFolderListIds = newListIds;
    prevGlobal.archivedFolderPinnedIds = newPinnedIds;

    changedFolders.push(ARCHIVED_FOLDER_ID);
  }

  if (isSavedFolderChanged) {
    const newListIds = global.chats.listIds.saved!;
    const newPinnedIds = global.chats.orderedPinnedIds.saved;

    prepared.folderSummariesById[SAVED_FOLDER_ID] = buildFolderSummaryFromMainList(
      SAVED_FOLDER_ID, newListIds, newPinnedIds,
    );

    prevGlobal.savedFolderListIds = newListIds;
    prevGlobal.savedFolderPinnedIds = newPinnedIds;

    changedFolders.push(SAVED_FOLDER_ID);
  }

  if (areFoldersChanged) {
    const newFoldersById = global.chatFolders.byId;

    Object.values(newFoldersById).forEach((folder) => {
      if (folder === prevGlobal.foldersById[folder.id]) {
        return;
      }

      prepared.folderSummariesById[folder.id] = buildFolderSummary(folder);

      changedFolders.push(folder.id);
    });

    prevGlobal.foldersById = newFoldersById;
  }

  return changedFolders;
}

function buildFolderSummaryFromMainList(
  folderId: number, listIds: string[], orderedPinnedIds?: string[],
): FolderSummary {
  return {
    id: folderId,
    listIds: new Set(listIds),
    orderedPinnedIds,
    pinnedChatIds: new Set(orderedPinnedIds),
  };
}

function buildFolderSummary(folder: ApiChatFolder): FolderSummary {
  return {
    ...folder,
    orderedPinnedIds: folder.pinnedChatIds,
    excludedChatIds: folder.excludedChatIds ? new Set(folder.excludedChatIds) : undefined,
    includedChatIds: folder.excludedChatIds ? new Set(folder.includedChatIds) : undefined,
    pinnedChatIds: folder.excludedChatIds ? new Set(folder.pinnedChatIds) : undefined,
  };
}

function updateChats(
  global: GlobalState,
  areFoldersChanged: boolean,
  areNotifyDefaultsChanged: boolean,
  areNotifyExceptionsChanged: boolean,
  prevAllFolderListIds?: string[],
  prevArchivedFolderListIds?: string[],
  prevSavedFolderListIds?: string[],
) {
  const newChatsById = global.chats.byId;
  const newUsersById = global.users.byId;
  const newAllLastMessageIds = global.chats.lastMessageIds.all;
  const newSavedLastMessageIds = global.chats.lastMessageIds.saved;
  const newNotifyDefaults = selectNotifyDefaults(global);
  const newNotifyExceptions = global.chats.notifyExceptionById;
  const folderSummaries = Object.values(prepared.folderSummariesById);
  const affectedFolderIds = new Set<number>();

  const newAllFolderListIds = global.chats.listIds.active;
  const newArchivedFolderListIds = global.chats.listIds.archived;
  const newSavedFolderListIds = global.chats.listIds.saved;

  const newGeneralIds = [...newAllFolderListIds || [], ...newArchivedFolderListIds || []];
  const newAllIds = [...newGeneralIds, ...newSavedFolderListIds || []];
  let allIds = newAllIds;
  if (newAllFolderListIds !== prevAllFolderListIds || newArchivedFolderListIds !== prevArchivedFolderListIds
    || newSavedFolderListIds !== prevSavedFolderListIds) {
    allIds = unique(allIds.concat(
      prevAllFolderListIds || [], prevArchivedFolderListIds || [], prevSavedFolderListIds || [],
    ));
  }

  allIds.forEach((chatId) => {
    const chat = newChatsById[chatId];

    if (
      !areFoldersChanged
      && !areNotifyDefaultsChanged
      && !areNotifyExceptionsChanged
      && chat === prevGlobal.chatsById[chatId]
      && newUsersById[chatId] === prevGlobal.usersById[chatId]
      && newAllLastMessageIds?.[chatId] === prevGlobal.lastAllMessageIds?.[chatId]
      && newSavedLastMessageIds?.[chatId] === prevGlobal.lastSavedMessageIds?.[chatId]
    ) {
      return;
    }

    let newFolderIds: number[];
    if (chat) {
      const currentSummary = prepared.chatSummariesById.get(chatId);
      const isRemovedFromAll = !newGeneralIds.includes(chatId);
      const isRemovedFromSaved = !newSavedFolderListIds?.includes(chatId);
      const newSummary = buildChatSummary(
        global,
        chat,
        newNotifyDefaults,
        newNotifyExceptions,
        newUsersById[chatId],
        isRemovedFromAll,
        isRemovedFromSaved,
      );

      if (!areFoldersChanged && currentSummary && arePropsShallowEqual(newSummary, currentSummary)) {
        return;
      }

      prepared.chatSummariesById.set(chatId, newSummary);

      newFolderIds = buildChatFolderIds(newSummary, folderSummaries);
      newFolderIds.forEach((folderId) => {
        affectedFolderIds.add(folderId);
      });
    } else {
      prepared.chatSummariesById.delete(chatId);
      newFolderIds = [];
    }

    const currentFolderIds = prepared.folderIdsByChatId[chatId] || [];
    if (areSortedArraysEqual(newFolderIds, currentFolderIds)) {
      return;
    }

    const deletedFolderIds = updateListsForChat(chatId, currentFolderIds, newFolderIds);
    deletedFolderIds.forEach((folderId) => {
      affectedFolderIds.add(folderId);
    });
  });

  prevGlobal.chatsById = newChatsById;
  prevGlobal.usersById = newUsersById;
  prevGlobal.lastAllMessageIds = newAllLastMessageIds;
  prevGlobal.lastSavedMessageIds = newSavedLastMessageIds;
  prevGlobal.notifyDefaults = newNotifyDefaults;
  prevGlobal.notifyExceptions = newNotifyExceptions;

  return Array.from(affectedFolderIds);
}

function buildChatSummary<T extends GlobalState>(
  global: T,
  chat: ApiChat,
  notifyDefaults?: Record<ApiNotifyPeerType, ApiPeerNotifySettings>,
  notifyExceptions?: Record<string, ApiPeerNotifySettings>,
  user?: ApiUser,
  isRemovedFromAll?: boolean,
  isRemovedFromSaved?: boolean,
): ChatSummary {
  const {
    id, type, isRestricted, isNotJoined, migratedTo, folderId,
    unreadCount: chatUnreadCount, unreadMentionsCount: chatUnreadMentionsCount, hasUnreadMark,
    isForum,
  } = chat;
  const topics = selectTopics(global, chat.id);

  const { unreadCount, unreadMentionsCount } = isForum
    ? Object.values(topics || {}).reduce((acc, topic) => {
      acc.unreadCount += topic.unreadCount;
      acc.unreadMentionsCount += topic.unreadMentionsCount;

      return acc;
    }, { unreadCount: 0, unreadMentionsCount: 0 })
    : { unreadCount: chatUnreadCount, unreadMentionsCount: chatUnreadMentionsCount };

  const userInfo = type === 'chatTypePrivate' && user;
  const lastMessage = selectChatLastMessage(global, chat.id);
  const shouldHideServiceChat = chat.id === SERVICE_NOTIFICATIONS_USER_ID && (
    !lastMessage || lastMessage.content.action?.type === 'historyClear'
  );

  const orderInAll = Math.max(chat.creationDate || 0, chat.draftDate || 0, lastMessage?.date || 0);

  const lastMessageInSaved = selectChatLastMessage(global, chat.id, 'saved');
  const orderInSaved = lastMessageInSaved?.date || 0;

  return {
    id,
    type,
    isListedInAll: Boolean(!isRestricted && !isNotJoined && !migratedTo && !shouldHideServiceChat && !isRemovedFromAll),
    isListedInSaved: !isRemovedFromSaved,
    isArchived: folderId === ARCHIVED_FOLDER_ID,
    isMuted: getIsChatMuted(chat, notifyDefaults, notifyExceptions?.[chat.id]),
    isUnread: Boolean(unreadCount || unreadMentionsCount || hasUnreadMark),
    unreadCount,
    unreadMentionsCount,
    isUserBot: userInfo ? userInfo.type === 'userTypeBot' : undefined,
    isUserContact: userInfo ? userInfo.isContact : undefined,
    orderInAll,
    orderInSaved,
  };
}

function buildChatFolderIds(chatSummary: ChatSummary, folderSummaries: FolderSummary[]) {
  return folderSummaries.reduce<number[]>((acc, folderSummary) => {
    if (isChatInFolder(chatSummary, folderSummary)) {
      acc.push(folderSummary.id);
    }

    return acc;
  }, []).sort();
}

function isChatInFolder(
  chatSummary: ChatSummary,
  folderSummary: FolderSummary,
) {
  const isListed = folderSummary.id === SAVED_FOLDER_ID ? chatSummary.isListedInSaved : chatSummary.isListedInAll;
  if (!isListed) {
    return false;
  }

  const { id: chatId, type } = chatSummary;

  if (folderSummary.listIds) {
    if (
      (chatSummary.isArchived && folderSummary.id === ALL_FOLDER_ID)
      || (!chatSummary.isArchived && folderSummary.id === ARCHIVED_FOLDER_ID)
    ) {
      return false;
    }

    return folderSummary.listIds.has(chatId);
  }

  if (folderSummary.excludedChatIds?.has(chatId)) {
    return false;
  }

  if (folderSummary.includedChatIds?.has(chatId)) {
    return true;
  }

  if (folderSummary.pinnedChatIds?.has(chatId)) {
    return true;
  }

  if (folderSummary.excludeArchived && chatSummary.isArchived) {
    return false;
  }

  if (folderSummary.excludeRead && !chatSummary.isUnread) {
    return false;
  }

  if (folderSummary.excludeMuted && chatSummary.isMuted && !chatSummary.unreadMentionsCount) {
    return false;
  }

  if (type === 'chatTypePrivate') {
    if (chatSummary.isUserBot) {
      if (folderSummary.bots) {
        return true;
      }
    } else {
      if (folderSummary.contacts && chatSummary.isUserContact) {
        return true;
      }

      if (folderSummary.nonContacts && !chatSummary.isUserContact) {
        return true;
      }
    }
  } else if (type === 'chatTypeChannel') {
    return Boolean(folderSummary.channels);
  } else if (type === 'chatTypeBasicGroup' || type === 'chatTypeSuperGroup') {
    return Boolean(folderSummary.groups);
  }

  return false;
}

function updateListsForChat(chatId: string, currentFolderIds: number[], newFolderIds: number[]) {
  const currentFolderIdsSet = new Set(currentFolderIds);
  const newFolderIdsSet = new Set(newFolderIds);
  const deletedFolderIds: number[] = [];

  unique([...currentFolderIds, ...newFolderIds]).forEach((folderId) => {
    let currentFolderOrderedIds = results.orderedIdsByFolderId[folderId];

    if (currentFolderIdsSet.has(folderId) && !newFolderIdsSet.has(folderId)) {
      prepared.chatIdsByFolderId[folderId]!.delete(chatId);

      deletedFolderIds.push(folderId);

      if (currentFolderOrderedIds) {
        currentFolderOrderedIds = currentFolderOrderedIds.filter((id) => id !== chatId);
        prepared.isOrderedListJustPatched[folderId] = true;
      }
    } else if (!currentFolderIdsSet.has(folderId) && newFolderIdsSet.has(folderId)) {
      if (!prepared.chatIdsByFolderId[folderId]) {
        prepared.chatIdsByFolderId[folderId] = new Set();
      }

      prepared.chatIdsByFolderId[folderId]!.add(chatId);

      if (currentFolderOrderedIds) {
        currentFolderOrderedIds.push(chatId);
        prepared.isOrderedListJustPatched[folderId] = true;
      }
    }

    results.orderedIdsByFolderId[folderId] = currentFolderOrderedIds;
  });

  prepared.folderIdsByChatId[chatId] = newFolderIds;

  return deletedFolderIds;
}

function updateResults(affectedFolderIds: number[]) {
  let wasUnreadCountersChanged = false;
  let wasChatsCountChanged = false;

  Array.from(affectedFolderIds).forEach((folderId) => {
    const { pinnedCount: newPinnedCount, orderedIds: newOrderedIds } = buildFolderOrderedIds(folderId);
    // When signed out
    if (!newOrderedIds) {
      return;
    }

    const currentOrderedIds = results.orderedIdsByFolderId[folderId];
    const currentPinnedCount = results.pinnedCountByFolderId[folderId];
    const areOrderedIdsChanged = (
      !currentOrderedIds
      || currentPinnedCount === undefined || currentPinnedCount !== newPinnedCount
      || prepared.isOrderedListJustPatched[folderId]
      || !areSortedArraysEqual(newOrderedIds, currentOrderedIds)
    );
    if (areOrderedIdsChanged) {
      prepared.isOrderedListJustPatched[folderId] = false;
      results.orderedIdsByFolderId[folderId] = newOrderedIds;
      results.pinnedCountByFolderId[folderId] = newPinnedCount;
      callbacks.orderedIdsByFolderId[folderId]?.runCallbacks(newOrderedIds);
    }

    const currentChatsCount = results.chatsCountByFolderId[folderId];
    const newChatsCount = newOrderedIds.length;
    if (!wasChatsCountChanged) {
      wasChatsCountChanged = currentChatsCount !== newChatsCount;
    }
    results.chatsCountByFolderId[folderId] = newChatsCount;

    const currentUnreadCounters = results.unreadCountersByFolderId[folderId];
    const newUnreadCounters = buildFolderUnreadCounters(folderId);
    if (!wasUnreadCountersChanged) {
      wasUnreadCountersChanged = (
        !currentUnreadCounters || !arePropsShallowEqual(newUnreadCounters, currentUnreadCounters)
      );
    }
    results.unreadCountersByFolderId[folderId] = newUnreadCounters;
  });

  if (wasChatsCountChanged) {
    // We need to update the entire object as it will be returned from a hook
    const newValue = { ...results.chatsCountByFolderId };
    results.chatsCountByFolderId = newValue;
    callbacks.chatsCountByFolderId.runCallbacks(newValue);
  }

  if (wasUnreadCountersChanged) {
    // We need to update the entire object as it will be returned from a hook
    const newValue = { ...results.unreadCountersByFolderId };
    results.unreadCountersByFolderId = newValue;
    callbacks.unreadCountersByFolderId.runCallbacks(newValue);
  }
}

function buildFolderOrderedIds(folderId: number) {
  const folderSummary = prepared.folderSummariesById[folderId];
  if (!folderSummary) {
    return {};
  }

  const { orderedPinnedIds, pinnedChatIds } = folderSummary;
  const {
    chatIdsByFolderId: { [folderId]: chatIds },
  } = prepared;
  const {
    orderedIdsByFolderId: { [folderId]: prevOrderedIds },
  } = results;

  const isSavedFolder = folderId === SAVED_FOLDER_ID;

  const sortedPinnedIds = chatIds ? orderedPinnedIds?.filter((id) => chatIds.has(id)) : orderedPinnedIds;
  const allListIds = prevOrderedIds || (chatIds && Array.from(chatIds)) || [];
  const notPinnedIds = pinnedChatIds ? allListIds.filter((id) => !pinnedChatIds.has(id)) : allListIds;
  const sortedNotPinnedIds = notPinnedIds.sort((chatId1: string, chatId2: string) => {
    return getOrderKey(chatId2, isSavedFolder) - getOrderKey(chatId1, isSavedFolder);
  });

  return {
    pinnedCount: sortedPinnedIds?.length || 0,
    orderedIds: [
      ...(sortedPinnedIds || []),
      ...sortedNotPinnedIds,
    ],
  };
}

function buildFolderUnreadCounters(folderId: number) {
  const {
    chatSummariesById,
  } = prepared;
  const {
    orderedIdsByFolderId: { [folderId]: orderedIds },
  } = results;

  return orderedIds!.reduce((newUnreadCounters, chatId) => {
    const chatSummary = chatSummariesById.get(chatId);
    if (!chatSummary) {
      return newUnreadCounters;
    }

    if (chatSummary.isUnread) {
      newUnreadCounters.chatsCount++;

      if (chatSummary.unreadMentionsCount) {
        newUnreadCounters.notificationsCount += chatSummary.unreadMentionsCount;
      }

      if (!chatSummary.isMuted) {
        if (chatSummary.unreadCount) {
          newUnreadCounters.notificationsCount += chatSummary.unreadCount;
        } else if (!chatSummary.unreadMentionsCount) {
          newUnreadCounters.notificationsCount += 1; // Manually marked unread
        }
      }
    }

    return newUnreadCounters;
  }, {
    chatsCount: 0,
    notificationsCount: 0,
  });
}

function buildInitials() {
  return {
    prevGlobal: {
      foldersById: {},
      chatsById: {},
      usersById: {},
      topicsInfoById: {},
    },

    prepared: {
      folderSummariesById: {},
      chatSummariesById: new Map(),
      folderIdsByChatId: {},
      chatIdsByFolderId: {},
      isOrderedListJustPatched: {},
    },

    results: {
      orderedIdsByFolderId: {},
      pinnedCountByFolderId: {},
      chatsCountByFolderId: {},
      unreadCountersByFolderId: {},
    },

    callbacks: {
      orderedIdsByFolderId: {},
      chatsCountByFolderId: createCallbackManager(),
      unreadCountersByFolderId: createCallbackManager(),
    },
  };
}

function reset() {
  const newInitials = buildInitials();

  prevGlobal = newInitials.prevGlobal;
  prepared = newInitials.prepared;
  results = newInitials.results;
  callbacks = newInitials.callbacks;
}

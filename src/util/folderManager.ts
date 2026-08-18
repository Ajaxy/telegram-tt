import { onFullyIdle } from '../lib/teact/teact';
import { addCallback } from '../lib/teact/teactn';
import { addActionHandler, getGlobal } from '../global';

import type { GlobalState } from '../global/types';
import type { CallbackManager } from './callbacks';
import {
  type ApiChat, type ApiChatFolder, type ApiNotifyPeerType, type ApiPeerNotifySettings, type ApiUser,
  MAIN_THREAD_ID,
} from '../api/types';

import {
  ALL_FOLDER_ID, ARCHIVED_FOLDER_ID, DEBUG, SAVED_FOLDER_ID, SERVICE_NOTIFICATIONS_USER_ID,
} from '../config';
import { isChatCommunity } from '../global/helpers';
import { getIsChatMuted, mergeNotifySettings } from '../global/helpers/notifications';
import {
  selectChat,
  selectChatLastMessage,
  selectIsChatRestricted,
  selectNotifyDefaults,
  selectTabState,
  selectTopics,
} from '../global/selectors';
import { selectDraft, selectThreadReadState } from '../global/selectors/threads';
import { areRecordsShallowEqual } from './areShallowEqual';
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
  isHiddenByCollapsedCommunity: boolean;
  isArchived: boolean;
  isMuted: boolean;
  isUnread: boolean;
  unreadCount?: number;
  unreadMentionsCount?: number;
  linkedCommunityId?: string;
  orderInAll: number;
  orderInSaved: number;
  isUserBot?: boolean;
  isUserContact?: boolean;
}

interface UnreadCounters {
  chatsCount: number;
  notificationsCount: number;
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
  threadsByChatId: Record<string, GlobalState['messages']['byChatId'][string]['threadsById'] | undefined>;
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
  unreadChatIdsByFolderId: Record<string, string[] | undefined>;
} = initials.results;

let callbacks: {
  orderedIdsByFolderId: Record<number, CallbackManager>;
  chatsCountByFolderId: CallbackManager;
  unreadCountersByFolderId: CallbackManager;
  unreadChatIdsByFolderId: CallbackManager;
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

export function getUnreadChatsByFolderId() {
  if (!inited) init();

  return results.unreadChatIdsByFolderId;
}

export function getAllNotificationsCount() {
  return getUnreadCounters()[ALL_FOLDER_ID]?.notificationsCount || 0;
}

export function getOrderKey(chatId: string, isForSaved?: boolean) {
  const summary = prepared.chatSummariesById.get(chatId)!;
  return isForSaved ? summary.orderInSaved : summary.orderInAll;
}

export function getChatFolderIds(chatId: string) {
  return prepared.folderIdsByChatId[chatId];
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

export function addUnreadChatsByFolderIdCallback(
  callback: (unreadChats: typeof results.unreadChatIdsByFolderId) => void,
) {
  return callbacks.unreadChatIdsByFolderId.addCallback(callback);
}

export function addUnreadCountersCallback(callback: (unreadCounters: typeof results.unreadCountersByFolderId) => void) {
  return callbacks.unreadCountersByFolderId.addCallback(callback);
}

/* Global update handlers */

function updateFolderManager(global: GlobalState) {
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
  const allRelevantChatIds = unique([
    ...global.chats.listIds.active || [],
    ...global.chats.listIds.archived || [],
    ...global.chats.listIds.saved || [],
    ...prevGlobal.allFolderListIds || [],
    ...prevGlobal.archivedFolderListIds || [],
    ...prevGlobal.savedFolderListIds || [],
  ]);
  const areThreadsByChatChanged = allRelevantChatIds.some((chatId) => (
    global.messages.byChatId[chatId]?.threadsById !== prevGlobal.threadsByChatId[chatId]
  ));

  let affectedFolderIds: number[] = [];

  if (isAllFullyLoadedChanged || isArchivedFullyLoadedChanged || isSavedFolderFullyLoadedChanged) {
    affectedFolderIds = affectedFolderIds.concat(
      updateFullyLoaded(global, isArchivedFullyLoadedChanged, isSavedFolderFullyLoadedChanged),
    );
  }

  if (!(
    isAllFolderChanged || isArchivedFolderChanged || isSavedFolderChanged || areFoldersChanged
    || areChatsChanged || areUsersChanged || areTopicsChanged || areNotifyDefaultsChanged || areNotifyExceptionsChanged
    || areSavedLastMessageIdsChanged || areAllLastMessageIdsChanged || areThreadsByChatChanged
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
    excludedChatIds: new Set(folder.excludedChatIds),
    includedChatIds: new Set(folder.includedChatIds),
    pinnedChatIds: new Set(folder.pinnedChatIds),
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
  const newMessageStoresByChatId = global.messages.byChatId;
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

  // A community has no message of its own; order it by its most recent member-chat
  // activity. Also collect communities whose collapsed state changed: their member
  // chats are shown or hidden by it, so they must be re-evaluated even though the
  // member chats themselves did not change.
  const communityOrderById: Record<string, number> = {};
  const changedCommunityIds = new Set<string>();
  allIds.forEach((chatId) => {
    const chat = newChatsById[chatId];
    if (!chat) return;

    if (isChatCommunity(chat)) {
      if (prevGlobal.chatsById[chatId]?.isCollapsedInDialogs !== chat.isCollapsedInDialogs) {
        changedCommunityIds.add(chatId);
      }
      return;
    }

    const { linkedCommunityId } = chat;
    if (!linkedCommunityId) return;

    const order = selectChatLastMessage(global, chatId)?.date || 0;
    if (order > (communityOrderById[linkedCommunityId] || 0)) {
      communityOrderById[linkedCommunityId] = order;
    }
  });

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
      && newMessageStoresByChatId[chatId]?.threadsById === prevGlobal.threadsByChatId[chatId]
      // A community's order derives from its members, which may change independently
      && !(chat && isChatCommunity(chat))
      // A member chat's visibility derives from its community's collapsed state
      && !(chat?.linkedCommunityId && changedCommunityIds.has(chat.linkedCommunityId))
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
        communityOrderById[chatId],
      );

      if (!areFoldersChanged && currentSummary && areRecordsShallowEqual(newSummary, currentSummary)) {
        return;
      }

      prepared.chatSummariesById.set(chatId, newSummary);

      [currentSummary?.linkedCommunityId, newSummary.linkedCommunityId].forEach((communityId) => {
        if (!communityId) return;
        prepared.folderIdsByChatId[communityId]?.forEach((folderId) => {
          affectedFolderIds.add(folderId);
        });
      });

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
  prevGlobal.threadsByChatId = allIds.reduce((acc, chatId) => {
    acc[chatId] = newMessageStoresByChatId[chatId]?.threadsById;
    return acc;
  }, {} as typeof prevGlobal.threadsByChatId);

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
  communityOrder?: number,
): ChatSummary {
  const {
    id, type, isNotJoined, migratedTo, folderId,
    isForum, linkedCommunityId, isCollapsedInDialogs,
  } = chat;

  const isCommunity = isChatCommunity(chat);

  // An expanded community is replaced by its member chats in every folder. A collapsed
  // community hides its members only in the main lists, so custom folders remain independent.
  const linkedCommunity = linkedCommunityId ? selectChat(global, linkedCommunityId) : undefined;
  const isHiddenByCollapsedCommunity = Boolean(linkedCommunity?.isCollapsedInDialogs);
  const notifyException = mergeNotifySettings(
    linkedCommunityId ? notifyExceptions?.[linkedCommunityId] : undefined,
    notifyExceptions?.[chat.id],
  );
  const draft = selectDraft(global, id, MAIN_THREAD_ID);
  const isRestricted = selectIsChatRestricted(global, id);
  const topics = selectTopics(global, chat.id);
  const chatReadState = selectThreadReadState(global, chat.id, MAIN_THREAD_ID);
  const {
    unreadCount: chatUnreadCount, unreadMentionsCount: chatUnreadMentionsCount, hasUnreadMark,
  } = chatReadState || {};

  const { unreadCount, unreadMentionsCount } = isForum
    ? Object.values(topics || {}).reduce((acc, topic) => {
      const topicReadState = selectThreadReadState(global, chat.id, topic.id);
      acc.unreadCount += topicReadState?.unreadCount || 0;
      acc.unreadMentionsCount += topicReadState?.unreadMentionsCount || 0;

      return acc;
    }, { unreadCount: 0, unreadMentionsCount: 0 })
    : { unreadCount: chatUnreadCount, unreadMentionsCount: chatUnreadMentionsCount };

  const userInfo = type === 'chatTypePrivate' && user;
  const lastMessage = selectChatLastMessage(global, chat.id);
  const shouldHideServiceChat = chat.id === SERVICE_NOTIFICATIONS_USER_ID && (
    !lastMessage || lastMessage.content.action?.type === 'historyClear'
  );

  const orderInAll = isCommunity && communityOrder
    ? communityOrder
    : Math.max(chat.creationDate || 0, draft?.date || 0, lastMessage?.date || 0);

  const lastMessageInSaved = selectChatLastMessage(global, chat.id, 'saved');
  const orderInSaved = lastMessageInSaved?.date || 0;

  return {
    id,
    type,
    isListedInAll: Boolean(
      !isRestricted && !isNotJoined && !migratedTo && !shouldHideServiceChat && !isRemovedFromAll
      && !(isCommunity && !isCollapsedInDialogs),
    ),
    isListedInSaved: !isRemovedFromSaved,
    isHiddenByCollapsedCommunity,
    isArchived: folderId === ARCHIVED_FOLDER_ID,
    isMuted: getIsChatMuted(chat, notifyDefaults, notifyException),
    isUnread: Boolean(unreadCount || unreadMentionsCount || hasUnreadMark),
    unreadCount,
    unreadMentionsCount,
    linkedCommunityId,
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
      chatSummary.isHiddenByCollapsedCommunity
      && (folderSummary.id === ALL_FOLDER_ID || folderSummary.id === ARCHIVED_FOLDER_ID)
    ) {
      return false;
    }

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

      prepared.chatIdsByFolderId[folderId].add(chatId);

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
  let wasUnreadChatsChanged = false;

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

    const communityMemberSummariesById = buildCommunityMemberSummariesById(folderId, newOrderedIds);
    const currentUnreadCounters = results.unreadCountersByFolderId[folderId];
    const newUnreadCounters = buildFolderUnreadCounters(newOrderedIds, communityMemberSummariesById);
    if (!wasUnreadCountersChanged) {
      wasUnreadCountersChanged = (
        !currentUnreadCounters || !areRecordsShallowEqual(newUnreadCounters, currentUnreadCounters)
      );
    }
    results.unreadCountersByFolderId[folderId] = newUnreadCounters;

    const currentUnreadChats = results.unreadChatIdsByFolderId[folderId];
    const newUnreadChats = buildFolderByUnreadChats(newOrderedIds, communityMemberSummariesById);
    if (!wasUnreadChatsChanged) {
      wasUnreadChatsChanged = (
        !currentUnreadChats || !areSortedArraysEqual(newUnreadChats, currentUnreadChats)
      );
    }
    results.unreadChatIdsByFolderId[folderId] = newUnreadChats;
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

  if (wasUnreadChatsChanged) {
    callbacks.unreadChatIdsByFolderId.runCallbacks(results.unreadChatIdsByFolderId);
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

function buildFolderUnreadCounters(
  orderedIds: string[],
  communityMemberSummariesById?: Record<string, ChatSummary[]>,
) {
  const { chatSummariesById } = prepared;

  return orderedIds.reduce((newUnreadCounters, chatId) => {
    const communityMemberSummaries = communityMemberSummariesById?.[chatId];
    if (communityMemberSummaries) {
      communityMemberSummaries.forEach((chatSummary) => addChatUnreadCounters(newUnreadCounters, chatSummary));
      return newUnreadCounters;
    }

    const chatSummary = chatSummariesById.get(chatId);
    if (chatSummary) addChatUnreadCounters(newUnreadCounters, chatSummary);

    return newUnreadCounters;
  }, {
    chatsCount: 0,
    notificationsCount: 0,
  });
}

function addChatUnreadCounters(unreadCounters: UnreadCounters, chatSummary: ChatSummary) {
  if (!chatSummary.isUnread) return;

  unreadCounters.chatsCount += 1;

  if (chatSummary.unreadMentionsCount) {
    unreadCounters.notificationsCount += chatSummary.unreadMentionsCount;
  }

  if (!chatSummary.isMuted) {
    if (chatSummary.unreadCount) {
      unreadCounters.notificationsCount += chatSummary.unreadCount;
    } else if (!chatSummary.unreadMentionsCount) {
      unreadCounters.notificationsCount += 1; // Manually marked unread
    }
  }
}

function buildFolderByUnreadChats(
  orderedIds: string[],
  communityMemberSummariesById?: Record<string, ChatSummary[]>,
) {
  const { chatSummariesById } = prepared;

  return orderedIds.reduce<string[]>((unreadChatIds, chatId) => {
    const communityMemberSummaries = communityMemberSummariesById?.[chatId];
    if (communityMemberSummaries) {
      communityMemberSummaries.forEach((chatSummary) => {
        if (chatSummary.isUnread) unreadChatIds.push(chatSummary.id);
      });
      return unreadChatIds;
    }

    if (chatSummariesById.get(chatId)?.isUnread) unreadChatIds.push(chatId);
    return unreadChatIds;
  }, []);
}

function buildCommunityMemberSummariesById(folderId: number, orderedIds: string[]) {
  if (folderId !== ALL_FOLDER_ID && folderId !== ARCHIVED_FOLDER_ID) return undefined;

  const orderedIdSet = new Set(orderedIds);

  return Array.from(prepared.chatSummariesById.values()).reduce<Record<string, ChatSummary[]>>((acc, chatSummary) => {
    const { linkedCommunityId } = chatSummary;
    if (
      !chatSummary.isListedInAll || !chatSummary.isHiddenByCollapsedCommunity
      || !linkedCommunityId || !orderedIdSet.has(linkedCommunityId)
    ) {
      return acc;
    }

    acc[linkedCommunityId] ??= [];
    acc[linkedCommunityId].push(chatSummary);
    return acc;
  }, {});
}

function buildInitials() {
  return {
    prevGlobal: {
      foldersById: {},
      chatsById: {},
      usersById: {},
      topicsInfoById: {},
      threadsByChatId: {},
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
      unreadChatIdsByFolderId: {},
    },

    callbacks: {
      orderedIdsByFolderId: {},
      chatsCountByFolderId: createCallbackManager(),
      unreadCountersByFolderId: createCallbackManager(),
      unreadChatIdsByFolderId: createCallbackManager(),
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

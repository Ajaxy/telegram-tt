import type {
  ApiChat, ApiChatFolder, ApiChatlistExportedInvite,
  ApiChatMember, ApiError, ApiMissingInvitedUser,
  ApiTopic,
  LinkContext,
} from '../../../api/types';
import type { RequiredGlobalActions } from '../../index';
import type {
  ActionReturnType, GlobalState, TabArgs,
} from '../../types';
import { MAIN_THREAD_ID } from '../../../api/types';
import {
  ChatCreationProgress,
  type ChatListType,
  ManagementProgress,
  NewChatMembersProgress,
  SettingsScreens,
  type ThreadId,
} from '../../../types';

import {
  ALL_FOLDER_ID,
  ARCHIVED_FOLDER_ID,
  CHAT_LIST_LOAD_SLICE,
  DEBUG,
  GLOBAL_SUGGESTED_CHANNELS_ID,
  RE_TG_LINK,
  SAVED_FOLDER_ID,
  SERVICE_NOTIFICATIONS_USER_ID,
  TME_WEB_DOMAINS,
  TMP_CHAT_ID,
  TOP_CHAT_MESSAGES_PRELOAD_LIMIT,
  TOPICS_SLICE,
  TOPICS_SLICE_SECOND_LOAD,
} from '../../../config';
import { copyTextToClipboard } from '../../../util/clipboard';
import { formatShareText, processDeepLink } from '../../../util/deeplink';
import { isDeepLink } from '../../../util/deepLinkParser';
import { isUserId } from '../../../util/entities/ids';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { getOrderedIds } from '../../../util/folderManager';
import {
  buildCollectionByKey, omit, pick, unique,
} from '../../../util/iteratees';
import { isLocalMessageId } from '../../../util/keys/messageKey';
import * as langProvider from '../../../util/oldLangProvider';
import { debounce, pause, throttle } from '../../../util/schedulers';
import { extractCurrentThemeParams } from '../../../util/themeStyle';
import { callApi } from '../../../api/gramjs';
import {
  getIsSavedDialog,
  isChatArchived,
  isChatBasicGroup,
  isChatChannel,
  isChatMonoforum,
  isChatSuperGroup,
  isUserBot,
} from '../../helpers';
import {
  addActionHandler, getGlobal, setGlobal,
} from '../../index';
import {
  addChatListIds,
  addChatMembers,
  addChats,
  addMessages,
  addNotifyExceptions,
  addSimilarBots,
  addUsers,
  addUserStatuses,
  deleteChatMessages,
  deletePeerPhoto,
  deleteTopic,
  leaveChat,
  removeChatFromChatLists,
  replaceChatFullInfo,
  replaceChatListIds,
  replaceChatListLoadingParameters,
  replaceMessages,
  replaceNotifyExceptions,
  replaceSimilarChannels,
  replaceThreadParam,
  replaceUserStatuses,
  toggleSimilarChannels,
  updateChat,
  updateChatFullInfo,
  updateChatLastMessageId,
  updateChatListSecondaryInfo,
  updateChats,
  updateChatsLastMessageId,
  updateListedTopicIds,
  updateManagementProgress,
  updateMissingInvitedUsers,
  updatePeerFullInfo,
  updateThread,
  updateThreadInfo,
  updateTopic,
  updateTopics,
  updateUser,
  updateUsers,
} from '../../reducers';
import { updateGroupCall } from '../../reducers/calls';
import { updateTabState } from '../../reducers/tabs';
import {
  selectChat,
  selectChatByUsername,
  selectChatFolder,
  selectChatFullInfo,
  selectChatLastMessageId,
  selectChatListLoadingParameters,
  selectChatListType,
  selectChatMessages,
  selectCurrentChat,
  selectCurrentMessageList,
  selectDraft,
  selectIsChatPinned,
  selectIsChatWithSelf,
  selectIsCurrentUserFrozen,
  selectLastServiceNotification,
  selectPeer,
  selectPeerFullInfo,
  selectSimilarChannelIds,
  selectStickerSet,
  selectSupportChat,
  selectTabState,
  selectThread,
  selectThreadInfo,
  selectTopic,
  selectTopics,
  selectTopicsInfo,
  selectUser,
  selectUserByPhoneNumber,
} from '../../selectors';
import { selectGroupCall } from '../../selectors/calls';
import { selectCurrentLimit } from '../../selectors/limits';

const TOP_CHAT_MESSAGES_PRELOAD_INTERVAL = 100;
const INFINITE_LOOP_MARKER = 100;

const CHATLIST_LIMIT_ERROR_LIST = new Set([
  'FILTERS_TOO_MUCH',
  'CHATLISTS_TOO_MUCH',
  'INVITES_TOO_MUCH',
]);

const runThrottledForLoadTopChats = throttle((cb) => cb(), 3000, true);
const runDebouncedForLoadFullChat = debounce((cb) => cb(), 500, false, true);

addActionHandler('preloadTopChatMessages', async (global, actions): Promise<void> => {
  const preloadedChatIds = new Set<string>();

  for (let i = 0; i < TOP_CHAT_MESSAGES_PRELOAD_LIMIT; i++) {
    await pause(TOP_CHAT_MESSAGES_PRELOAD_INTERVAL);

    global = getGlobal();
    const currentChatIds = Object.values(global.byTabId)

      .map(({ id: tabId }) => selectCurrentMessageList(global, tabId)?.chatId)
      .filter(Boolean);

    const folderAllOrderedIds = getOrderedIds(ALL_FOLDER_ID);
    const nextChatId = folderAllOrderedIds?.find((id) => !currentChatIds.includes(id) && !preloadedChatIds.has(id));
    if (!nextChatId) {
      return;
    }

    preloadedChatIds.add(nextChatId);

    actions.loadViewportMessages({ chatId: nextChatId, threadId: MAIN_THREAD_ID, tabId: getCurrentTabId() });
  }
});

function abortChatRequests(chatId: string, threadId?: ThreadId) {
  callApi('abortChatRequests', { chatId, threadId });
}

function abortChatRequestsForCurrentChat<T extends GlobalState>(
  global: T, newChatId?: string, newThreadId?: ThreadId,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const currentMessageList = selectCurrentMessageList(global, tabId);
  const currentChatId = currentMessageList?.chatId;
  const currentThreadId = currentMessageList?.threadId;

  if (currentChatId && (currentChatId !== newChatId || currentThreadId !== newThreadId)) {
    const [isChatOpened, isThreadOpened] = Object.values(global.byTabId)
      .reduce(([accHasChatOpened, accHasThreadOpened], { id: otherTabId }) => {
        if (otherTabId === tabId || (accHasChatOpened && accHasThreadOpened)) {
          return [accHasChatOpened, accHasThreadOpened];
        }

        const otherMessageList = selectCurrentMessageList(global, otherTabId);
        const isSameChat = otherMessageList?.chatId === currentChatId;
        const isSameThread = isSameChat && otherMessageList?.threadId === currentThreadId;

        return [accHasChatOpened || isSameChat, accHasThreadOpened || isSameThread];
      }, [currentChatId === newChatId, false]);

    const shouldAbortChatRequests = !isChatOpened || !isThreadOpened;

    if (shouldAbortChatRequests) {
      abortChatRequests(currentChatId, isChatOpened ? currentThreadId : undefined);
    }
  }
}

addActionHandler('openChat', (global, actions, payload): ActionReturnType => {
  const {
    id, type, noForumTopicPanel, shouldReplaceHistory, shouldReplaceLast,
    tabId = getCurrentTabId(),
  } = payload;

  actions.processOpenChatOrThread({
    chatId: id,
    type,
    threadId: MAIN_THREAD_ID,
    noForumTopicPanel,
    shouldReplaceHistory,
    shouldReplaceLast,
    tabId,
  });

  abortChatRequestsForCurrentChat(global, id, MAIN_THREAD_ID, tabId);

  if (!id || id === TMP_CHAT_ID) {
    return;
  }

  const chat = selectChat(global, id);

  if (chat?.hasUnreadMark) {
    actions.markChatRead({ id });
  }

  const isChatOnlySummary = !selectChatLastMessageId(global, id);

  if (!chat) {
    if (selectIsChatWithSelf(global, id)) {
      void callApi('fetchChat', { type: 'self' });
    } else {
      const user = selectUser(global, id);
      if (user) {
        void callApi('fetchChat', { type: 'user', user });
      }
    }
  } else if (isChatOnlySummary && !chat.isMin) {
    actions.requestChatUpdate({ chatId: id });
  }
});

addActionHandler('openSavedDialog', (global, actions, payload): ActionReturnType => {
  const { chatId, tabId = getCurrentTabId(), ...otherParams } = payload;

  actions.openThread({
    chatId: global.currentUserId!,
    threadId: chatId,
    tabId,
    ...otherParams,
  });
});

addActionHandler('openThread', async (global, actions, payload): Promise<void> => {
  const {
    type, isComments, noForumTopicPanel, shouldReplaceHistory, shouldReplaceLast,
    focusMessageId,
    tabId = getCurrentTabId(),
  } = payload;
  let { chatId } = payload;
  let threadId: ThreadId | undefined;
  let loadingChatId: string;
  let loadingThreadId: ThreadId;

  if (!isComments) {
    loadingChatId = payload.chatId;
    threadId = payload.threadId;
    loadingThreadId = threadId;

    const originalChat = selectChat(global, loadingChatId);
    if (threadId === MAIN_THREAD_ID) {
      actions.openChat({
        id: chatId,
        type,
        noForumTopicPanel,
        shouldReplaceHistory,
        shouldReplaceLast,
        tabId,
      });
      return;
    } else if (originalChat?.isForum || (chatId && getIsSavedDialog(chatId, threadId, global.currentUserId))) {
      actions.processOpenChatOrThread({
        chatId,
        type,
        threadId,
        isComments,
        noForumTopicPanel,
        shouldReplaceHistory,
        shouldReplaceLast,
        tabId,
      });
      return;
    }
  } else {
    const { originChannelId, originMessageId } = payload;

    loadingChatId = originChannelId;
    loadingThreadId = originMessageId;
  }

  const chat = selectChat(global, loadingChatId);
  const threadInfo = selectThreadInfo(global, loadingChatId, loadingThreadId);
  const thread = selectThread(global, loadingChatId, loadingThreadId);
  if (!chat) return;

  abortChatRequestsForCurrentChat(global, loadingChatId, loadingThreadId, tabId);

  if (chatId
    && threadInfo?.threadId
    && (isComments || (thread?.listedIds?.length && thread.listedIds.includes(Number(threadInfo.threadId))))) {
    global = updateTabState(global, {
      loadingThread: undefined,
    }, tabId);
    setGlobal(global);
    actions.processOpenChatOrThread({
      chatId,
      type,
      threadId: threadInfo.threadId,
      isComments,
      noForumTopicPanel,
      shouldReplaceHistory,
      shouldReplaceLast,
      tabId,
    });
    return;
  }

  let { loadingThread } = selectTabState(global, tabId);
  if (loadingThread) {
    abortChatRequests(loadingThread.loadingChatId, loadingThread.loadingMessageId);
  }

  global = updateTabState(global, {
    loadingThread: {
      loadingChatId,
      loadingMessageId: Number(loadingThreadId),
    },
  }, tabId);
  setGlobal(global);

  const openPreviousChat = () => {
    const currentGlobal = getGlobal();
    if (isComments
      || selectCurrentMessageList(currentGlobal, tabId)?.chatId !== loadingChatId
      || selectCurrentMessageList(currentGlobal, tabId)?.threadId !== loadingThreadId) {
      return;
    }
    actions.openPreviousChat({ tabId });
  };

  if (!isComments) {
    actions.processOpenChatOrThread({
      chatId,
      type,
      threadId: threadId!,
      tabId,
      isComments,
      noForumTopicPanel,
      shouldReplaceHistory,
      shouldReplaceLast,
    });
  }

  const result = selectIsCurrentUserFrozen(global) ? undefined
    : await callApi('fetchDiscussionMessage', {
      chat: selectChat(global, loadingChatId)!,
      messageId: Number(loadingThreadId),
    });

  global = getGlobal();
  loadingThread = selectTabState(global, tabId).loadingThread;
  if (loadingThread?.loadingChatId !== loadingChatId || loadingThread?.loadingMessageId !== loadingThreadId) {
    openPreviousChat();
    return;
  }

  if (!result) {
    global = updateTabState(global, {
      loadingThread: undefined,
    }, tabId);
    setGlobal(global);

    actions.showNotification({
      message: langProvider.oldTranslate(isComments ? 'ChannelPostDeleted' : 'lng_message_not_found'),
      tabId,
    });

    openPreviousChat();
    return;
  }

  threadId ??= result.threadId;
  chatId ??= result.chatId;

  if (!chatId) {
    openPreviousChat();
    return;
  }

  global = getGlobal();
  global = addMessages(global, result.messages);
  if (isComments) {
    global = updateThreadInfo(global, loadingChatId, loadingThreadId, {
      threadId,
    });

    const lastMessageId = threadInfo?.lastMessageId !== undefined ? threadInfo.lastMessageId
      : threadInfo?.messagesCount === 0 ? result.threadId : undefined;

    global = updateThreadInfo(global, chatId, threadId, {
      isCommentsInfo: false,
      threadId,
      chatId,
      fromChannelId: loadingChatId,
      fromMessageId: loadingThreadId,
      lastMessageId,
      ...(threadInfo
        && pick(threadInfo, ['messagesCount', 'lastReadInboxMessageId', 'recentReplierIds'])
      ),
    });
  }
  global = updateThread(global, chatId, threadId, {
    firstMessageId: result.firstMessageId,
  });
  setGlobal(global);

  if (focusMessageId) {
    actions.focusMessage({
      chatId,
      threadId,
      messageId: focusMessageId,
      tabId,
    });
  }

  actions.loadViewportMessages({
    chatId,
    threadId,
    tabId,
    onError: () => {
      global = getGlobal();
      global = updateTabState(global, {
        loadingThread: undefined,
      }, tabId);
      setGlobal(global);

      actions.showNotification({
        message: langProvider.oldTranslate('Group.ErrorAccessDenied'),
        tabId,
      });
    },
    onLoaded: () => {
      global = getGlobal();
      loadingThread = selectTabState(global, tabId).loadingThread;
      if (loadingThread?.loadingChatId !== loadingChatId || loadingThread?.loadingMessageId !== loadingThreadId) {
        return;
      }

      global = updateTabState(global, {
        loadingThread: undefined,
      }, tabId);
      setGlobal(global);

      actions.processOpenChatOrThread({
        chatId,
        type,
        threadId,
        tabId,
        isComments,
        noForumTopicPanel,
        shouldReplaceHistory,
        shouldReplaceLast,
      });
    },
  });
});

addActionHandler('openLinkedChat', async (global, actions, payload): Promise<void> => {
  const { id, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, id);
  if (!chat) {
    return;
  }

  const chatFullInfo = await callApi('fetchFullChat', chat);

  if (chatFullInfo?.fullInfo?.linkedChatId) {
    actions.openChat({ id: chatFullInfo.fullInfo.linkedChatId, tabId });
  }
});

addActionHandler('openSupportChat', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};
  const chat = selectSupportChat(global);
  if (chat) {
    actions.openChat({ id: chat.id, shouldReplaceHistory: true, tabId });
    return;
  }

  actions.openChat({ id: TMP_CHAT_ID, shouldReplaceHistory: true, tabId });

  const result = await callApi('fetchChat', { type: 'support' });
  if (result) {
    actions.openChat({ id: result.chatId, shouldReplaceHistory: true, tabId });
  }
});

addActionHandler('loadAllChats', async (global, actions, payload): Promise<void> => {
  const { whenFirstBatchDone } = payload;
  const listType = payload.listType;
  let isCallbackFired = false;
  let i = 0;

  while (!global.chats.isFullyLoaded[listType]) {
    if (i++ >= INFINITE_LOOP_MARKER) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('`actions/loadAllChats`: Infinite loop detected');
      }

      return;
    }

    global = getGlobal();

    if (global.connectionState !== 'connectionStateReady' || global.authState !== 'authorizationStateReady') {
      return;
    }

    await loadChats(
      listType,
      true,
    );

    if (!isCallbackFired) {
      await whenFirstBatchDone?.();
      isCallbackFired = true;
    }

    global = getGlobal();
  }
});

addActionHandler('loadPinnedDialogs', async (global, actions, payload): Promise<void> => {
  const {
    listType,
  } = payload;

  const result = await callApi('fetchPinnedDialogs', { listType });
  if (!result) return;

  const { dialogIds, messages, chats, users } = result;

  global = getGlobal();
  global = updateChats(global, buildCollectionByKey(chats, 'id'));
  global = updateUsers(global, buildCollectionByKey(users, 'id'));
  global = replaceMessages(global, messages);

  global = {
    ...global,
    chats: {
      ...global.chats,
      orderedPinnedIds: {
        ...global.chats.orderedPinnedIds,
        [listType]: dialogIds.length ? dialogIds : undefined,
      },
    },
  };

  setGlobal(global);
});

addActionHandler('loadFullChat', (global, actions, payload): ActionReturnType => {
  const {
    chatId, force, withPhotos,
  } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const loadChat = async () => {
    await loadFullChat(global, actions, chat);
    if (withPhotos) {
      actions.loadMoreProfilePhotos({ peerId: chatId, shouldInvalidateCache: true });
    }
  };

  if (force) {
    void loadChat();
  } else {
    runDebouncedForLoadFullChat(loadChat);
  }
});

addActionHandler('invalidateFullInfo', (global, actions, payload): ActionReturnType => {
  const { peerId } = payload;

  const isUser = isUserId(peerId);

  if (isUser) {
    return {
      ...global,
      users: {
        ...global.users,
        fullInfoById: omit(global.users.fullInfoById, [peerId]),
      },
    };
  }

  return {
    ...global,
    chats: {
      ...global.chats,
      fullInfoById: omit(global.chats.fullInfoById, [peerId]),
    },
  };
});

addActionHandler('loadTopChats', (): ActionReturnType => {
  runThrottledForLoadTopChats(() => {
    loadChats('active', undefined, true);
    loadChats('archived', undefined, true);
  });
});

addActionHandler('requestChatUpdate', (global, actions, payload): ActionReturnType => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  void callApi('requestChatUpdate', {
    chat,
    ...(chatId === SERVICE_NOTIFICATIONS_USER_ID && {
      lastLocalMessage: selectLastServiceNotification(global)?.message,
    }),
  });
});

addActionHandler('requestSavedDialogUpdate', async (global, actions, payload): Promise<void> => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const result = await callApi('fetchMessages', {
    chat,
    isSavedDialog: true,
    limit: 1,
  });

  if (!result) return;

  global = getGlobal();

  global = addMessages(global, result.messages);

  if (result.messages.length) {
    global = updateChatLastMessageId(global, chatId, result.messages[0].id, 'saved');
    global = addChatListIds(global, 'saved', [chatId]);

    setGlobal(global);
  } else {
    global = removeChatFromChatLists(global, chatId, 'saved');

    setGlobal(global);

    Object.values(global.byTabId).forEach(({ id: tabId }) => {
      const currentMessageList = selectCurrentMessageList(global, tabId);
      if (!currentMessageList) return;
      const { chatId: tabChatId, threadId } = currentMessageList;

      if (selectIsChatWithSelf(global, tabChatId) && threadId === chatId) {
        actions.openChat({ id: undefined, tabId });
      }
    });
  }
});

addActionHandler('updateChatMutedState', (global, actions, payload): ActionReturnType => {
  const { chatId, mutedUntil } = payload;

  if (selectIsCurrentUserFrozen(global)) {
    actions.openFrozenAccountModal({ tabId: getCurrentTabId() });
    return;
  }

  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  void callApi('updateChatNotifySettings', { chat, settings: { mutedUntil } });
});

addActionHandler('updateChatSilentPosting', (global, actions, payload): ActionReturnType => {
  const { chatId, isEnabled } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  void callApi('updateChatNotifySettings', { chat, settings: { isSilentPosting: isEnabled } });
});

addActionHandler('updateTopicMutedState', (global, actions, payload): ActionReturnType => {
  const {
    chatId, topicId, mutedUntil,
  } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  void callApi('updateTopicMutedState', {
    chat, topicId, mutedUntil,
  });
});

addActionHandler('createChannel', async (global, actions, payload): Promise<void> => {
  const {
    title, about, photo, memberIds, discussionChannelId, tabId = getCurrentTabId(),
  } = payload;
  const isChannel = 'isChannel' in payload ? payload.isChannel : undefined;
  const isSuperGroup = 'isSuperGroup' in payload ? payload.isSuperGroup : undefined;

  const users = memberIds?.map((id) => selectUser(global, id))
    .filter(Boolean);

  global = updateTabState(global, {
    chatCreation: {
      progress: ChatCreationProgress.InProgress,
    },
  }, tabId);
  setGlobal(global);

  let createdChannel: ApiChat | undefined;
  let missingInvitedUsers: ApiMissingInvitedUser[] | undefined;
  try {
    const result = await callApi('createChannel', {
      title,
      about,
      users,
      isBroadcast: isChannel,
      isMegagroup: isSuperGroup,
    });
    createdChannel = result?.channel;
    missingInvitedUsers = result?.missingUsers;
  } catch (error) {
    global = getGlobal();

    global = updateTabState(global, {
      chatCreation: {
        progress: ChatCreationProgress.Error,
      },
    }, tabId);

    setGlobal(global);

    if ((error as ApiError).message === 'CHANNELS_TOO_MUCH') {
      actions.openLimitReachedModal({ limit: 'channels', tabId });
    } else {
      actions.showDialog({ data: { ...(error as ApiError), hasErrorKey: true }, tabId });
    }
  }

  if (!createdChannel) {
    return;
  }

  const { id: channelId, accessHash } = createdChannel;

  global = getGlobal();
  global = updateChat(global, channelId, createdChannel);
  global = updateTabState(global, {
    chatCreation: {
      ...selectTabState(global, tabId).chatCreation,
      progress: createdChannel ? ChatCreationProgress.Complete : ChatCreationProgress.Error,
    },
  }, tabId);
  setGlobal(global);
  if (discussionChannelId && channelId) {
    actions.linkDiscussionGroup({
      channelId: discussionChannelId,
      chatId: channelId,
      tabId,
    });
  }
  actions.openChat({ id: channelId, shouldReplaceHistory: true, tabId });

  if (missingInvitedUsers) {
    global = getGlobal();
    global = updateMissingInvitedUsers(global, channelId, missingInvitedUsers, tabId);
    setGlobal(global);
  }

  if (channelId && accessHash && photo) {
    await callApi('editChatPhoto', { chatId: channelId, accessHash, photo });
  }
});

addActionHandler('joinChannel', async (global, actions, payload): Promise<void> => {
  const { chatId, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const { id: channelId, accessHash } = chat;

  if (!(channelId && accessHash)) {
    return;
  }

  try {
    await callApi('joinChannel', { channelId, accessHash });
  } catch (error) {
    if ((error as ApiError).message === 'CHANNELS_TOO_MUCH') {
      actions.openLimitReachedModal({ limit: 'channels', tabId });
    } else {
      actions.showDialog({ data: { ...(error as ApiError), hasErrorKey: true }, tabId });
    }
  }
});

addActionHandler('deleteChatUser', (global, actions, payload): ActionReturnType => {
  const {
    chatId, userId, shouldRevokeHistory, tabId = getCurrentTabId(),
  } = payload;
  const chat = selectChat(global, chatId);
  const user = selectUser(global, userId);
  if (!chat || !user) {
    return;
  }

  global = leaveChat(global, chatId);
  setGlobal(global);

  if (selectCurrentMessageList(global, tabId)?.chatId === chatId) {
    actions.openChat({ id: undefined, tabId });
  }

  void callApi('deleteChatUser', { chat, user, shouldRevokeHistory });
});

addActionHandler('deleteChat', (global, actions, payload): ActionReturnType => {
  const { chatId, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  global = leaveChat(global, chatId);
  setGlobal(global);

  if (selectCurrentMessageList(global, tabId)?.chatId === chatId) {
    actions.openChat({ id: undefined, tabId });
  }

  void callApi('deleteChat', { chatId: chat.id });
});

addActionHandler('leaveChannel', async (global, actions, payload): Promise<void> => {
  const { chatId, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  global = leaveChat(global, chatId);
  setGlobal(global);

  if (selectCurrentMessageList(global, tabId)?.chatId === chatId) {
    actions.openChat({ id: undefined, tabId });
  }

  const { id: channelId, accessHash } = chat;
  if (channelId && accessHash) {
    await callApi('leaveChannel', { channelId, accessHash });
    global = getGlobal();
    const chatMessages = selectChatMessages(global, chatId);
    const localMessageIds = Object.keys(chatMessages).map(Number).filter(isLocalMessageId);
    global = deleteChatMessages(global, chatId, localMessageIds);
    setGlobal(global);
  }
});

addActionHandler('deleteChannel', (global, actions, payload): ActionReturnType => {
  const { chatId, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  global = leaveChat(global, chatId);
  setGlobal(global);

  if (selectCurrentMessageList(global, tabId)?.chatId === chatId) {
    actions.openChat({ id: undefined, tabId });
  }

  const { id: channelId, accessHash } = chat;
  if (channelId && accessHash) {
    void callApi('deleteChannel', { channelId, accessHash });
  }
});

addActionHandler('createGroupChat', async (global, actions, payload): Promise<void> => {
  const {
    title, memberIds, photo, tabId = getCurrentTabId(),
  } = payload;
  const users = (memberIds)
    .map((id) => selectUser(global, id))
    .filter(Boolean);

  global = updateTabState(global, {
    chatCreation: {
      progress: ChatCreationProgress.InProgress,
    },
  }, tabId);
  setGlobal(global);

  try {
    const { chat: createdChat, missingUsers } = await callApi('createGroupChat', {
      title,
      users,
    }) ?? {};

    if (!createdChat) {
      return;
    }

    const { id: chatId } = createdChat;

    global = getGlobal();
    global = updateChat(global, chatId, createdChat);
    global = updateTabState(global, {
      chatCreation: {
        ...selectTabState(global, tabId).chatCreation,
        progress: createdChat ? ChatCreationProgress.Complete : ChatCreationProgress.Error,
      },
    }, tabId);
    setGlobal(global);
    actions.openChat({
      id: chatId,
      shouldReplaceHistory: true,
      tabId,
    });

    if (missingUsers) {
      global = getGlobal();
      global = updateMissingInvitedUsers(global, chatId, missingUsers, tabId);
      setGlobal(global);
    }

    if (chatId && photo) {
      await callApi('editChatPhoto', {
        chatId,
        photo,
      });
    }
  } catch (err) {
    if ((err as ApiError).message === 'USERS_TOO_FEW') {
      global = getGlobal();
      global = updateTabState(global, {
        chatCreation: {
          ...selectTabState(global, tabId).chatCreation,
          progress: ChatCreationProgress.Error,
          error: 'CreateGroupError',
        },
      }, tabId);
      setGlobal(global);
    }
  }
});

addActionHandler('toggleChatPinned', (global, actions, payload): ActionReturnType => {
  const { id, folderId, tabId = getCurrentTabId() } = payload;

  if (selectIsCurrentUserFrozen(global)) {
    actions.openFrozenAccountModal({ tabId });
    return;
  }
  const chat = selectChat(global, id);
  if (!chat) {
    return;
  }

  const limit = selectCurrentLimit(global, 'dialogFolderPinned');

  if (folderId) {
    const folder = selectChatFolder(global, folderId);
    if (folder) {
      const shouldBePinned = !selectIsChatPinned(global, id, folderId);

      const { pinnedChatIds, includedChatIds } = folder;
      const newPinnedIds = shouldBePinned
        ? [id, ...(pinnedChatIds || [])]
        : (pinnedChatIds || []).filter((pinnedId) => pinnedId !== id);

      // With both Pin and Unpin we need to re-add a user to the included group
      const newIncludedChatIds = [id, ...includedChatIds];

      void callApi('editChatFolder', {
        id: folderId,
        folderUpdate: {
          ...folder,
          pinnedChatIds: newPinnedIds,
          includedChatIds: newIncludedChatIds,
        },
      });
    }
  } else {
    const listType = selectChatListType(global, id);
    const isPinned = selectIsChatPinned(global, id, listType === 'archived' ? ARCHIVED_FOLDER_ID : undefined);

    const ids = global.chats.orderedPinnedIds[listType === 'archived' ? 'archived' : 'active'];
    if ((ids?.length || 0) >= limit && !isPinned) {
      actions.openLimitReachedModal({
        limit: 'dialogFolderPinned',
        tabId,
      });
      return;
    }
    void callApi('toggleChatPinned', { chat, shouldBePinned: !isPinned });
  }
});

addActionHandler('toggleChatArchived', (global, actions, payload): ActionReturnType => {
  const { id } = payload;

  if (selectIsCurrentUserFrozen(global)) {
    actions.openFrozenAccountModal({ tabId: getCurrentTabId() });
    return;
  }

  const chat = selectChat(global, id);
  if (chat) {
    void callApi('toggleChatArchived', {
      chat,
      folderId: isChatArchived(chat) ? 0 : ARCHIVED_FOLDER_ID,
    });
  }
});

addActionHandler('toggleSavedDialogPinned', (global, actions, payload): ActionReturnType => {
  const { id, tabId = getCurrentTabId() } = payload;

  if (selectIsCurrentUserFrozen(global)) {
    actions.openFrozenAccountModal({ tabId });
    return;
  }

  const chat = selectChat(global, id);
  if (!chat) {
    return;
  }

  const limit = selectCurrentLimit(global, 'savedDialogsPinned');

  const isPinned = selectIsChatPinned(global, id, SAVED_FOLDER_ID);

  const ids = global.chats.orderedPinnedIds.saved;
  if ((ids?.length || 0) >= limit && !isPinned) {
    actions.openLimitReachedModal({
      limit: 'savedDialogsPinned',
      tabId,
    });
    return;
  }
  void callApi('toggleSavedDialogPinned', { chat, shouldBePinned: !isPinned });
});

addActionHandler('loadChatFolders', async (global): Promise<void> => {
  const chatFolders = await callApi('fetchChatFolders');

  if (chatFolders) {
    global = getGlobal();

    global = {
      ...global,
      chatFolders: {
        ...global.chatFolders,
        ...chatFolders,
      },
    };
    setGlobal(global);
  }
});

addActionHandler('loadRecommendedChatFolders', async (global): Promise<void> => {
  const recommendedChatFolders = await callApi('fetchRecommendedChatFolders');

  if (recommendedChatFolders) {
    global = getGlobal();

    global = {
      ...global,
      chatFolders: {
        ...global.chatFolders,
        recommended: recommendedChatFolders,
      },
    };
    setGlobal(global);
  }
});

addActionHandler('toggleDialogFilterTags', async (global, actions, payload): Promise<void> => {
  const { isEnabled } = payload;

  const result = await callApi('toggleDialogFilterTags', isEnabled);

  if (result) {
    global = getGlobal();
    global = {
      ...global,
      chatFolders: {
        ...global.chatFolders,
        areTagsEnabled: isEnabled,
      },
    };
    setGlobal(global);
  }
});

addActionHandler('editChatFolders', (global, actions, payload): ActionReturnType => {
  const {
    chatId, idsToRemove, idsToAdd, tabId = getCurrentTabId(),
  } = payload;
  const limit = selectCurrentLimit(global, 'dialogFiltersChats');

  const isLimitReached = idsToAdd
    .some((id) => selectChatFolder(global, id).includedChatIds.length >= limit);
  if (isLimitReached) {
    actions.openLimitReachedModal({ limit: 'dialogFiltersChats', tabId });
    return;
  }

  idsToRemove.forEach((id) => {
    const folder = selectChatFolder(global, id);
    if (folder) {
      callApi('editChatFolder', {
        id,
        folderUpdate: {
          ...folder,
          pinnedChatIds: folder.pinnedChatIds?.filter((pinnedId) => pinnedId !== chatId),
          includedChatIds: folder.includedChatIds.filter((includedId) => includedId !== chatId),
        },
      });
    }
  });

  idsToAdd.forEach((id) => {
    const folder = selectChatFolder(global, id);
    if (folder) {
      callApi('editChatFolder', {
        id,
        folderUpdate: {
          ...folder,
          includedChatIds: folder.includedChatIds.concat(chatId),
        },
      });
    }
  });
});

addActionHandler('editChatFolder', (global, actions, payload): ActionReturnType => {
  const { id, folderUpdate } = payload;
  const folder = selectChatFolder(global, id);

  if (folder) {
    void callApi('editChatFolder', {
      id,
      folderUpdate: {
        id,
        emoticon: folder.emoticon,
        pinnedChatIds: folder.pinnedChatIds,
        ...folderUpdate,
      },
    });
  }
});

addActionHandler('addChatFolder', async (global, actions, payload): Promise<void> => {
  const { folder, tabId = getCurrentTabId() } = payload;
  const { orderedIds, byId } = global.chatFolders;

  const limit = selectCurrentLimit(global, 'dialogFilters');
  if (Object.keys(byId).length >= limit) {
    actions.openLimitReachedModal({
      limit: 'dialogFilters',
      tabId,
    });
    return;
  }

  const maxId = Math.max(...(orderedIds || []), ARCHIVED_FOLDER_ID);

  // Clear fields from recommended folders
  const { id: recommendedId, description, ...newFolder } = folder;

  const newId = maxId + 1;
  const folderUpdate = {
    id: newId,
    ...newFolder,
  };
  await callApi('editChatFolder', {
    id: newId,
    folderUpdate,
  });

  // Update called from the above `callApi` is throttled, but we need to apply changes immediately
  actions.apiUpdate({
    '@type': 'updateChatFolder',
    id: newId,
    folder: folderUpdate,
  });

  actions.requestNextFoldersAction({
    foldersAction: {
      type: 'setFolderId',
      payload: maxId + 1,
    },
    tabId,
  });

  if (!description) {
    return;
  }

  global = getGlobal();
  const { recommended } = global.chatFolders;

  if (recommended) {
    global = {
      ...global,
      chatFolders: {
        ...global.chatFolders,
        recommended: recommended.filter(({ id }) => id !== recommendedId),
      },
    };
    setGlobal(global);
  }
});

addActionHandler('sortChatFolders', async (global, actions, payload): Promise<void> => {
  const { folderIds } = payload;

  const result = await callApi('sortChatFolders', folderIds);
  if (result) {
    global = getGlobal();
    global = {
      ...global,
      chatFolders: {
        ...global.chatFolders,
        orderedIds: folderIds,
      },
    };
    setGlobal(global);
  }
});

addActionHandler('deleteChatFolder', async (global, actions, payload): Promise<void> => {
  const { id } = payload;
  const folder = selectChatFolder(global, id);

  if (folder) {
    await callApi('deleteChatFolder', id);
  }
});

addActionHandler('markChatUnread', (global, actions, payload): ActionReturnType => {
  const { id } = payload;

  if (selectIsCurrentUserFrozen(global)) {
    actions.openFrozenAccountModal({ tabId: getCurrentTabId() });
    return;
  }
  const chat = selectChat(global, id);
  if (!chat) return;
  void callApi('toggleDialogUnread', {
    chat,
    hasUnreadMark: !chat.hasUnreadMark,
  });
});

addActionHandler('markChatMessagesRead', async (global, actions, payload): Promise<void> => {
  if (selectIsCurrentUserFrozen(global)) return;
  const { id } = payload;

  if (selectIsCurrentUserFrozen(global)) {
    actions.openFrozenAccountModal({ tabId: getCurrentTabId() });
    return;
  }

  const chat = selectChat(global, id);
  if (!chat) return;
  if (!chat.isForum) {
    await callApi('markMessageListRead', { chat, threadId: MAIN_THREAD_ID });
    actions.readAllMentions({ chatId: id });
    actions.readAllReactions({ chatId: id });
    if (chat.hasUnreadMark) {
      actions.markChatRead({ id });
    }
    return;
  }

  let hasMoreTopics = true;
  let lastTopic: ApiTopic | undefined;
  let processedCount = 0;

  while (hasMoreTopics) {
    const result = await callApi('fetchTopics', {
      chat, offsetDate: lastTopic?.date, offsetTopicId: lastTopic?.id, offsetId: lastTopic?.lastMessageId, limit: 100,
    });

    if (!result?.topics?.length) return;

    result.topics.forEach((topic) => {
      if (!topic.unreadCount && !topic.unreadMentionsCount && !topic.unreadReactionsCount) return;
      actions.markTopicRead({ chatId: id, topicId: topic.id });
    });

    lastTopic = result.topics[result.topics.length - 1];
    processedCount += result.topics.length;
    if (result.count <= processedCount) {
      hasMoreTopics = false;
    }
  }
});

addActionHandler('markChatRead', (global, actions, payload): ActionReturnType => {
  const { id } = payload;
  const chat = selectChat(global, id);
  if (!chat) return;

  callApi('toggleDialogUnread', {
    chat,
    hasUnreadMark: !chat.hasUnreadMark,
  });
});

addActionHandler('markTopicRead', (global, actions, payload): ActionReturnType => {
  if (selectIsCurrentUserFrozen(global)) return;
  const { chatId, topicId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  const topic = selectTopic(global, chatId, topicId);

  const lastTopicMessageId = topic?.lastMessageId;
  if (!lastTopicMessageId) return;

  void callApi('markMessageListRead', {
    chat,
    threadId: topicId,
    maxId: lastTopicMessageId,
  });
  actions.readAllMentions({ chatId, threadId: topicId });
  actions.readAllReactions({ chatId, threadId: topicId });

  global = getGlobal();
  global = updateTopic(global, chatId, topicId, {
    unreadCount: 0,
  });
  global = updateThreadInfo(global, chatId, topicId, {
    lastReadInboxMessageId: lastTopicMessageId,
  });
  setGlobal(global);
});

addActionHandler('checkChatInvite', async (global, actions, payload): Promise<void> => {
  const { hash, tabId = getCurrentTabId() } = payload;

  const result = await callApi('checkChatInvite', hash);
  if (!result) {
    return;
  }

  global = getGlobal();

  if (result.users) {
    global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  }

  if (result.chat) {
    global = addChats(global, buildCollectionByKey([result.chat], 'id'));
    setGlobal(global);
    actions.openChat({ id: result.chat.id, tabId });
    return;
  }

  if (result.invite.subscriptionFormId) {
    global = updateTabState(global, {
      starsPayment: {
        inputInvoice: {
          type: 'chatInviteSubscription',
          hash,
        },
        subscriptionInfo: result.invite,
        status: 'pending',
      },
    }, tabId);
    setGlobal(global);
    return;
  }

  global = updateTabState(global, {
    chatInviteModal: {
      hash,
      inviteInfo: result.invite,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('openChatByPhoneNumber', async (global, actions, payload): Promise<void> => {
  const {
    phoneNumber, startAttach, attach, text, tabId = getCurrentTabId(),
  } = payload;

  // Open temporary empty chat to make the click response feel faster
  actions.openChat({ id: TMP_CHAT_ID, tabId });

  const chat = await fetchChatByPhoneNumber(global, phoneNumber);
  if (!chat) {
    actions.openPreviousChat({ tabId });
    actions.showNotification({
      message: langProvider.oldTranslate('lng_username_by_phone_not_found').replace('{phone}', phoneNumber),
      tabId,
    });
    return;
  }

  if (text) {
    actions.openChatWithDraft({ chatId: chat.id, text: { text }, tabId });
  } else {
    actions.openChat({ id: chat.id, tabId });
  }

  if (attach) {
    global = getGlobal();
    openAttachMenuFromLink(global, actions, chat.id, attach, startAttach, tabId);
  }
});

addActionHandler('openTelegramLink', async (global, actions, payload): Promise<void> => {
  const {
    url,
    shouldIgnoreCache,
    linkContext,
    tabId = getCurrentTabId(),
  } = payload;

  const {
    openChatByPhoneNumber,
    checkChatInvite,
    openStickerSet,
    openChatWithDraft,
    joinVoiceChatByLink,
    openInvoice,
    checkChatlistInvite,
    openChatByUsername: openChatByUsernameAction,
    openStoryViewerByUsername,
    checkGiftCode,
  } = actions;

  if (isDeepLink(url)) {
    const isProcessed = processDeepLink(url, linkContext);
    if (isProcessed || url.match(RE_TG_LINK)) {
      return;
    }
  }

  const uri = new URL(url.toLowerCase().startsWith('http') ? url : `https://${url}`);
  if (TME_WEB_DOMAINS.has(uri.hostname) && uri.pathname === '/') {
    window.open(uri.toString(), '_blank', 'noopener');
    return;
  }

  const hostname = TME_WEB_DOMAINS.has(uri.hostname) ? 't.me' : uri.hostname;
  const hostParts = hostname.split('.');
  if (hostParts.length > 3) return;

  const adaptedPathname = uri.pathname.replace(/^\/?s\//, '');
  const pathname = hostParts.length === 3 ? `${hostParts[0]}/${adaptedPathname}` : adaptedPathname;
  const [part1, part2, part3] = pathname.split('/').filter(Boolean).map((part) => decodeURI(part));
  const params = Object.fromEntries(uri.searchParams);

  let hash: string | undefined;
  if (part1 === 'joinchat') {
    hash = part2;
  }

  const storyId = part2 === 's' && (Number(part3) || undefined);

  if (part1.match(/^\+([0-9]+)(\?|$)/)) {
    openChatByPhoneNumber({
      phoneNumber: part1.substr(1, part1.length - 1),
      startAttach: params.startattach,
      attach: params.attach,
      text: params.text,
      tabId,
    });
    return;
  }

  if (storyId) {
    openStoryViewerByUsername({
      username: part1,
      storyId,
      tabId,
    });

    return;
  }

  if (part1.startsWith(' ') || part1.startsWith('+')) {
    hash = part1.substr(1, part1.length - 1);
  }

  if (hash) {
    checkChatInvite({ hash, tabId });
    return;
  }

  if (part1 === 'addstickers' || part1 === 'addemoji') {
    openStickerSet({
      stickerSetInfo: {
        shortName: part2,
      },
      shouldIgnoreCache,
      tabId,
    });
    return;
  }

  if (part1 === 'share') {
    const text = formatShareText(params.url, params.text);
    openChatWithDraft({ text, tabId });
    return;
  }

  if (part1 === 'addlist') {
    const slug = part2;
    checkChatlistInvite({ slug, tabId });
    return;
  }

  if (part1 === 'giftcode') {
    const slug = part2;
    checkGiftCode({ slug, tabId });
    return;
  }

  const chatOrChannelPostId = part2 || undefined;
  const messageId = part3 ? Number(part3) : undefined;
  const commentId = params.comment ? Number(params.comment) : undefined;

  const isWebApp = await checkWebAppExists(global, part1, part2);

  const shouldTryOpenChat = (part1 && !part2) || Number.isInteger(Number(part2)) || isWebApp;

  if (params.hasOwnProperty('voicechat') || params.hasOwnProperty('livestream')) {
    joinVoiceChatByLink({
      username: part1,
      inviteHash: params.voicechat || params.livestream,
      tabId,
    });
  } else if (part1.startsWith('$')) {
    openInvoice({
      type: 'slug',
      slug: part1.substring(1),
      tabId,
    });
  } else if (part1 === 'invoice') {
    openInvoice({
      type: 'slug',
      slug: part2,
      tabId,
    });
  } else if (shouldTryOpenChat) {
    openChatByUsernameAction({
      username: part1,
      messageId: messageId || Number(chatOrChannelPostId),
      threadId: messageId ? Number(chatOrChannelPostId) : undefined,
      commentId,
      startParam: params.start,
      startAttach: params.startattach,
      attach: params.attach,
      startApp: params.startapp,
      mode: params.mode,
      originalParts: [part1, part2, part3],
      tabId,
    });
  } else {
    actions.openUrl({
      url, shouldSkipModal: true, tabId, ignoreDeepLinks: true,
    });
  }
});

addActionHandler('processBoostParameters', async (global, actions, payload): Promise<void> => {
  const { usernameOrId, isPrivate, tabId = getCurrentTabId() } = payload;

  let chat: ApiChat | undefined;

  if (isPrivate) {
    chat = selectChat(global, usernameOrId);
    if (!chat) {
      actions.showNotification({ message: { key: 'PrivateChannelInaccessible' }, tabId });
      return;
    }
  } else {
    chat = await fetchChatByUsername(global, usernameOrId);
    if (!chat) {
      actions.showNotification({ message: { key: 'NoUsernameFound' }, tabId });
      return;
    }
  }

  if (!isChatChannel(chat) && !isChatSuperGroup(chat)) {
    actions.openChat({ id: chat.id, tabId });
    return;
  }

  actions.openBoostModal({
    chatId: chat.id,
    tabId,
  });
});

addActionHandler('acceptChatInvite', async (global, actions, payload): Promise<void> => {
  const { hash, tabId = getCurrentTabId() } = payload;
  const result = await callApi('importChatInvite', { hash });
  if (!result) {
    return;
  }

  actions.openChat({ id: result.id, tabId });
});

addActionHandler('openChatByUsername', async (global, actions, payload): Promise<void> => {
  const {
    username, messageId, commentId, startParam, startAttach, attach, threadId, originalParts,
    startApp, shouldStartMainApp, mode, isDirect,
    text, onChatChanged, choose, ref, timestamp, linkContext,
    tabId = getCurrentTabId(),
  } = payload;

  const chat = selectCurrentChat(global, tabId);
  const webAppName = originalParts?.[1];
  const isWebApp = webAppName && !Number(webAppName) && !originalParts?.[2];

  if (!commentId) {
    if (startAttach === undefined && messageId && !startParam && !ref
      && chat?.usernames?.some((c) => c.username === username)) {
      actions.focusMessage({
        chatId: chat.id, threadId, messageId, timestamp, tabId,
      });
      return;
    }

    if (startAttach !== undefined && choose) {
      actions.processAttachBotParameters({
        username,
        filter: choose,
        startParam: startAttach || startApp,
        tabId,
      });
      return;
    }

    if ((startApp !== undefined && !webAppName) || shouldStartMainApp) {
      const theme = extractCurrentThemeParams();
      const chatByUsername = await fetchChatByUsername(global, username);
      global = getGlobal();
      const user = chatByUsername && selectUser(global, chatByUsername.id);
      if (!chatByUsername || !user?.hasMainMiniApp) return;
      actions.requestMainWebView({
        botId: chatByUsername.id,
        peerId: chat?.id || chatByUsername.id,
        theme,
        startParam: startApp,
        mode,
        tabId,
      });
      return;
    }
    if (!isWebApp) {
      await openChatByUsername(
        global, actions, {
          username,
          threadId,
          channelPostId: messageId,
          startParam,
          ref,
          startAttach,
          attach,
          text,
          timestamp,
          linkContext,
          isDirect,
        }, tabId,
      );
      if (onChatChanged) {
        // @ts-ignore
        actions[onChatChanged.action](onChatChanged.payload);
      }
      return;
    }
  }

  const usernameChat = selectChatByUsername(global, username);
  if (commentId && messageId && usernameChat) {
    actions.openThread({
      isComments: true,
      originChannelId: usernameChat.id,
      originMessageId: messageId,
      tabId,
      focusMessageId: commentId,
    });
    if (timestamp) {
      actions.openMediaFromTimestamp({
        chatId: usernameChat.id,
        messageId: commentId,
        timestamp,
        tabId,
      });
    }
    return;
  }

  if (!isWebApp) actions.openChat({ id: TMP_CHAT_ID, tabId });

  const chatByUsername = await fetchChatByUsername(global, username);

  if (!chatByUsername) return;

  if (isWebApp && chatByUsername) {
    const theme = extractCurrentThemeParams();

    actions.requestAppWebView({
      appName: webAppName,
      botId: chatByUsername.id,
      tabId,
      startApp,
      mode,
      theme,
    });
    return;
  }

  if (!messageId) return;

  actions.openThread({
    isComments: true,
    originChannelId: chatByUsername.id,
    originMessageId: messageId,
    tabId,
    focusMessageId: commentId,
  });

  if (timestamp) {
    actions.openMediaFromTimestamp({
      chatId: chatByUsername.id,
      messageId: commentId || messageId,
      timestamp,
      tabId,
    });
  }

  if (onChatChanged) {
    // @ts-ignore
    actions[onChatChanged.action](onChatChanged.payload);
  }
});

addActionHandler('openPrivateChannel', (global, actions, payload): ActionReturnType => {
  const {
    id, commentId, messageId, threadId, timestamp, linkContext, tabId = getCurrentTabId(),
  } = payload;
  const chat = selectChat(global, id);
  if (!chat) {
    actions.showNotification({
      message: {
        key: 'PrivateChannelInaccessible',
      },
      tabId,
    });
    return;
  }

  if (!commentId && !messageId && !threadId) {
    actions.openChat({ id, tabId });
    return;
  }

  if (timestamp) {
    actions.openMediaFromTimestamp({
      chatId: id,
      messageId: commentId || messageId!,
      timestamp,
      tabId,
    });
  }

  if (commentId && messageId) {
    actions.openThread({
      isComments: true,
      originChannelId: id,
      originMessageId: messageId,
      tabId,
      focusMessageId: commentId,
    });
    return;
  }

  openChatWithParams(global, actions, chat, {
    messageId,
    threadId,
    timestamp,
    linkContext,
  }, tabId);
});

addActionHandler('togglePreHistoryHidden', async (global, actions, payload): Promise<void> => {
  const {
    chatId, isEnabled,
    tabId = getCurrentTabId(),
  } = payload;

  const chat = await ensureIsSuperGroup(global, actions, chatId, tabId);
  if (!chat) {
    return;
  }

  global = getGlobal();
  global = updateChatFullInfo(global, chat.id, { isPreHistoryHidden: isEnabled });
  setGlobal(global);

  void callApi('togglePreHistoryHidden', { chat, isEnabled });
});

addActionHandler('updateChatDefaultBannedRights', (global, actions, payload): ActionReturnType => {
  const { chatId, bannedRights } = payload;
  const chat = selectChat(global, chatId);

  if (!chat) {
    return;
  }

  void callApi('updateChatDefaultBannedRights', { chat, bannedRights });
});

addActionHandler('updateChatMemberBannedRights', async (global, actions, payload): Promise<void> => {
  const {
    chatId, userId, bannedRights,
    tabId = getCurrentTabId(),
  } = payload;

  const user = selectUser(global, userId);

  if (!user) {
    return;
  }

  const chat = await ensureIsSuperGroup(global, actions, chatId, tabId);

  if (!chat) return;

  const result = await callApi('updateChatMemberBannedRights', { chat, user, bannedRights });

  if (!result) {
    return;
  }

  global = getGlobal();

  const updatedFullInfo = selectChatFullInfo(global, chat.id);
  if (!updatedFullInfo) {
    return;
  }

  const { members, kickedMembers } = updatedFullInfo;

  const isBanned = Boolean(bannedRights.viewMessages);
  const isUnblocked = !Object.keys(bannedRights).length;

  global = updateChatFullInfo(global, chat.id, {
    ...(members && isBanned && {
      members: members.filter((m) => m.userId !== userId),
    }),
    ...(members && !isBanned && {
      members: members.map((m) => (
        m.userId === userId
          ? { ...m, bannedRights }
          : m
      )),
    }),
    ...(isUnblocked && kickedMembers && {
      kickedMembers: kickedMembers.filter((m) => m.userId !== userId),
    }),
  });
  if (isBanned) {
    global = updateChat(global, chat.id, { membersCount: Math.max(0, (chat.membersCount || 0) - 1) });
  }

  setGlobal(global);
});

addActionHandler('updateChatAdmin', async (global, actions, payload): Promise<void> => {
  if (selectIsCurrentUserFrozen(global)) return;

  const {
    chatId, userId, adminRights, customTitle,
    tabId = getCurrentTabId(),
  } = payload;

  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  const chat = await ensureIsSuperGroup(global, actions, chatId, tabId);

  if (!chat) return;

  await callApi('updateChatAdmin', {
    chat, user, adminRights, customTitle,
  });

  const chatAfterUpdate = await callApi('fetchFullChat', chat);
  if (!chatAfterUpdate?.fullInfo) {
    return;
  }

  const { adminMembersById } = chatAfterUpdate.fullInfo;
  const isDismissed = !Object.keys(adminRights).length;
  let newAdminMembersById: Record<string, ApiChatMember> | undefined;
  if (adminMembersById) {
    if (isDismissed) {
      const { [userId]: remove, ...rest } = adminMembersById;
      newAdminMembersById = rest;
    } else {
      newAdminMembersById = {
        ...adminMembersById,
        [userId]: {
          ...adminMembersById[userId],
          adminRights,
          customTitle,
        },
      };
    }
  }

  if (newAdminMembersById) {
    global = getGlobal();
    global = updateChatFullInfo(global, chat.id, { adminMembersById: newAdminMembersById });
    setGlobal(global);
  }
});

addActionHandler('updateChat', async (global, actions, payload): Promise<void> => {
  const {
    chatId, title, about, photo, tabId = getCurrentTabId(),
  } = payload;

  const chat = selectChat(global, chatId);
  const fullInfo = selectChatFullInfo(global, chatId);
  if (!chat) {
    return;
  }

  global = getGlobal();
  global = updateManagementProgress(global, ManagementProgress.InProgress, tabId);
  setGlobal(global);

  await Promise.all([
    chat.title !== title
      ? callApi('updateChatTitle', chat, title)
      : undefined,
    fullInfo?.about !== about
      ? callApi('updateChatAbout', chat, about)
      : undefined,
    photo
      ? callApi('editChatPhoto', { chatId, accessHash: chat.accessHash, photo })
      : undefined,
  ]);

  global = getGlobal();
  global = updateManagementProgress(global, ManagementProgress.Complete, tabId);
  setGlobal(global);

  if (photo) {
    actions.loadFullChat({ chatId, withPhotos: true });
  }
});

addActionHandler('updateChatPhoto', async (global, actions, payload): Promise<void> => {
  const { photo, chatId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  await callApi('editChatPhoto', {
    chatId,
    accessHash: chat.accessHash,
    photo,
  });
  actions.loadFullChat({ chatId, withPhotos: true });
});

addActionHandler('deleteChatPhoto', async (global, actions, payload): Promise<void> => {
  const { photo, chatId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  let isDeleted;
  if (photo.id === chat.avatarPhotoId) {
    isDeleted = await callApi('editChatPhoto', {
      chatId,
      accessHash: chat.accessHash,
    });
  } else {
    isDeleted = await callApi('deleteProfilePhotos', [photo]);
  }
  if (!isDeleted) return;

  global = getGlobal();
  global = deletePeerPhoto(global, chatId, photo.id);
  setGlobal(global);

  actions.loadFullChat({ chatId, withPhotos: true });
});

addActionHandler('toggleSignatures', (global, actions, payload): ActionReturnType => {
  const { chatId, areProfilesEnabled, areSignaturesEnabled } = payload;
  const chat = selectChat(global, chatId);

  if (!chat) {
    return;
  }

  void callApi('toggleSignatures', { chat, areProfilesEnabled, areSignaturesEnabled });
});

addActionHandler('loadGroupsForDiscussion', async (global): Promise<void> => {
  const groups = await callApi('fetchGroupsForDiscussion');
  if (!groups) {
    return;
  }

  const addedById = groups.reduce((result, group) => {
    if (group && !group.isForum) {
      result[group.id] = group;
    }

    return result;
  }, {} as Record<string, ApiChat>);

  global = getGlobal();
  global = {
    ...global,
    chats: {
      ...global.chats,
      forDiscussionIds: Object.keys(addedById),
    },
  };
  setGlobal(global);
});

addActionHandler('linkDiscussionGroup', async (global, actions, payload): Promise<void> => {
  if (selectIsCurrentUserFrozen(global)) return;
  const { channelId, chatId, tabId = getCurrentTabId() } = payload || {};

  const channel = selectChat(global, channelId);
  if (!channel) {
    return;
  }

  const chat = await ensureIsSuperGroup(global, actions, chatId, tabId);

  if (!chat) return;

  let fullInfo = selectChatFullInfo(global, chat.id);
  if (!fullInfo) {
    const fullChat = await callApi('fetchFullChat', chat);
    if (!fullChat) {
      return;
    }

    fullInfo = fullChat.fullInfo;
  }

  if (fullInfo.isPreHistoryHidden) {
    global = getGlobal();
    global = updateChatFullInfo(global, chat.id, { isPreHistoryHidden: false });
    setGlobal(global);

    await callApi('togglePreHistoryHidden', { chat, isEnabled: false });
  }

  void callApi('setDiscussionGroup', { channel, chat });
});

addActionHandler('unlinkDiscussionGroup', async (global, actions, payload): Promise<void> => {
  const { channelId } = payload;

  const channel = selectChat(global, channelId);
  if (!channel) {
    return;
  }

  const fullInfo = selectChatFullInfo(global, channelId);
  let chat: ApiChat | undefined;
  if (fullInfo?.linkedChatId) {
    chat = selectChat(global, fullInfo.linkedChatId);
  }

  await callApi('setDiscussionGroup', { channel });
  if (chat) {
    global = getGlobal();
    loadFullChat(global, actions, chat);
  }
});

addActionHandler('setActiveChatFolder', (global, actions, payload): ActionReturnType => {
  const { activeChatFolder, tabId = getCurrentTabId() } = payload;
  const maxFolders = selectCurrentLimit(global, 'dialogFilters');

  const isBlocked = activeChatFolder + 1 > maxFolders;

  if (isBlocked) {
    actions.openLimitReachedModal({
      limit: 'dialogFilters',
      tabId,
    });
    return undefined;
  }

  return updateTabState(global, {
    activeChatFolder,
  }, tabId);
});

addActionHandler('resetOpenChatWithDraft', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    requestedDraft: undefined,
  }, tabId);
});

addActionHandler('loadMoreMembers', async (global, actions, payload): Promise<void> => {
  const { chatId } = payload || {};

  if (selectIsCurrentUserFrozen(global)) return;
  const chat = selectChat(global, chatId);
  if (!chat || isChatBasicGroup(chat) || isChatMonoforum(chat)) {
    return;
  }

  const offset = selectChatFullInfo(global, chat.id)?.members?.length;
  if (offset !== undefined && chat.membersCount !== undefined && offset >= chat.membersCount) return;

  const result = await callApi('fetchMembers', { chat, offset });
  if (!result) {
    return;
  }

  const { members, userStatusesById } = result;
  if (!members || !members.length) {
    return;
  }

  global = getGlobal();
  global = addUserStatuses(global, userStatusesById);
  global = addChatMembers(global, chat, members);
  setGlobal(global);
});

addActionHandler('addChatMembers', async (global, actions, payload): Promise<void> => {
  const { chatId, memberIds, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, chatId);
  const users = memberIds.map((userId) => selectUser(global, userId)).filter(Boolean);

  if (!chat || !users.length) {
    return;
  }

  actions.setNewChatMembersDialogState({ newChatMembersProgress: NewChatMembersProgress.Loading, tabId });
  const missingUsers = await callApi('addChatMembers', chat, users);
  if (missingUsers) {
    global = getGlobal();
    global = updateMissingInvitedUsers(global, chatId, missingUsers, tabId);
    setGlobal(global);
  }
  actions.setNewChatMembersDialogState({ newChatMembersProgress: NewChatMembersProgress.Closed, tabId });
  global = getGlobal();
  loadFullChat(global, actions, chat);
});

addActionHandler('deleteChatMember', async (global, actions, payload): Promise<void> => {
  const { chatId, userId, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, chatId);
  const user = selectUser(global, userId);

  if (!chat || !user) {
    return;
  }

  if (isChatSuperGroup(chat) || isChatChannel(chat)) {
    actions.updateChatMemberBannedRights({
      chatId,
      userId,
      bannedRights: {
        viewMessages: true,
        sendMessages: true,
        sendMedia: true,
        sendStickers: true,
        sendGifs: true,
        sendGames: true,
        sendInline: true,
        embedLinks: true,
        sendPolls: true,
        changeInfo: true,
        inviteUsers: true,
        pinMessages: true,
        manageTopics: true,
        sendPhotos: true,
        sendVideos: true,
        sendRoundvideos: true,
        sendAudios: true,
        sendVoices: true,
        sendDocs: true,
        sendPlain: true,
      },
      tabId,
    });
    return;
  }

  await callApi('deleteChatMember', chat, user);
  global = getGlobal();
  loadFullChat(global, actions, chat);
});

addActionHandler('toggleIsProtected', (global, actions, payload): ActionReturnType => {
  const { chatId, isProtected } = payload;
  const chat = selectChat(global, chatId);

  if (!chat) {
    return;
  }

  void callApi('toggleIsProtected', { chat, isProtected });
});

addActionHandler('setChatEnabledReactions', async (global, actions, payload): Promise<void> => {
  const {
    chatId, enabledReactions, reactionsLimit,
  } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  await callApi('setChatEnabledReactions', {
    chat,
    enabledReactions,
    reactionsLimit,
  });

  global = getGlobal();
  void loadFullChat(global, actions, chat);
});

addActionHandler('fetchChat', (global, actions, payload): ActionReturnType => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);

  if (chat) {
    return;
  }

  if (selectIsChatWithSelf(global, chatId)) {
    void callApi('fetchChat', { type: 'self' });
  } else {
    const user = selectUser(global, chatId);
    if (user) {
      void callApi('fetchChat', { type: 'user', user });
    }
  }
});

addActionHandler('toggleJoinToSend', async (global, actions, payload): Promise<void> => {
  const { chatId, isEnabled } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;
  if (!isChatSuperGroup(chat) && !isChatChannel(chat)) return;

  await callApi('toggleJoinToSend', chat, isEnabled);
});

addActionHandler('toggleJoinRequest', async (global, actions, payload): Promise<void> => {
  const { chatId, isEnabled } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;
  if (!isChatSuperGroup(chat) && !isChatChannel(chat)) return;

  await callApi('toggleJoinRequest', chat, isEnabled);
});

addActionHandler('openForumPanel', (global, actions, payload): ActionReturnType => {
  const { chatId, tabId = getCurrentTabId() } = payload;
  actions.toggleStoryRibbon({ isShown: false, tabId });
  actions.toggleStoryRibbon({ isShown: false, isArchived: true, tabId });
  return updateTabState(global, {
    forumPanelChatId: chatId,
  }, tabId);
});

addActionHandler('closeForumPanel', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    forumPanelChatId: undefined,
  }, tabId);
});

addActionHandler('processAttachBotParameters', async (global, actions, payload): Promise<void> => {
  const {
    username, filter, startParam, tabId = getCurrentTabId(),
  } = payload;
  const bot = await getAttachBotOrNotify(global, actions, username, tabId);
  if (!bot) return;

  const isForChat = Boolean(filter);

  if (!isForChat) {
    actions.callAttachBot({
      isFromSideMenu: true,
      bot,
      startParam,
      tabId,
    });
    return;
  }

  global = getGlobal();
  const { attachMenu: { bots } } = global;
  if (!bots[bot.id]) {
    global = updateTabState(global, {
      requestedAttachBotInstall: {
        bot,
        onConfirm: {
          action: 'requestAttachBotInChat',
          payload: {
            bot,
            filter,
            startParam,
          },
        },
      },
    }, tabId);
    setGlobal(global);
    return;
  }
  actions.requestAttachBotInChat({
    bot,
    filter,
    startParam,
    tabId,
  });
});

addActionHandler('loadTopics', async (global, actions, payload): Promise<void> => {
  if (selectIsCurrentUserFrozen(global)) return;
  const { chatId, force } = payload;
  if (selectIsCurrentUserFrozen(global)) {
    return;
  }
  const chat = selectChat(global, chatId);
  if (!chat) return;

  const topicsInfo = selectTopicsInfo(global, chatId);

  if (!force && topicsInfo?.listedTopicIds && topicsInfo.listedTopicIds.length === topicsInfo.totalCount) {
    return;
  }

  const offsetTopic = !force ? topicsInfo?.listedTopicIds?.reduce((acc, el) => {
    const topic = selectTopic(global, chatId, el);
    const accTopic = selectTopic(global, chatId, acc);
    if (!topic) return acc;
    if (!accTopic || topic.lastMessageId < accTopic.lastMessageId) {
      return el;
    }
    return acc;
  }) : undefined;

  const { id: offsetTopicId, date: offsetDate, lastMessageId: offsetId } = (offsetTopic
    && selectTopic(global, chatId, offsetTopic)) || {};
  const result = await callApi('fetchTopics', {
    chat, offsetTopicId, offsetId, offsetDate, limit: offsetTopicId ? TOPICS_SLICE : TOPICS_SLICE_SECOND_LOAD,
  });

  if (!result) return;

  global = getGlobal();
  global = addMessages(global, result.messages);
  global = updateTopics(global, chatId, result.count, result.topics);
  global = updateListedTopicIds(global, chatId, result.topics.map((topic) => topic.id));
  Object.entries(result.draftsById || {}).forEach(([threadId, draft]) => {
    global = replaceThreadParam(global, chatId, Number(threadId), 'draft', draft);
  });
  Object.entries(result.readInboxMessageIdByTopicId || {}).forEach(([topicId, messageId]) => {
    global = updateThreadInfo(global, chatId, Number(topicId), { lastReadInboxMessageId: messageId });
  });

  setGlobal(global);
});

addActionHandler('loadTopicById', async (global, actions, payload): Promise<void> => {
  const { chatId, topicId } = payload;

  const chat = selectChat(global, chatId);
  if (!chat) return;

  const result = await callApi('fetchTopicById', { chat, topicId });

  if (!result) {
    if ('tabId' in payload && payload.shouldCloseChatOnError) {
      const { tabId = getCurrentTabId() } = payload;
      actions.openChat({ id: undefined, tabId });
    }
    return;
  }

  global = getGlobal();
  global = addMessages(global, result.messages);
  global = updateTopic(global, chatId, topicId, result.topic);

  setGlobal(global);
});

addActionHandler('toggleForum', async (global, actions, payload): Promise<void> => {
  const { chatId, isEnabled, tabId = getCurrentTabId() } = payload;

  const chat = await ensureIsSuperGroup(global, actions, chatId, tabId);
  if (!chat) {
    return;
  }

  let result: true | undefined;
  try {
    result = await callApi('toggleForum', { chat, isEnabled });
  } catch (error) {
    if ((error as ApiError).message === 'FLOOD') {
      actions.showNotification({ message: langProvider.oldTranslate('FloodWait'), tabId });
    } else {
      actions.showDialog({ data: { ...(error as ApiError), hasErrorKey: true }, tabId });
    }
  }

  if (result) {
    global = getGlobal();
    global = updateChat(global, chat.id, { isForum: isEnabled });
    setGlobal(global);

    if (!isEnabled) {
      actions.closeForumPanel({ tabId });
    } else {
      actions.openForumPanel({ chatId: chat.id, tabId });
    }
  }
});

addActionHandler('toggleParticipantsHidden', async (global, actions, payload): Promise<void> => {
  const { chatId, isEnabled } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const prevIsEnabled = selectChatFullInfo(global, chat.id)?.areParticipantsHidden;
  global = updateChatFullInfo(global, chatId, { areParticipantsHidden: isEnabled });
  setGlobal(global);

  const result = await callApi('toggleParticipantsHidden', { chat, isEnabled });

  if (!result && prevIsEnabled !== undefined) {
    global = getGlobal();
    global = updateChatFullInfo(global, chatId, { areParticipantsHidden: prevIsEnabled });
    setGlobal(global);
  }
});

addActionHandler('createTopic', async (global, actions, payload): Promise<void> => {
  const {
    chatId, title, iconColor, iconEmojiId,
    tabId = getCurrentTabId(),
  } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  if (selectTabState(global, tabId).createTopicPanel) {
    global = updateTabState(global, {
      createTopicPanel: {
        chatId,
        isLoading: true,
      },
    }, tabId);
    setGlobal(global);
  }

  const topicId = await callApi('createTopic', {
    chat, title, iconColor, iconEmojiId,
  });
  if (topicId) {
    actions.openThread({
      chatId, threadId: topicId, shouldReplaceHistory: true, tabId,
    });
  }
  actions.closeCreateTopicPanel({ tabId });
});

addActionHandler('deleteTopic', async (global, actions, payload): Promise<void> => {
  const { chatId, topicId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  await callApi('deleteTopic', { chat, topicId });

  global = getGlobal();
  global = deleteTopic(global, chatId, topicId);
  setGlobal(global);
});

addActionHandler('editTopic', async (global, actions, payload): Promise<void> => {
  const {
    chatId, topicId, tabId = getCurrentTabId(), ...rest
  } = payload;
  const chat = selectChat(global, chatId);
  const topic = selectTopic(global, chatId, topicId);
  if (!chat || !topic) return;

  if (selectTabState(global, tabId).editTopicPanel) {
    global = updateTabState(global, {
      editTopicPanel: {
        chatId,
        topicId,
        isLoading: true,
      },
    }, tabId);
    setGlobal(global);
  }

  const result = await callApi('editTopic', { chat, topicId, ...rest });
  if (!result) return;

  global = getGlobal();
  global = updateTopic(global, chatId, topicId, rest);
  setGlobal(global);

  actions.closeEditTopicPanel({ tabId });
});

addActionHandler('toggleTopicPinned', (global, actions, payload): ActionReturnType => {
  const {
    chatId, topicId, isPinned, tabId = getCurrentTabId(),
  } = payload;

  const { topicsPinnedLimit } = global.appConfig;
  const chat = selectChat(global, chatId);
  const topics = selectTopics(global, chatId);
  if (!chat || !topics || !topicsPinnedLimit) return;

  if (isPinned && Object.values(topics).filter((topic) => topic.isPinned).length >= topicsPinnedLimit) {
    actions.showNotification({
      message: langProvider.oldTranslate('LimitReachedPinnedTopics', topicsPinnedLimit, 'i'),
      tabId,
    });
    return;
  }

  void callApi('togglePinnedTopic', { chat, topicId, isPinned });
});

addActionHandler('checkChatlistInvite', async (global, actions, payload): Promise<void> => {
  const { slug, tabId = getCurrentTabId() } = payload;

  const result = await callApi('checkChatlistInvite', { slug });
  if (!result) {
    actions.showNotification({
      message: langProvider.oldTranslate('lng_group_invite_bad_link'),
      tabId,
    });
    return;
  }

  global = getGlobal();

  global = updateTabState(global, {
    chatlistModal: {
      invite: result.invite,
    },
  }, tabId);

  setGlobal(global);
});

addActionHandler('joinChatlistInvite', async (global, actions, payload): Promise<void> => {
  const { invite, peerIds, tabId = getCurrentTabId() } = payload;

  const peers = peerIds.map((peerId) => selectChat(global, peerId)).filter(Boolean);
  const currentNotJoinedCount = peers.filter((peer) => peer.isNotJoined).length;

  const existingFolder = 'folderId' in invite ? selectChatFolder(global, invite.folderId) : undefined;
  const folderTitle = ('title' in invite ? invite.title : existingFolder?.title)!;

  try {
    const result = await callApi('joinChatlistInvite', { slug: invite.slug, peers });
    if (!result) return;

    if (existingFolder) {
      actions.showNotification({
        title: {
          key: 'FolderLinkNotificationUpdatedTitle',
          variables: {
            title: folderTitle.text,
          },
        },
        message: {
          key: 'FolderLinkNotificationUpdatedSubtitle',
          variables: {
            count: currentNotJoinedCount,
          },
          options: {
            pluralValue: currentNotJoinedCount,
          },
        },
        tabId,
      });

      return;
    }

    actions.showNotification({
      title: {
        key: 'FolderLinkNotificationAddedTitle',
        variables: {
          title: folderTitle.text,
        },
      },
      message: {
        key: 'FolderLinkNotificationAddedSubtitle',
        variables: {
          count: currentNotJoinedCount,
        },
        options: {
          pluralValue: currentNotJoinedCount,
        },
      },
      tabId,
    });
  } catch (error) {
    if ((error as ApiError).message === 'CHATLISTS_TOO_MUCH') {
      actions.openLimitReachedModal({ limit: 'chatlistJoined', tabId });
    } else {
      actions.showDialog({ data: { ...(error as ApiError), hasErrorKey: true }, tabId });
    }
  }
});

addActionHandler('leaveChatlist', async (global, actions, payload): Promise<void> => {
  const { folderId, peerIds, tabId = getCurrentTabId() } = payload;

  const folder = selectChatFolder(global, folderId);

  const peers = peerIds?.map((peerId) => selectChat(global, peerId)).filter(Boolean) || [];

  const result = await callApi('leaveChatlist', { folderId, peers });

  if (!result) return;
  if (!folder) return;

  actions.showNotification({
    title: {
      key: 'FolderLinkNotificationDeletedTitle',
      variables: {
        title: folder.title.text,
      },
    },
    message: {
      key: 'FolderLinkNotificationDeletedSubtitle',
      variables: {
        count: peers.length,
      },
      options: {
        pluralValue: peers.length,
      },
    },
    tabId,
  });
});

addActionHandler('loadChatlistInvites', async (global, actions, payload): Promise<void> => {
  const { folderId } = payload;

  const result = await callApi('fetchChatlistInvites', { folderId });

  if (!result) return;

  global = getGlobal();

  global = {
    ...global,
    chatFolders: {
      ...global.chatFolders,
      invites: {
        ...global.chatFolders.invites,
        [folderId]: result.invites,
      },
    },
  };
  setGlobal(global);
});

addActionHandler('createChatlistInvite', async (global, actions, payload): Promise<void> => {
  const { folderId, tabId = getCurrentTabId() } = payload;

  const folder = selectChatFolder(global, folderId);
  if (!folder) return;

  global = updateTabState(global, {
    shareFolderScreen: {
      ...selectTabState(global, tabId).shareFolderScreen!,
      isLoading: true,
    },
  }, tabId);
  setGlobal(global);

  let result: { filter: ApiChatFolder; invite: ApiChatlistExportedInvite | undefined } | undefined;

  try {
    result = await callApi('createChalistInvite', {
      folderId,
      peers: folder.includedChatIds.concat(folder.pinnedChatIds || [])
        .map((chatId) => selectChat(global, chatId) || selectUser(global, chatId)).filter(Boolean),
    });
  } catch (error) {
    if (CHATLIST_LIMIT_ERROR_LIST.has((error as ApiError).message)) {
      actions.openLimitReachedModal({ limit: 'chatlistInvites', tabId });
      actions.openSettingsScreen({ screen: SettingsScreens.Folders, tabId });
    } else {
      actions.showDialog({ data: { ...(error as ApiError), hasErrorKey: true }, tabId });
    }
  }

  if (!result || !result.invite) return;

  const { shareFolderScreen } = selectTabState(global, tabId);

  if (!shareFolderScreen) return;

  global = getGlobal();
  global = {
    ...global,
    chatFolders: {
      ...global.chatFolders,
      byId: {
        ...global.chatFolders.byId,
        [folderId]: {
          ...global.chatFolders.byId[folderId],
          ...result.filter,
        },
      },
      invites: {
        ...global.chatFolders.invites,
        [folderId]: [
          ...(global.chatFolders.invites[folderId] || []),
          result.invite,
        ],
      },
    },
  };
  global = updateTabState(global, {
    shareFolderScreen: {
      ...shareFolderScreen,
      url: result.invite.url,
      isLoading: false,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('editChatlistInvite', async (global, actions, payload): Promise<void> => {
  const {
    folderId, peerIds, url, tabId = getCurrentTabId(),
  } = payload;

  const slug = url.split('/').pop();
  if (!slug) return;

  const peers = peerIds
    .map((chatId) => selectChat(global, chatId) || selectUser(global, chatId)).filter(Boolean);

  global = updateTabState(global, {
    shareFolderScreen: {
      ...selectTabState(global, tabId).shareFolderScreen!,
      isLoading: true,
    },
  }, tabId);
  setGlobal(global);

  try {
    const result = await callApi('editChatlistInvite', { folderId, slug, peers });

    if (!result) {
      return;
    }

    global = getGlobal();
    global = {
      ...global,
      chatFolders: {
        ...global.chatFolders,
        invites: {
          ...global.chatFolders.invites,
          [folderId]: global.chatFolders.invites[folderId]?.map((invite) => {
            if (invite.url === url) {
              return result;
            }
            return invite;
          }),
        },
      },
    };
    setGlobal(global);
  } catch (error) {
    actions.showDialog({ data: { ...(error as ApiError), hasErrorKey: true }, tabId });
  } finally {
    global = getGlobal();

    global = updateTabState(global, {
      shareFolderScreen: {
        ...selectTabState(global, tabId).shareFolderScreen!,
        isLoading: false,
      },
    }, tabId);
    setGlobal(global);
  }
});

addActionHandler('deleteChatlistInvite', async (global, actions, payload): Promise<void> => {
  const { folderId, url } = payload;

  const slug = url.split('/').pop();

  if (!slug) return;

  const result = await callApi('deleteChatlistInvite', { folderId, slug });

  if (!result) return;

  global = getGlobal();
  global = {
    ...global,
    chatFolders: {
      ...global.chatFolders,
      invites: {
        ...global.chatFolders.invites,
        [folderId]: global.chatFolders.invites[folderId]?.filter((invite) => invite.url !== url),
      },
    },
  };
  setGlobal(global);
});

addActionHandler('openDeleteChatFolderModal', async (global, actions, payload): Promise<void> => {
  const { folderId, isConfirmedForChatlist, tabId = getCurrentTabId() } = payload;
  const folder = selectChatFolder(global, folderId);
  if (!folder) return;

  if (folder.isChatList && (!folder.hasMyInvites || isConfirmedForChatlist)) {
    const currentIds = getOrderedIds(folderId);
    const suggestions = await callApi('fetchLeaveChatlistSuggestions', { folderId });
    global = getGlobal();
    global = updateTabState(global, {
      chatlistModal: {
        removal: {
          folderId,
          suggestedPeerIds: unique([...(suggestions || []), ...(currentIds || [])]),
        },
      },
    }, tabId);
    setGlobal(global);
    return;
  }

  global = updateTabState(global, {
    deleteFolderDialogModal: folderId,
  }, tabId);

  setGlobal(global);
});

addActionHandler('updateChatDetectedLanguage', (global, actions, payload): ActionReturnType => {
  const { chatId, detectedLanguage } = payload;

  global = getGlobal();
  global = updateChat(global, chatId, {
    detectedLanguage,
  }, undefined, true);

  return global;
});

addActionHandler('togglePeerTranslations', async (global, actions, payload): Promise<void> => {
  const { chatId, isEnabled } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  const result = await callApi('togglePeerTranslations', { chat, isEnabled });

  if (result === undefined) return;

  global = getGlobal();
  global = updatePeerFullInfo(global, chatId, {
    isTranslationDisabled: isEnabled ? undefined : true,
  });
  setGlobal(global);
});

addActionHandler('setViewForumAsMessages', (global, actions, payload): ActionReturnType => {
  const { chatId, isEnabled } = payload;

  const chat = selectChat(global, chatId);
  if (!chat?.isForum || chat.isForumAsMessages === isEnabled) {
    return;
  }

  global = updateChat(global, chatId, { isForumAsMessages: isEnabled || undefined });
  setGlobal(global);

  void callApi('setViewForumAsMessages', { chat, isEnabled });
});

addActionHandler('loadChannelRecommendations', async (global, actions, payload): Promise<void> => {
  if (selectIsCurrentUserFrozen(global)) return;

  const { chatId } = payload;
  const chat = chatId ? selectChat(global, chatId) : undefined;

  if (chatId && !chat) {
    return;
  }

  if (!chatId) {
    const similarChannelIds = selectSimilarChannelIds(global, GLOBAL_SUGGESTED_CHANNELS_ID);
    if (similarChannelIds) return; // Already cached
  }

  const result = await callApi('fetchChannelRecommendations', {
    chat,
  });

  if (!result) {
    return;
  }

  const { similarChannels, count } = result;

  const chatsById = buildCollectionByKey(similarChannels, 'id');

  global = getGlobal();
  global = replaceSimilarChannels(global, chatId || GLOBAL_SUGGESTED_CHANNELS_ID, Object.keys(chatsById), count);
  setGlobal(global);
});

addActionHandler('loadBotRecommendations', async (global, actions, payload): Promise<void> => {
  if (selectIsCurrentUserFrozen(global)) return;

  const { userId } = payload;
  const user = selectChat(global, userId);

  if (!user) {
    return;
  }

  const result = await callApi('fetchBotsRecommendations', {
    user,
  });

  if (!result) {
    return;
  }

  const { similarBots, count } = result;

  const users = buildCollectionByKey(similarBots, 'id');

  global = getGlobal();
  global = addUsers(global, users);
  global = addSimilarBots(global, userId, Object.keys(users), count);
  setGlobal(global);
});

addActionHandler('toggleChannelRecommendations', (global, actions, payload): ActionReturnType => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);

  if (!chat) {
    return;
  }

  global = toggleSimilarChannels(global, chatId);
  setGlobal(global);
});

addActionHandler('updatePaidMessagesPrice', async (global, actions, payload): Promise<void> => {
  const { chatId, paidMessagesStars, tabId = getCurrentTabId() } = payload;
  const chat = chatId ? selectChat(global, chatId) : undefined;
  if (!chat) return;

  global = updateManagementProgress(global, ManagementProgress.InProgress, tabId);
  setGlobal(global);

  const result = await callApi('updatePaidMessagesPrice', {
    chat,
    paidMessagesStars,
  });

  if (!result) return;

  global = getGlobal();
  global = updateManagementProgress(global, ManagementProgress.Complete, tabId);
  global = updateChat(global, chatId, { paidMessagesStars });
  setGlobal(global);
});

addActionHandler('toggleAutoTranslation', async (global, actions, payload): Promise<void> => {
  const { chatId, isEnabled } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  const result = await callApi('toggleAutoTranslation', { chat, isEnabled });
  if (!result) return;

  global = getGlobal();
  global = updateChat(global, chatId, { hasAutoTranslation: isEnabled || undefined });
  setGlobal(global);
});

addActionHandler('setMainProfileTab', async (global, actions, payload): Promise<void> => {
  const { chatId, tab } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  const peerFullInfo = selectPeerFullInfo(global, chatId);
  const oldMainTab = peerFullInfo?.mainTab;
  if (oldMainTab === tab) return;

  global = updatePeerFullInfo(global, chatId, { mainTab: tab });
  setGlobal(global);

  let result;
  if (chatId === global.currentUserId) {
    result = await callApi('setAccountMainProfileTab', { tab });
  } else {
    result = await callApi('setChannelMainProfileTab', { chat, tab });
  }

  if (!result) {
    global = getGlobal();
    global = updatePeerFullInfo(global, chatId, { mainTab: oldMainTab });
    setGlobal(global);
  }
});

addActionHandler('resolveBusinessChatLink', async (global, actions, payload): Promise<void> => {
  const { slug, tabId = getCurrentTabId() } = payload;
  const result = await callApi('resolveBusinessChatLink', { slug });
  if (!result) {
    actions.showNotification({
      message: langProvider.oldTranslate('BusinessLink.ErrorExpired'),
      tabId,
    });
    return;
  }

  const { chatLink } = result;

  actions.openChatWithDraft({
    chatId: chatLink.chatId,
    text: chatLink.text,
    tabId,
  });
});

addActionHandler('requestCollectibleInfo', async (global, actions, payload): Promise<void> => {
  const {
    type, collectible, peerId, tabId = getCurrentTabId(),
  } = payload;

  let inputCollectible;
  if (type === 'phone') {
    inputCollectible = { phone: collectible };
  }
  if (type === 'username') {
    inputCollectible = { username: collectible };
  }
  if (!inputCollectible) return;

  const result = await callApi('fetchCollectionInfo', inputCollectible);
  if (!result) {
    copyTextToClipboard(collectible);
    return;
  }

  global = getGlobal();
  global = updateTabState(global, {
    collectibleInfoModal: {
      ...result,
      type,
      collectible,
      peerId,
    },
  }, tabId);
  setGlobal(global);
});

async function loadChats(
  listType: ChatListType,
  isFullDraftSync?: boolean,
  shouldIgnorePagination?: boolean,
) {
  let global = getGlobal();
  let lastLocalServiceMessageId = selectLastServiceNotification(global)?.id;

  const params = !shouldIgnorePagination ? selectChatListLoadingParameters(global, listType) : {};
  const offsetPeer = params.nextOffsetPeerId ? selectPeer(global, params.nextOffsetPeerId) : undefined;
  const offsetDate = params.nextOffsetDate;
  const offsetId = params.nextOffsetId;

  const isFirstBatch = !shouldIgnorePagination && !offsetPeer && !offsetDate && !offsetId;
  const shouldReplaceStaleState = listType === 'active' && isFirstBatch;
  const isAccountFreeze = selectIsCurrentUserFrozen(global);

  const result = listType === 'saved' ? await callApi('fetchSavedChats', {
    limit: CHAT_LIST_LOAD_SLICE,
    offsetDate,
    offsetId,
    offsetPeer,
    withPinned: isFirstBatch && !isAccountFreeze,
  }) : await callApi('fetchChats', {
    limit: CHAT_LIST_LOAD_SLICE,
    offsetDate,
    offsetId,
    offsetPeer,
    archived: listType === 'archived',
    withPinned: isFirstBatch && !isAccountFreeze,
    lastLocalServiceMessageId,
  });

  if (!result) {
    return;
  }

  const { chatIds } = result;

  global = getGlobal();
  lastLocalServiceMessageId = selectLastServiceNotification(global)?.id;

  const newChats = buildCollectionByKey(result.chats, 'id');

  global = updateUsers(global, buildCollectionByKey(result.users, 'id'));
  global = updateChats(global, newChats);
  if (isFirstBatch) {
    global = replaceChatListIds(global, listType, chatIds);
  } else {
    global = addChatListIds(global, listType, chatIds);
  }

  if (shouldReplaceStaleState) {
    global = replaceUserStatuses(global, result.userStatusesById);
    global = replaceNotifyExceptions(global, result.notifyExceptionById);
  } else {
    global = addUserStatuses(global, result.userStatusesById);
    global = addNotifyExceptions(global, result.notifyExceptionById);
  }

  global = updateChatListSecondaryInfo(global, listType, result);
  global = replaceMessages(global, result.messages);
  global = updateChatsLastMessageId(global, result.lastMessageByChatId, listType);

  if (!shouldIgnorePagination) {
    global = replaceChatListLoadingParameters(
      global, listType, result.nextOffsetId, result.nextOffsetPeerId, result.nextOffsetDate,
    );
  }

  if (listType === 'active' || listType === 'archived') {
    const idsToUpdateDraft = isFullDraftSync ? result.chatIds : Object.keys(result.draftsById);
    idsToUpdateDraft.forEach((chatId) => {
      const draft = result.draftsById[chatId];
      const thread = selectThread(global, chatId, MAIN_THREAD_ID);

      if (!draft && !thread) return;

      if (!selectDraft(global, chatId, MAIN_THREAD_ID)?.isLocal) {
        global = replaceThreadParam(
          global, chatId, MAIN_THREAD_ID, 'draft', draft,
        );
      }
    });
  }

  if ((chatIds.length === 0 || chatIds.length === result.totalChatCount) && !global.chats.isFullyLoaded[listType]) {
    global = {
      ...global,
      chats: {
        ...global.chats,
        isFullyLoaded: {
          ...global.chats.isFullyLoaded,
          [listType]: true,
        },
      },
    };
  }

  setGlobal(global);
}

export async function loadFullChat<T extends GlobalState>(
  global: T, actions: RequiredGlobalActions, chat: ApiChat,
) {
  if (selectIsCurrentUserFrozen(global)) return undefined;
  const result = await callApi('fetchFullChat', chat);
  if (!result) {
    return undefined;
  }

  const {
    chats, userStatusesById, fullInfo, groupCall, membersCount, isForumAsMessages,
  } = result;

  global = getGlobal();
  global = updateChats(global, buildCollectionByKey(chats, 'id'));

  if (userStatusesById) {
    global = addUserStatuses(global, userStatusesById);
  }

  if (groupCall) {
    const existingGroupCall = selectGroupCall(global, groupCall.id!);
    global = updateGroupCall(
      global,
      groupCall.id!,
      omit(groupCall, ['connectionState', 'isLoaded']),
      undefined,
      existingGroupCall ? undefined : groupCall.participantsCount,
    );
  }

  if (membersCount !== undefined) {
    global = updateChat(global, chat.id, { membersCount });
  }
  if (chat.isForum) {
    global = updateChat(global, chat.id, { isForumAsMessages });
  }
  global = replaceChatFullInfo(global, chat.id, fullInfo);
  setGlobal(global);

  const stickerSet = fullInfo.stickerSet;
  const localSet = stickerSet && selectStickerSet(global, stickerSet);
  if (stickerSet && !localSet) {
    actions.loadStickers({
      stickerSetInfo: {
        id: stickerSet.id,
        accessHash: stickerSet.accessHash,
      },
    });
  }

  const emojiSet = fullInfo.emojiSet;
  const localEmojiSet = emojiSet && selectStickerSet(global, emojiSet);
  if (emojiSet && !localEmojiSet) {
    actions.loadStickers({
      stickerSetInfo: {
        id: emojiSet.id,
        accessHash: emojiSet.accessHash,
      },
    });
  }

  return result;
}

export async function migrateChat<T extends GlobalState>(
  global: T, actions: RequiredGlobalActions, chat: ApiChat,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): Promise<ApiChat | undefined> {
  try {
    const supergroup = await callApi('migrateChat', chat);

    return supergroup;
  } catch (error) {
    if ((error as ApiError).message === 'CHANNELS_TOO_MUCH') {
      actions.openLimitReachedModal({ limit: 'channels', tabId });
    } else {
      actions.showDialog({ data: { ...(error as ApiError), hasErrorKey: true }, tabId });
    }

    return undefined;
  }
}

export async function fetchChatByUsername<T extends GlobalState>(
  global: T,
  username: string,
  referrer?: string,
) {
  global = getGlobal();
  const localChat = !referrer ? selectChatByUsername(global, username) : undefined;
  if (localChat && !localChat.isMin) {
    return localChat;
  }

  const { chat, user } = await callApi('getChatByUsername', username, referrer) || {};
  if (!chat) {
    return undefined;
  }

  global = getGlobal();
  global = updateChat(global, chat.id, chat);
  if (user) {
    global = updateUser(global, user.id, user);
  }

  setGlobal(global);

  return chat;
}

export async function checkWebAppExists<T extends GlobalState>(
  global: T, botName: string, appName: string,
) {
  if (!botName || !appName) return false;
  global = getGlobal();
  const chatByUsername = await fetchChatByUsername(global, botName);
  global = getGlobal();
  const bot = chatByUsername && selectUser(global, chatByUsername.id);
  const botApp = bot && await callApi('fetchBotApp', {
    bot,
    appName,
  });
  return Boolean(botApp);
}

export async function fetchChatByPhoneNumber<T extends GlobalState>(global: T, phoneNumber: string) {
  global = getGlobal();
  const localUser = selectUserByPhoneNumber(global, phoneNumber);
  if (localUser && !localUser.isMin) {
    return selectChat(global, localUser.id);
  }

  const { chat, user } = await callApi('getChatByPhoneNumber', phoneNumber) || {};
  if (!chat) {
    return undefined;
  }

  global = getGlobal();
  global = updateChat(global, chat.id, chat);

  if (user) {
    global = updateUser(global, user.id, user);
  }
  setGlobal(global);

  return chat;
}

async function getAttachBotOrNotify<T extends GlobalState>(
  global: T, actions: RequiredGlobalActions, username: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const chat = await fetchChatByUsername(global, username);
  if (!chat) return undefined;

  global = getGlobal();
  const user = selectUser(global, chat.id);
  if (!user) return undefined;

  const isBot = isUserBot(user);
  if (!isBot) return undefined;
  const result = await callApi('loadAttachBot', {
    bot: user,
  });

  global = getGlobal();
  if (!result) {
    actions.showNotification({
      message: langProvider.oldTranslate('WebApp.AddToAttachmentUnavailableError'),
      tabId,
    });

    return undefined;
  }
  setGlobal(global);

  return result.bot;
}

async function openChatByUsername<T extends GlobalState>(
  global: T,
  actions: RequiredGlobalActions,
  params: {
    username: string;
    threadId?: ThreadId;
    channelPostId?: number;
    startParam?: string;
    ref?: string;
    startAttach?: string;
    attach?: string;
    text?: string;
    timestamp?: number;
    linkContext?: LinkContext;
    isDirect?: boolean;
  },
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const {
    username, threadId, channelPostId, startParam, ref, startAttach, attach, text, timestamp,
    linkContext, isDirect,
  } = params;
  const currentChat = selectCurrentChat(global, tabId);

  // Attach in the current chat
  if (startAttach !== undefined && !attach) {
    const bot = await getAttachBotOrNotify(global, actions, username, tabId);

    if (!bot) return;

    actions.callAttachBot({
      bot,
      chatId: currentChat?.id || bot.id,
      startParam: startAttach,
      tabId,
    });

    return;
  }

  const localChat = selectChatByUsername(global, username);
  const localDirectChat = isDirect && localChat?.linkedMonoforumId && !localChat.isMonoforum
    ? selectChat(global, localChat.linkedMonoforumId) : undefined;

  const isCurrentChat = !isDirect
    ? currentChat?.usernames?.some((c) => c.username === username)
    : localDirectChat?.id === currentChat?.id;

  if (!isCurrentChat) {
    // Open temporary empty chat to make the click response feel faster
    actions.openChat({ id: TMP_CHAT_ID, tabId });
  }

  const starRefStartPrefixes = global.appConfig.starRefStartPrefixes;
  let referrer = ref;
  if (startParam && starRefStartPrefixes?.length) {
    const prefix = starRefStartPrefixes.find((p) => startParam.startsWith(p));
    if (prefix) {
      referrer = startParam.slice(prefix.length);
    }
  }

  const chat = await fetchChatByUsername(global, username, referrer);
  if (!chat) {
    if (!isCurrentChat) {
      actions.openPreviousChat({ tabId });
      actions.showNotification({ message: 'User does not exist', tabId });
    }

    return;
  }

  const monoforumChat = isDirect && !chat.isMonoforum && chat.linkedMonoforumId
    ? selectChat(global, chat.linkedMonoforumId) : undefined;

  const targetChat = (isDirect && monoforumChat) || chat;

  openChatWithParams(global, actions, targetChat, {
    isCurrentChat,
    threadId,
    messageId: channelPostId,
    startParam,
    referrer,
    startAttach,
    attach,
    text,
    timestamp,
    linkContext,
  }, tabId);
}

async function openChatWithParams<T extends GlobalState>(
  global: T,
  actions: RequiredGlobalActions,
  chat: ApiChat,
  params: {
    isCurrentChat?: boolean;
    threadId?: ThreadId;
    messageId?: number;
    startParam?: string;
    referrer?: string;
    startAttach?: string;
    attach?: string;
    text?: string;
    timestamp?: number;
    linkContext?: LinkContext;
  },
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const {
    isCurrentChat, threadId, messageId, startParam, referrer, startAttach, attach, text, timestamp,
    linkContext,
  } = params;

  if (messageId) {
    let isTopicProcessed = false;
    // In forums, link to a topic start message should open the topic
    if (chat.isForum && !threadId) {
      let topic = selectTopics(global, chat.id)?.[messageId];
      if (!topic) {
        const topicResult = await callApi('fetchTopicById', { chat, topicId: messageId });
        topic = topicResult?.topic;
      }

      if (topic) {
        actions.openThread({
          chatId: chat.id, threadId: topic.id, tabId,
        });
        isTopicProcessed = true;
      }
    }

    if (!isTopicProcessed) {
      actions.focusMessage({
        chatId: chat.id, threadId, messageId, timestamp, tabId,
        replyMessageId: linkContext?.messageId,
      });
    }
  } else if (!isCurrentChat) {
    actions.openThread({ chatId: chat.id, threadId: threadId ?? MAIN_THREAD_ID, tabId });
  }

  if (startParam && !referrer) {
    actions.startBot({ botId: chat.id, param: startParam });
  }

  if (attach) {
    global = getGlobal();
    openAttachMenuFromLink(global, actions, chat.id, attach, startAttach, tabId);
  }

  if (text) {
    actions.openChatWithDraft({ chatId: chat.id, text: { text }, tabId });
  }

  if (messageId && timestamp) {
    actions.openMediaFromTimestamp({
      chatId: chat.id, threadId, messageId, timestamp, tabId,
    });
  }
}

async function openAttachMenuFromLink<T extends GlobalState>(
  global: T,
  actions: RequiredGlobalActions,
  chatId: string,
  attach: string,
  startAttach?: string | boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  global = getGlobal();
  const bot = await getAttachBotOrNotify(global, actions, attach, tabId);
  if (!bot) return;

  actions.callAttachBot({
    bot,
    chatId,
    ...(typeof startAttach === 'string' && { startParam: startAttach }),
    tabId,
  });
}

export async function ensureIsSuperGroup<T extends GlobalState>(
  global: T,
  actions: RequiredGlobalActions,
  chatId: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const chat = selectChat(global, chatId);
  if (!chat || !isChatBasicGroup(chat)) {
    return chat;
  }

  const newChat = await migrateChat(global, actions, chat, tabId);
  if (!newChat) {
    return undefined;
  }

  actions.loadFullChat({ chatId: newChat.id });
  actions.openChat({ id: newChat.id, tabId });

  return newChat;
}

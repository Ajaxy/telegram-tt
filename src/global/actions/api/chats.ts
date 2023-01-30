import type { RequiredGlobalActions } from '../../index';
import {
  addActionHandler, getGlobal, setGlobal,
} from '../../index';

import type {
  ApiChat, ApiUser, ApiError, ApiChatMember,
} from '../../../api/types';
import { MAIN_THREAD_ID } from '../../../api/types';
import { NewChatMembersProgress, ChatCreationProgress, ManagementProgress } from '../../../types';
import type {
  GlobalState, ActionReturnType, TabArgs,
} from '../../types';

import {
  ARCHIVED_FOLDER_ID,
  TOP_CHAT_MESSAGES_PRELOAD_LIMIT,
  CHAT_LIST_LOAD_SLICE,
  RE_TG_LINK,
  SERVICE_NOTIFICATIONS_USER_ID,
  TMP_CHAT_ID,
  ALL_FOLDER_ID,
  DEBUG,
  TOPICS_SLICE,
  TOPICS_SLICE_SECOND_LOAD,
  TME_WEB_DOMAINS,
} from '../../../config';
import { callApi } from '../../../api/gramjs';
import {
  addChats,
  addUsers,
  addUserStatuses,
  replaceThreadParam,
  updateChatListIds,
  updateChats,
  updateChat,
  updateChatListSecondaryInfo,
  updateManagementProgress,
  leaveChat,
  replaceUsers,
  replaceUserStatuses,
  replaceChats,
  replaceChatListIds,
  addChatMembers,
  updateUser,
  addMessages,
  updateTopics,
  deleteTopic,
  updateTopic,
  updateThreadInfo,
  updateListedTopicIds,
} from '../../reducers';
import {
  selectChat, selectUser, selectChatListType, selectIsChatPinned,
  selectChatFolder, selectSupportChat, selectChatByUsername,
  selectCurrentMessageList, selectThreadInfo, selectCurrentChat, selectLastServiceNotification,
  selectVisibleUsers, selectUserByPhoneNumber, selectDraft, selectThreadTopMessageId,
  selectTabState,
} from '../../selectors';
import { buildCollectionByKey, omit } from '../../../util/iteratees';
import { debounce, pause, throttle } from '../../../util/schedulers';
import {
  isChatSummaryOnly,
  isChatArchived,
  isChatBasicGroup,
  isChatChannel,
  isChatSuperGroup,
  isUserBot,
} from '../../helpers';
import { formatShareText, parseChooseParameter, processDeepLink } from '../../../util/deeplink';
import { updateGroupCall } from '../../reducers/calls';
import { selectGroupCall } from '../../selectors/calls';
import { getOrderedIds } from '../../../util/folderManager';
import * as langProvider from '../../../util/langProvider';
import { selectCurrentLimit } from '../../selectors/limits';
import { updateTabState } from '../../reducers/tabs';
import { getCurrentTabId } from '../../../util/establishMultitabRole';

const TOP_CHAT_MESSAGES_PRELOAD_INTERVAL = 100;
const INFINITE_LOOP_MARKER = 100;

const SERVICE_NOTIFICATIONS_USER_MOCK: ApiUser = {
  id: SERVICE_NOTIFICATIONS_USER_ID,
  accessHash: '0',
  type: 'userTypeRegular',
  isMin: true,
  phoneNumber: '',
};

const runThrottledForLoadTopChats = throttle((cb) => cb(), 3000, true);
const runDebouncedForLoadFullChat = debounce((cb) => cb(), 500, false, true);

addActionHandler('preloadTopChatMessages', async (global, actions): Promise<void> => {
  const preloadedChatIds = new Set<string>();

  for (let i = 0; i < TOP_CHAT_MESSAGES_PRELOAD_LIMIT; i++) {
    await pause(TOP_CHAT_MESSAGES_PRELOAD_INTERVAL);

    global = getGlobal();
    const currentChatIds = Object.values(global.byTabId)
      // eslint-disable-next-line @typescript-eslint/no-loop-func
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

addActionHandler('openChat', (global, actions, payload): ActionReturnType => {
  const {
    id, threadId = MAIN_THREAD_ID,
  } = payload;
  if (!id) {
    return;
  }

  const { currentUserId } = global;
  const chat = selectChat(global, id);

  if (chat?.hasUnreadMark) {
    actions.toggleChatUnread({ id });
  }

  // Please telegram send us some updates about linked chat 🙏
  if (chat?.lastMessage?.repliesThreadInfo) {
    actions.requestThreadInfoUpdate({
      chatId: chat.lastMessage.repliesThreadInfo.chatId,
      threadId: chat.lastMessage.repliesThreadInfo.threadId,
    });
  }

  if (!chat) {
    if (id === currentUserId) {
      void callApi('fetchChat', { type: 'self' });
    } else {
      const user = selectUser(global, id);
      if (user) {
        void callApi('fetchChat', { type: 'user', user });
      }
    }
  } else if (isChatSummaryOnly(chat) && !chat.isMin) {
    actions.requestChatUpdate({ chatId: id });
  }

  if (threadId !== MAIN_THREAD_ID) {
    const topMessageId = selectThreadTopMessageId(global, id, threadId);
    if (!topMessageId) {
      actions.requestThreadInfoUpdate({ chatId: id, threadId });
    }
  }
});

addActionHandler('openLinkedChat', async (global, actions, payload): Promise<void> => {
  const { id, tabId = getCurrentTabId() } = payload!;
  const chat = selectChat(global, id);
  if (!chat) {
    return;
  }

  const chatFullInfo = await callApi('fetchFullChat', chat);

  if (chatFullInfo?.fullInfo?.linkedChatId) {
    actions.openChat({ id: chatFullInfo.fullInfo.linkedChatId, tabId });
  }
});

addActionHandler('focusMessageInComments', async (global, actions, payload): Promise<void> => {
  const {
    chatId, threadId, messageId, tabId = getCurrentTabId(),
  } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const result = await callApi('requestThreadInfoUpdate', { chat, threadId });
  if (!result) {
    return;
  }
  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  setGlobal(global);

  actions.focusMessage({
    chatId, threadId, messageId, tabId,
  });
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
  const listType = payload.listType as 'active' | 'archived';
  const { onReplace } = payload;
  let { shouldReplace } = payload;
  let i = 0;

  const getOrderDate = (chat: ApiChat) => {
    return chat.lastMessage?.date || chat.joinDate;
  };

  while (shouldReplace || !global.chats.isFullyLoaded[listType]) {
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

    const listIds = !shouldReplace && global.chats.listIds[listType];
    const oldestChat = listIds
      ? listIds
        /* eslint-disable @typescript-eslint/no-loop-func */
        .map((id) => global.chats.byId[id])
        .filter((chat) => (
          Boolean(chat && getOrderDate(chat))
          && chat.id !== SERVICE_NOTIFICATIONS_USER_ID
          && !selectIsChatPinned(global, chat.id)
        ))
        /* eslint-enable @typescript-eslint/no-loop-func */
        .sort((chat1, chat2) => getOrderDate(chat1)! - getOrderDate(chat2)!)[0]
      : undefined;

    await loadChats(global,
      listType,
      oldestChat?.id,
      oldestChat ? getOrderDate(oldestChat) : undefined,
      shouldReplace,
      true);

    if (shouldReplace) {
      onReplace?.();
      shouldReplace = false;
    }

    global = getGlobal();
  }
});

addActionHandler('loadFullChat', (global, actions, payload): ActionReturnType => {
  const { chatId, force, tabId = getCurrentTabId() } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  if (force) {
    loadFullChat(global, actions, chat, tabId);
  } else {
    runDebouncedForLoadFullChat(() => loadFullChat(global, actions, chat, tabId));
  }
});

addActionHandler('loadTopChats', (global): ActionReturnType => {
  runThrottledForLoadTopChats(() => loadChats(global, 'active'));
});

addActionHandler('requestChatUpdate', (global, actions, payload): ActionReturnType => {
  const { chatId } = payload!;
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

addActionHandler('updateChatMutedState', (global, actions, payload): ActionReturnType => {
  const { chatId, isMuted } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  global = updateChat(global, chatId, { isMuted });
  setGlobal(global);
  void callApi('updateChatMutedState', { chat, isMuted });
});

addActionHandler('updateTopicMutedState', (global, actions, payload): ActionReturnType => {
  const { chatId, isMuted, topicId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  global = updateTopic(global, chatId, topicId, { isMuted });
  setGlobal(global);
  void callApi('updateTopicMutedState', {
    chat, topicId, isMuted,
  });
});

addActionHandler('createChannel', async (global, actions, payload): Promise<void> => {
  const {
    title, about, photo, memberIds, tabId = getCurrentTabId(),
  } = payload;

  const users = (memberIds as string[])
    .map((id) => selectUser(global, id))
    .filter(Boolean);

  global = updateTabState(global, {
    chatCreation: {
      progress: ChatCreationProgress.InProgress,
    },
  }, tabId);
  setGlobal(global);

  let createdChannel: ApiChat | undefined;

  try {
    createdChannel = await callApi('createChannel', { title, about, users });
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
  actions.openChat({ id: channelId, shouldReplaceHistory: true, tabId });

  if (channelId && accessHash && photo) {
    await callApi('editChatPhoto', { chatId: channelId, accessHash, photo });
  }
});

addActionHandler('joinChannel', async (global, actions, payload): Promise<void> => {
  const { chatId, tabId = getCurrentTabId() } = payload!;
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
  const { chatId, userId, tabId = getCurrentTabId() } = payload;
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

  void callApi('deleteChatUser', { chat, user });
});

addActionHandler('deleteChat', (global, actions, payload): ActionReturnType => {
  const { chatId, tabId = getCurrentTabId() } = payload!;
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

addActionHandler('leaveChannel', (global, actions, payload): ActionReturnType => {
  const { chatId, tabId = getCurrentTabId() } = payload!;
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
    void callApi('leaveChannel', { channelId, accessHash });
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
  const users = (memberIds as string[])
    .map((id) => selectUser(global, id))
    .filter(Boolean);

  global = updateTabState(global, {
    chatCreation: {
      progress: ChatCreationProgress.InProgress,
    },
  }, tabId);
  setGlobal(global);

  try {
    const createdChat = await callApi('createGroupChat', {
      title,
      users,
    });

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

    if (chatId && photo) {
      await callApi('editChatPhoto', {
        chatId,
        photo,
      });
    }
  } catch (e: any) {
    if (e.message === 'USERS_TOO_FEW') {
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
  const { id, folderId, tabId = getCurrentTabId() } = payload!;
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
  const { id } = payload!;
  const chat = selectChat(global, id);
  if (chat) {
    void callApi('toggleChatArchived', {
      chat,
      folderId: isChatArchived(chat) ? 0 : ARCHIVED_FOLDER_ID,
    });
  }
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

addActionHandler('editChatFolders', (global, actions, payload): ActionReturnType => {
  const {
    chatId, idsToRemove, idsToAdd, tabId = getCurrentTabId(),
  } = payload;
  const limit = selectCurrentLimit(global, 'dialogFiltersChats');

  const isLimitReached = idsToAdd
    .some((id) => selectChatFolder(global, id)!.includedChatIds.length >= limit);
  if (isLimitReached) {
    actions.openLimitReachedModal({ limit: 'dialogFiltersChats', tabId });
    return;
  }

  idsToRemove.forEach(async (id) => {
    const folder = selectChatFolder(global, id);
    if (folder) {
      await callApi('editChatFolder', {
        id,
        folderUpdate: {
          ...folder,
          pinnedChatIds: folder.pinnedChatIds?.filter((pinnedId) => pinnedId !== chatId),
          includedChatIds: folder.includedChatIds.filter((includedId) => includedId !== chatId),
        },
      });
    }
  });

  idsToAdd.forEach(async (id) => {
    const folder = selectChatFolder(global, id);
    if (folder) {
      await callApi('editChatFolder', {
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
  const { id, folderUpdate } = payload!;
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
  const { folder, tabId = getCurrentTabId() } = payload!;
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

  await callApi('editChatFolder', {
    id: maxId + 1,
    folderUpdate: {
      id: maxId + 1,
      ...newFolder,
    },
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
  const { folderIds } = payload!;

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

addActionHandler('toggleChatUnread', (global, actions, payload): ActionReturnType => {
  const { id } = payload;
  const chat = selectChat(global, id);
  if (chat) {
    if (chat.unreadCount) {
      void callApi('markMessageListRead', { chat, threadId: MAIN_THREAD_ID });
    } else {
      void callApi('toggleDialogUnread', {
        chat,
        hasUnreadMark: !chat.hasUnreadMark,
      });
    }
  }
});

addActionHandler('markTopicRead', (global, actions, payload): ActionReturnType => {
  const { chatId, topicId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  const lastTopicMessageId = chat.topics?.[topicId]?.lastMessageId;
  if (!lastTopicMessageId) return;

  void callApi('markMessageListRead', {
    chat,
    threadId: topicId,
    maxId: lastTopicMessageId,
  });

  global = getGlobal();
  global = updateTopic(global, chatId, topicId, {
    unreadCount: 0,
  });
  global = updateThreadInfo(global, chatId, topicId, {
    lastReadInboxMessageId: lastTopicMessageId,
  });
  setGlobal(global);
});

addActionHandler('openChatByInvite', async (global, actions, payload): Promise<void> => {
  const { hash, tabId = getCurrentTabId() } = payload!;

  const result = await callApi('openChatByInvite', hash);
  if (!result) {
    return;
  }

  actions.openChat({ id: result.chatId, tabId });
});

addActionHandler('openChatByPhoneNumber', async (global, actions, payload): Promise<void> => {
  const {
    phoneNumber, startAttach, attach, tabId = getCurrentTabId(),
  } = payload!;

  // Open temporary empty chat to make the click response feel faster
  actions.openChat({ id: TMP_CHAT_ID, tabId });

  const chat = await fetchChatByPhoneNumber(global, phoneNumber);
  if (!chat) {
    actions.openPreviousChat({ tabId });
    actions.showNotification({
      message: langProvider.translate('lng_username_by_phone_not_found').replace('{phone}', phoneNumber),
      tabId,
    });
    return;
  }

  actions.openChat({ id: chat.id, tabId });

  if (attach) {
    global = getGlobal();
    openAttachMenuFromLink(global, actions, chat.id, attach, startAttach, tabId);
  }
});

addActionHandler('openTelegramLink', (global, actions, payload): ActionReturnType => {
  const {
    url,
    tabId = getCurrentTabId(),
  } = payload;

  const {
    openChatByPhoneNumber,
    openChatByInvite,
    openStickerSet,
    openChatWithDraft,
    joinVoiceChatByLink,
    showNotification,
    focusMessage,
    openInvoice,
    processAttachBotParameters,
    openChatByUsername: openChatByUsernameAction,
  } = actions;

  if (url.match(RE_TG_LINK)) {
    processDeepLink(url);
    return;
  }

  const uri = new URL(url.startsWith('http') ? url : `https://${url}`);
  if (TME_WEB_DOMAINS.has(uri.hostname) && uri.pathname === '/') {
    window.open(uri.toString(), '_blank', 'noopener');
    return;
  }

  const hostname = TME_WEB_DOMAINS.has(uri.hostname) ? 't.me' : uri.hostname;
  const hostParts = hostname.split('.');
  if (hostParts.length > 3) return;
  const pathname = hostParts.length === 3 ? `${hostParts[0]}/${uri.pathname}` : uri.pathname;
  const [part1, part2, part3] = pathname.split('/').filter(Boolean).map((part) => decodeURI(part));
  const params = Object.fromEntries(uri.searchParams);

  let hash: string | undefined;
  if (part1 === 'joinchat') {
    hash = part2;
  }

  const startAttach = params.hasOwnProperty('startattach') && !params.startattach ? true : params.startattach;
  const choose = parseChooseParameter(params.choose);

  if (part1.match(/^\+([0-9]+)(\?|$)/)) {
    openChatByPhoneNumber({
      phoneNumber: part1.substr(1, part1.length - 1),
      startAttach,
      attach: params.attach,
      tabId,
    });
    return;
  }

  if (part1.startsWith(' ') || part1.startsWith('+')) {
    hash = part1.substr(1, part1.length - 1);
  }

  if (hash) {
    openChatByInvite({ hash, tabId });
    return;
  }

  if (part1 === 'addstickers' || part1 === 'addemoji') {
    openStickerSet({
      stickerSetInfo: {
        shortName: part2,
      },
      tabId,
    });
    return;
  }

  const chatOrChannelPostId = part2 || undefined;
  const messageId = part3 ? Number(part3) : undefined;
  const commentId = params.comment ? Number(params.comment) : undefined;

  if (part1 === 'share') {
    const text = formatShareText(params.url, params.text);
    openChatWithDraft({ text, tabId });
  } else if (params.hasOwnProperty('voicechat') || params.hasOwnProperty('livestream')) {
    joinVoiceChatByLink({
      username: part1,
      inviteHash: params.voicechat || params.livestream,
      tabId,
    });
  } else if (part1 === 'c' && chatOrChannelPostId && messageId) {
    const chatId = `-${chatOrChannelPostId}`;
    const chat = selectChat(global, chatId);
    if (!chat) {
      showNotification({ message: 'Chat does not exist', tabId });
      return;
    }

    focusMessage({
      chatId,
      messageId,
      tabId,
    });
  } else if (part1.startsWith('$')) {
    openInvoice({
      slug: part1.substring(1),
      tabId,
    });
  } else if (part1 === 'invoice') {
    openInvoice({
      slug: part2,
      tabId,
    });
  } else if (startAttach && choose) {
    processAttachBotParameters({
      username: part1,
      filter: choose,
      ...(typeof startAttach === 'string' && { startParam: startAttach }),
      tabId,
    });
  } else {
    openChatByUsernameAction({
      username: part1,
      messageId: messageId || Number(chatOrChannelPostId),
      threadId: messageId ? Number(chatOrChannelPostId) : undefined,
      commentId,
      startParam: params.start,
      startAttach,
      attach: params.attach,
      tabId,
    });
  }
});

addActionHandler('acceptInviteConfirmation', async (global, actions, payload): Promise<void> => {
  const { hash, tabId = getCurrentTabId() } = payload!;
  const result = await callApi('importChatInvite', { hash });
  if (!result) {
    return;
  }

  actions.openChat({ id: result.id, tabId });
});

addActionHandler('openChatByUsername', async (global, actions, payload): Promise<void> => {
  const {
    username, messageId, commentId, startParam, startAttach, attach, threadId,
    tabId = getCurrentTabId(),
  } = payload!;

  const chat = selectCurrentChat(global, tabId);

  if (!commentId) {
    if (!startAttach && messageId && !startParam && chat?.usernames?.some((c) => c.username === username)) {
      actions.focusMessage({
        chatId: chat.id, threadId, messageId, tabId,
      });
      return;
    }
    await openChatByUsername(global, actions, username, threadId, messageId, startParam, startAttach, attach, tabId);
    return;
  }

  const { chatId, type } = selectCurrentMessageList(global, tabId) || {};
  const usernameChat = selectChatByUsername(global, username);
  if (chatId && messageId && usernameChat && type === 'thread') {
    const threadInfo = selectThreadInfo(global, chatId, messageId);

    if (threadInfo && threadInfo.chatId === chatId) {
      actions.focusMessage({
        chatId: threadInfo.chatId,
        threadId: threadInfo.threadId,
        messageId: commentId,
        tabId,
      });
      return;
    }
  }

  if (!messageId) return;

  actions.openChat({ id: TMP_CHAT_ID, tabId });

  const chatByUsername = await fetchChatByUsername(global, username);

  if (!chatByUsername) return;

  global = getGlobal();

  const threadInfo = selectThreadInfo(global, chatByUsername.id, messageId);
  let discussionChatId: string | undefined;

  if (!threadInfo) {
    const result = await callApi('requestThreadInfoUpdate', { chat: chatByUsername, threadId: messageId });
    if (!result) return;

    global = getGlobal();
    global = addUsers(global, buildCollectionByKey(result.users, 'id'));
    setGlobal(global);

    discussionChatId = result.discussionChatId;
  } else {
    discussionChatId = threadInfo.chatId;
  }

  if (!discussionChatId) return;

  actions.focusMessage({
    chatId: discussionChatId,
    threadId: messageId,
    messageId: Number(commentId),
    tabId,
  });
});

addActionHandler('togglePreHistoryHidden', async (global, actions, payload): Promise<void> => {
  const {
    chatId, isEnabled,
    tabId = getCurrentTabId(),
  } = payload!;

  let chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  if (isChatBasicGroup(chat)) {
    chat = await migrateChat(global, actions, chat, tabId);
    global = getGlobal();

    if (!chat) {
      return;
    }

    actions.openChat({ id: chat.id, tabId });
    return;
  }

  global = updateChat(global, chat.id, {
    fullInfo: {
      ...chat.fullInfo,
      isPreHistoryHidden: isEnabled,
    },
  });
  setGlobal(global);

  void callApi('togglePreHistoryHidden', { chat, isEnabled });
});

addActionHandler('updateChatDefaultBannedRights', (global, actions, payload): ActionReturnType => {
  const { chatId, bannedRights } = payload!;
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
  } = payload!;
  let chat = selectChat(global, chatId);
  const user = selectUser(global, userId);

  if (!chat || !user) {
    return;
  }

  if (isChatBasicGroup(chat)) {
    chat = await migrateChat(global, actions, chat, tabId);

    if (!chat) {
      return;
    }

    actions.openChat({ id: chat.id, tabId });
  }

  await callApi('updateChatMemberBannedRights', { chat, user, bannedRights });

  global = getGlobal();

  const chatAfterUpdate = selectChat(global, chatId);

  if (!chatAfterUpdate || !chatAfterUpdate.fullInfo) {
    return;
  }

  const { members, kickedMembers } = chatAfterUpdate.fullInfo;

  const isBanned = Boolean(bannedRights.viewMessages);
  const isUnblocked = !Object.keys(bannedRights).length;

  global = updateChat(global, chatId, {
    fullInfo: {
      ...chatAfterUpdate.fullInfo,
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
    },
  });
  setGlobal(global);
});

addActionHandler('updateChatAdmin', async (global, actions, payload): Promise<void> => {
  const {
    chatId, userId, adminRights, customTitle,
    tabId = getCurrentTabId(),
  } = payload!;

  let chat = selectChat(global, chatId);
  const user = selectUser(global, userId);
  if (!chat || !user) {
    return;
  }

  if (isChatBasicGroup(chat)) {
    chat = await migrateChat(global, actions, chat, tabId);
    if (!chat) {
      return;
    }

    actions.openChat({ id: chat.id, tabId });
  }

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

  global = getGlobal();

  global = updateChat(global, chatId, {
    fullInfo: {
      ...chatAfterUpdate.fullInfo,
      ...(newAdminMembersById && { adminMembersById: newAdminMembersById }),
    },
  });
  setGlobal(global);
});

addActionHandler('updateChat', async (global, actions, payload): Promise<void> => {
  const {
    chatId, title, about, photo, tabId = getCurrentTabId(),
  } = payload;

  const chat = selectChat(global, chatId);
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
    chat.fullInfo && chat.fullInfo.about !== about
      ? callApi('updateChatAbout', chat, about)
      : undefined,
    photo
      ? callApi('editChatPhoto', { chatId, accessHash: chat.accessHash, photo })
      : undefined,
  ]);

  global = getGlobal();
  global = updateManagementProgress(global, ManagementProgress.Complete, tabId);
  setGlobal(global);
});

addActionHandler('updateChatPhoto', async (global, actions, payload): Promise<void> => {
  const { photo, chatId, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;
  global = updateChat(global, chatId, {
    avatarHash: undefined,
    fullInfo: {
      ...chat.fullInfo,
      profilePhoto: undefined,
    },
  });
  setGlobal(global);
  // This method creates a new entry in photos array
  await callApi('editChatPhoto', {
    chatId,
    accessHash: chat.accessHash,
    photo,
  });
  // Explicitly delete the old photo reference
  await callApi('deleteProfilePhotos', [photo]);
  actions.loadFullChat({ chatId, tabId });
  actions.loadProfilePhotos({ profileId: chatId });
});

addActionHandler('deleteChatPhoto', async (global, actions, payload): Promise<void> => {
  const { photo, chatId, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;
  const photosToDelete = [photo];
  if (chat.avatarHash === photo.id) {
    // Select next photo to set as avatar
    const nextPhoto = chat.photos?.[1];
    if (nextPhoto) {
      photosToDelete.push(nextPhoto);
    }
    global = updateChat(global, chatId, {
      avatarHash: undefined,
      fullInfo: {
        ...chat.fullInfo,
        profilePhoto: undefined,
      },
    });
    setGlobal(global);
    // Set next photo as avatar
    await callApi('editChatPhoto', {
      chatId,
      accessHash: chat.accessHash,
      photo: nextPhoto,
    });
  }
  // Delete references to the old photos
  const result = await callApi('deleteProfilePhotos', photosToDelete);
  if (!result) return;
  actions.loadFullChat({ chatId, tabId });
  actions.loadProfilePhotos({ profileId: chatId });
});

addActionHandler('toggleSignatures', (global, actions, payload): ActionReturnType => {
  const { chatId, isEnabled } = payload;
  const chat = selectChat(global, chatId);

  if (!chat) {
    return;
  }

  void callApi('toggleSignatures', { chat, isEnabled });
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
  global = addChats(global, addedById);
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
  const { channelId, chatId, tabId = getCurrentTabId() } = payload || {};

  const channel = selectChat(global, channelId);
  let chat = selectChat(global, chatId);
  if (!channel || !chat) {
    return;
  }

  if (isChatBasicGroup(chat)) {
    chat = await migrateChat(global, actions, chat, tabId);

    if (!chat) {
      return;
    }

    actions.openChat({ id: chat.id, tabId });
  }

  let { fullInfo } = chat;
  if (!fullInfo) {
    const fullChat = await callApi('fetchFullChat', chat);
    if (!fullChat) {
      return;
    }

    fullInfo = fullChat.fullInfo;
  }

  if (fullInfo!.isPreHistoryHidden) {
    global = getGlobal();
    global = updateChat(global, chat.id, {
      fullInfo: {
        ...chat.fullInfo,
        isPreHistoryHidden: false,
      },
    });
    setGlobal(global);

    await callApi('togglePreHistoryHidden', { chat, isEnabled: false });
  }

  void callApi('setDiscussionGroup', { channel, chat });
});

addActionHandler('unlinkDiscussionGroup', async (global, actions, payload): Promise<void> => {
  const { channelId, tabId = getCurrentTabId() } = payload;

  const channel = selectChat(global, channelId);
  if (!channel) {
    return;
  }

  let chat: ApiChat | undefined;
  if (channel.fullInfo?.linkedChatId) {
    chat = selectChat(global, channel.fullInfo.linkedChatId);
  }

  await callApi('setDiscussionGroup', { channel });
  if (chat) {
    global = getGlobal();
    loadFullChat(global, actions, chat, tabId);
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
  const { tabId = getCurrentTabId() } = payload || {};
  const { chatId } = selectCurrentMessageList(global, tabId) || {};
  const chat = chatId ? selectChat(global, chatId) : undefined;
  if (!chat || isChatBasicGroup(chat)) {
    return;
  }

  const offset = (chat.fullInfo?.members?.length) || undefined;
  const result = await callApi('fetchMembers', chat.id, chat.accessHash!, 'recent', offset);
  if (!result) {
    return;
  }

  const { members, users, userStatusesById } = result;
  if (!members || !members.length) {
    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = addUserStatuses(global, userStatusesById);
  global = addChatMembers(global, chat, members);
  setGlobal(global);
});

addActionHandler('addChatMembers', async (global, actions, payload): Promise<void> => {
  const { chatId, memberIds, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, chatId);
  const users = (memberIds as string[]).map((userId) => selectUser(global, userId)).filter(Boolean);

  if (!chat || !users.length) {
    return;
  }

  actions.setNewChatMembersDialogState({ newChatMembersProgress: NewChatMembersProgress.Loading, tabId });
  await callApi('addChatMembers', chat, users);
  actions.setNewChatMembersDialogState({ newChatMembersProgress: NewChatMembersProgress.Closed, tabId });
  global = getGlobal();
  loadFullChat(global, actions, chat, tabId);
});

addActionHandler('deleteChatMember', async (global, actions, payload): Promise<void> => {
  const { chatId, userId, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, chatId);
  const user = selectUser(global, userId);

  if (!chat || !user) {
    return;
  }

  await callApi('deleteChatMember', chat, user);
  global = getGlobal();
  loadFullChat(global, actions, chat, tabId);
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
  const { chatId, enabledReactions, tabId = getCurrentTabId() } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  await callApi('setChatEnabledReactions', {
    chat,
    enabledReactions,
  });

  global = getGlobal();
  void loadFullChat(global, actions, chat, tabId);
});

addActionHandler('loadChatSettings', async (global, actions, payload): Promise<void> => {
  const { chatId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  const result = await callApi('fetchChatSettings', chat);
  if (!result) return;
  const { settings, users } = result;
  global = getGlobal();

  global = addUsers(global, buildCollectionByKey(users, 'id'));

  global = updateChat(global, chat.id, { settings });
  setGlobal(global);
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
  const { chatId, force } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  if (!force && chat.listedTopicIds && chat.listedTopicIds.length === chat.topicsCount) {
    return;
  }

  const offsetTopic = !force && chat.listedTopicIds ? chat.listedTopicIds.reduce((acc, el) => {
    const topic = chat.topics?.[el];
    const accTopic = chat.topics?.[acc];
    if (!topic) return acc;
    if (!accTopic || topic.lastMessageId < accTopic.lastMessageId) {
      return el;
    }
    return acc;
  }) : undefined;

  const { id: offsetTopicId, date: offsetDate, lastMessageId: offsetId } = (offsetTopic
    && chat.topics?.[offsetTopic]) || {};
  const result = await callApi('fetchTopics', {
    chat, offsetTopicId, offsetId, offsetDate, limit: offsetTopicId ? TOPICS_SLICE : TOPICS_SLICE_SECOND_LOAD,
  });

  if (!result) return;

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));
  global = addMessages(global, result.messages);
  global = updateTopics(global, chatId, result.count, result.topics);
  global = updateListedTopicIds(global, chatId, result.topics.map((topic) => topic.id));
  Object.entries(result.draftsById || {}).forEach(([threadId, draft]) => {
    global = replaceThreadParam(global, chatId, Number(threadId), 'draft', draft?.formattedText);
    global = replaceThreadParam(global, chatId, Number(threadId), 'replyingToId', draft?.replyingToId);
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
  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = addChats(global, buildCollectionByKey(result.chats, 'id'));
  global = addMessages(global, result.messages);
  global = updateTopic(global, chatId, topicId, result.topic);

  setGlobal(global);
});

addActionHandler('toggleForum', async (global, actions, payload): Promise<void> => {
  const { chatId, isEnabled } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const prevIsForum = chat.isForum;
  global = updateChat(global, chatId, { isForum: isEnabled });
  setGlobal(global);

  const result = await callApi('toggleForum', { chat, isEnabled });

  if (!result) {
    global = getGlobal();
    global = updateChat(global, chatId, { isForum: prevIsForum });
    setGlobal(global);
  }
});

addActionHandler('toggleParticipantsHidden', async (global, actions, payload): Promise<void> => {
  const { chatId, isEnabled } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const prevIsEnabled = chat.fullInfo?.areParticipantsHidden;

  global = updateChat(global, chatId, {
    fullInfo: {
      ...chat.fullInfo,
      areParticipantsHidden: isEnabled,
    },
  });
  setGlobal(global);

  const result = await callApi('toggleParticipantsHidden', { chat, isEnabled });

  if (!result && prevIsEnabled !== undefined) {
    global = getGlobal();
    global = updateChat(global, chatId, {
      fullInfo: {
        ...chat.fullInfo,
        areParticipantsHidden: prevIsEnabled,
      },
    });
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
    actions.openChat({
      id: chatId, threadId: topicId, shouldReplaceHistory: true, tabId,
    });
  }
  actions.closeCreateTopicPanel({ tabId });
});

addActionHandler('deleteTopic', async (global, actions, payload): Promise<void> => {
  const { chatId, topicId } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  const result = await callApi('deleteTopic', { chat, topicId });

  if (!result) return;

  global = getGlobal();
  global = deleteTopic(global, chatId, topicId);
  setGlobal(global);
});

addActionHandler('editTopic', async (global, actions, payload): Promise<void> => {
  const {
    chatId, topicId, tabId = getCurrentTabId(), ...rest
  } = payload;
  const chat = selectChat(global, chatId);
  const topic = chat?.topics?.[topicId];
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

  const { topicsPinnedLimit } = global.appConfig || {};
  const chat = selectChat(global, chatId);
  if (!chat || !chat.topics || !topicsPinnedLimit) return;

  if (isPinned && Object.values(chat.topics).filter((topic) => topic.isPinned).length >= topicsPinnedLimit) {
    actions.showNotification({
      message: langProvider.translate('LimitReachedPinnedTopics', topicsPinnedLimit, 'i'),
      tabId,
    });
    return;
  }

  void callApi('togglePinnedTopic', { chat, topicId, isPinned });
});

async function loadChats<T extends GlobalState>(
  global: T,
  listType: 'active' | 'archived',
  offsetId?: string,
  offsetDate?: number,
  shouldReplace = false,
  isFullDraftSync?: boolean,
) {
  global = getGlobal();
  const lastLocalServiceMessage = selectLastServiceNotification(global)?.message;
  const result = await callApi('fetchChats', {
    limit: CHAT_LIST_LOAD_SLICE,
    offsetDate,
    archived: listType === 'archived',
    withPinned: shouldReplace,
    lastLocalServiceMessage,
  });

  if (!result) {
    return;
  }

  const { chatIds } = result;

  if (chatIds.length > 0 && chatIds[0] === offsetId) {
    chatIds.shift();
  }

  global = getGlobal();

  if (shouldReplace && listType === 'active') {
    // Always include service notifications chat
    if (!chatIds.includes(SERVICE_NOTIFICATIONS_USER_ID)) {
      const result2 = await callApi('fetchChat', {
        type: 'user',
        user: SERVICE_NOTIFICATIONS_USER_MOCK,
      });

      global = getGlobal();

      const notificationsChat = result2 && selectChat(global, result2.chatId);
      if (notificationsChat) {
        chatIds.unshift(notificationsChat.id);
        result.chats.unshift(notificationsChat);
        if (lastLocalServiceMessage) {
          notificationsChat.lastMessage = lastLocalServiceMessage;
        }
      }
    }

    const tabStates = Object.values(global.byTabId);
    const visibleChats = tabStates.flatMap(({ id: tabId }) => {
      const currentChat = selectCurrentChat(global, tabId);
      return currentChat ? [currentChat] : [];
    });

    const visibleUsers = tabStates.flatMap(({ id: tabId }) => {
      return selectVisibleUsers(global, tabId) || [];
    });

    if (global.currentUserId && global.users.byId[global.currentUserId]) {
      visibleUsers.push(global.users.byId[global.currentUserId]);
    }

    global = replaceUsers(global, buildCollectionByKey(visibleUsers.concat(result.users), 'id'));
    global = replaceUserStatuses(global, result.userStatusesById);
    global = replaceChats(global, buildCollectionByKey(visibleChats.concat(result.chats), 'id'));
    global = replaceChatListIds(global, listType, chatIds);
  } else if (shouldReplace && listType === 'archived') {
    global = addUsers(global, buildCollectionByKey(result.users, 'id'));
    global = addUserStatuses(global, result.userStatusesById);
    global = updateChats(global, buildCollectionByKey(result.chats, 'id'));
    global = replaceChatListIds(global, listType, chatIds);
  } else {
    global = addUsers(global, buildCollectionByKey(result.users, 'id'));
    global = addUserStatuses(global, result.userStatusesById);
    global = updateChats(global, buildCollectionByKey(result.chats, 'id'));
    global = updateChatListIds(global, listType, chatIds);
  }

  global = updateChatListSecondaryInfo(global, listType, result);

  const idsToUpdateDraft = isFullDraftSync ? result.chatIds : Object.keys(result.draftsById);
  idsToUpdateDraft.forEach((chatId) => {
    if (!selectDraft(global, chatId, MAIN_THREAD_ID)?.isLocal) {
      global = replaceThreadParam(
        global, chatId, MAIN_THREAD_ID, 'draft', result.draftsById[chatId],
      );
    }
  });

  const idsToUpdateReplyingToId = isFullDraftSync ? result.chatIds : Object.keys(result.replyingToById);
  idsToUpdateReplyingToId.forEach((chatId) => {
    global = replaceThreadParam(
      global, chatId, MAIN_THREAD_ID, 'replyingToId', result.replyingToById[chatId],
    );
  });

  if (chatIds.length === 0 && !global.chats.isFullyLoaded[listType]) {
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
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const result = await callApi('fetchFullChat', chat);
  if (!result) {
    return undefined;
  }

  const {
    users, userStatusesById, fullInfo, groupCall, membersCount,
  } = result;

  global = getGlobal();
  if (users) {
    global = addUsers(global, buildCollectionByKey(users, 'id'));
  }

  if (userStatusesById) {
    global = addUserStatuses(global, userStatusesById);
  }

  if (groupCall) {
    const existingGroupCall = selectGroupCall(global, groupCall.id!);
    global = updateGroupCall(
      global,
      groupCall.id!,
      omit(groupCall, ['connectionState']),
      undefined,
      existingGroupCall ? undefined : groupCall.participantsCount,
    );
  }

  global = updateChat(global, chat.id, {
    fullInfo,
    ...(membersCount && { membersCount }),
  });

  setGlobal(global);

  const stickerSet = fullInfo.stickerSet;
  if (stickerSet) {
    actions.loadStickers({
      stickerSetInfo: {
        id: stickerSet.id,
        accessHash: stickerSet.accessHash,
      },
      tabId,
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
) {
  global = getGlobal();
  const localChat = selectChatByUsername(global, username);
  if (localChat && !localChat.isMin) {
    return localChat;
  }

  const { chat, user } = await callApi('getChatByUsername', username) || {};
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
  setGlobal(global);

  if (user) {
    global = updateUser(global, user.id, user);
    setGlobal(global);
  }

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
      message: langProvider.translate('WebApp.AddToAttachmentUnavailableError'),
      tabId,
    });

    return undefined;
  }

  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  setGlobal(global);

  return result.bot;
}

async function openChatByUsername<T extends GlobalState>(
  global: T,
  actions: RequiredGlobalActions,
  username: string,
  threadId?: number,
  channelPostId?: number,
  startParam?: string,
  startAttach?: string | boolean,
  attach?: string,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  global = getGlobal();
  const currentChat = selectCurrentChat(global, tabId);

  // Attach in the current chat
  if (startAttach && !attach) {
    const bot = await getAttachBotOrNotify(global, actions, username, tabId);

    if (!currentChat || !bot) return;

    actions.callAttachBot({
      bot,
      chatId: currentChat.id,
      ...(typeof startAttach === 'string' && { startParam: startAttach }),
      tabId,
    });

    return;
  }

  const isCurrentChat = currentChat?.usernames?.some((c) => c.username === username);

  if (!isCurrentChat) {
    // Open temporary empty chat to make the click response feel faster
    actions.openChat({ id: TMP_CHAT_ID, tabId });
  }

  const chat = await fetchChatByUsername(global, username);
  if (!chat) {
    if (!isCurrentChat) {
      actions.openPreviousChat({ tabId });
      actions.showNotification({ message: 'User does not exist', tabId });
    }

    return;
  }

  if (channelPostId) {
    actions.focusMessage({
      chatId: chat.id, threadId, messageId: channelPostId, tabId,
    });
  } else if (!isCurrentChat) {
    actions.openChat({ id: chat.id, threadId, tabId });
  }

  if (startParam) {
    actions.startBot({ botId: chat.id, param: startParam });
  }

  if (attach) {
    global = getGlobal();
    openAttachMenuFromLink(global, actions, chat.id, attach, startAttach, tabId);
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

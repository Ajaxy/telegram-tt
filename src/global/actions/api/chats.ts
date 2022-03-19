import {
  addActionHandler, getActions, getGlobal, setGlobal,
} from '../../index';

import {
  ApiChat, ApiUser, ApiChatFolder, MAIN_THREAD_ID,
} from '../../../api/types';
import { NewChatMembersProgress, ChatCreationProgress, ManagementProgress } from '../../../types';
import { GlobalActions } from '../../types';

import {
  ARCHIVED_FOLDER_ID,
  TOP_CHAT_MESSAGES_PRELOAD_LIMIT,
  CHAT_LIST_LOAD_SLICE,
  TIPS_USERNAME,
  LOCALIZED_TIPS,
  RE_TG_LINK,
  SERVICE_NOTIFICATIONS_USER_ID,
  TMP_CHAT_ID, ALL_FOLDER_ID, DEBUG,
} from '../../../config';
import { callApi } from '../../../api/gramjs';
import {
  addChats, addUsers, addUserStatuses, replaceThreadParam,
  updateChatListIds, updateChats, updateChat, updateChatListSecondaryInfo,
  updateManagementProgress, leaveChat, replaceUsers, replaceUserStatuses,
  replaceChats, replaceChatListIds, addChatMembers,
} from '../../reducers';
import {
  selectChat, selectUser, selectChatListType, selectIsChatPinned,
  selectChatFolder, selectSupportChat, selectChatByUsername, selectThreadTopMessageId,
  selectCurrentMessageList, selectThreadInfo, selectCurrentChat, selectLastServiceNotification,
  selectVisibleUsers, selectUserByPhoneNumber,
} from '../../selectors';
import { buildCollectionByKey, omit } from '../../../util/iteratees';
import { debounce, pause, throttle } from '../../../util/schedulers';
import {
  isChatSummaryOnly, isChatArchived, isChatBasicGroup,
} from '../../helpers';
import { processDeepLink } from '../../../util/deeplink';
import { updateGroupCall } from '../../reducers/calls';
import { selectGroupCall } from '../../selectors/calls';
import { getOrderedIds } from '../../../util/folderManager';
import * as langProvider from '../../../util/langProvider';

const TOP_CHAT_MESSAGES_PRELOAD_INTERVAL = 100;
const INFINITE_LOOP_MARKER = 100;

const runThrottledForLoadTopChats = throttle((cb) => cb(), 3000, true);
const runDebouncedForLoadFullChat = debounce((cb) => cb(), 500, false, true);

addActionHandler('preloadTopChatMessages', async (global, actions) => {
  const preloadedChatIds = new Set<string>();

  for (let i = 0; i < TOP_CHAT_MESSAGES_PRELOAD_LIMIT; i++) {
    await pause(TOP_CHAT_MESSAGES_PRELOAD_INTERVAL);

    const { chatId: currentChatId } = selectCurrentMessageList(global) || {};
    const folderAllOrderedIds = getOrderedIds(ALL_FOLDER_ID);
    const nextChatId = folderAllOrderedIds?.find((id) => id !== currentChatId && !preloadedChatIds.has(id));
    if (!nextChatId) {
      return;
    }

    preloadedChatIds.add(nextChatId);

    actions.loadViewportMessages({ chatId: nextChatId, threadId: MAIN_THREAD_ID });
  }
});

addActionHandler('openChat', (global, actions, payload) => {
  const { id, threadId = MAIN_THREAD_ID } = payload;
  if (!id) {
    return;
  }

  const { currentUserId } = global;
  const chat = selectChat(global, id);

  if (chat?.hasUnreadMark) {
    actions.toggleChatUnread({ id });
  }

  // Please telegram send us some updates about linked chat 🙏
  if (chat && chat.lastMessage && chat.lastMessage.threadInfo) {
    actions.requestThreadInfoUpdate({
      chatId: chat.lastMessage.threadInfo.chatId,
      threadId: chat.lastMessage.threadInfo.threadId,
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

addActionHandler('openLinkedChat', async (global, actions, payload) => {
  const { id } = payload!;
  const chat = selectChat(global, id);
  if (!chat) {
    return;
  }

  const chatFullInfo = await callApi('fetchFullChat', chat);

  if (chatFullInfo?.fullInfo?.linkedChatId) {
    actions.openChat({ id: chatFullInfo.fullInfo.linkedChatId });
  }
});

addActionHandler('focusMessageInComments', async (global, actions, payload) => {
  const { chatId, threadId, messageId } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const result = await callApi('requestThreadInfoUpdate', { chat, threadId });
  if (!result) {
    return;
  }

  actions.focusMessage({ chatId, threadId, messageId });
});

addActionHandler('openSupportChat', async (global, actions) => {
  const chat = selectSupportChat(global);
  if (chat) {
    actions.openChat({ id: chat.id, shouldReplaceHistory: true });
    return;
  }

  actions.openChat({ id: TMP_CHAT_ID, shouldReplaceHistory: true });

  const result = await callApi('fetchChat', { type: 'support' });
  if (result) {
    actions.openChat({ id: result.chatId, shouldReplaceHistory: true });
  }
});

addActionHandler('openTipsChat', (global, actions, payload) => {
  const { langCode } = payload;

  const usernamePostfix = langCode === 'pt-br'
    ? 'BR'
    : LOCALIZED_TIPS.includes(langCode) ? (langCode as string).toUpperCase() : '';

  actions.openChatByUsername({ username: `${TIPS_USERNAME}${usernamePostfix}` });
});

addActionHandler('loadAllChats', async (global, actions, payload) => {
  const listType = payload.listType as 'active' | 'archived';
  const { onReplace } = payload;
  let { shouldReplace } = payload;
  let i = 0;

  while (shouldReplace || !getGlobal().chats.isFullyLoaded[listType]) {
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
        .filter((chat) => Boolean(chat?.lastMessage) && !selectIsChatPinned(global, chat.id))
        /* eslint-enable @typescript-eslint/no-loop-func */
        .sort((chat1, chat2) => (chat1.lastMessage!.date - chat2.lastMessage!.date))[0]
      : undefined;

    await loadChats(listType, oldestChat?.id, oldestChat?.lastMessage!.date, shouldReplace);

    if (shouldReplace) {
      onReplace?.();
      shouldReplace = false;
    }
  }
});

addActionHandler('loadFullChat', (global, actions, payload) => {
  const { chatId, force } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  if (force) {
    loadFullChat(chat);
  } else {
    runDebouncedForLoadFullChat(() => loadFullChat(chat));
  }
});

addActionHandler('loadTopChats', () => {
  runThrottledForLoadTopChats(() => loadChats('active'));
});

addActionHandler('requestChatUpdate', (global, actions, payload) => {
  const { serverTimeOffset } = global;
  const { chatId } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  void callApi('requestChatUpdate', {
    chat,
    serverTimeOffset,
    ...(chatId === SERVICE_NOTIFICATIONS_USER_ID && {
      lastLocalMessage: selectLastServiceNotification(global)?.message,
    }),
  });
});

addActionHandler('updateChatMutedState', (global, actions, payload) => {
  const { serverTimeOffset } = global;
  const { chatId, isMuted } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  setGlobal(updateChat(global, chatId, { isMuted }));
  void callApi('updateChatMutedState', { chat, isMuted, serverTimeOffset });
});

addActionHandler('createChannel', (global, actions, payload) => {
  const {
    title, about, photo, memberIds,
  } = payload!;

  const members = (memberIds as string[])
    .map((id) => selectUser(global, id))
    .filter<ApiUser>(Boolean as any);

  void createChannel(title, members, about, photo);
});

addActionHandler('joinChannel', (global, actions, payload) => {
  const { chatId } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  const { id: channelId, accessHash } = chat;

  if (channelId && accessHash) {
    void callApi('joinChannel', { channelId, accessHash });
  }
});

addActionHandler('deleteChatUser', (global, actions, payload) => {
  const { chatId, userId }: { chatId: string; userId: string } = payload!;
  const chat = selectChat(global, chatId);
  const user = selectUser(global, userId);
  if (!chat || !user) {
    return;
  }

  global = leaveChat(global, chatId);
  setGlobal(global);

  if (selectCurrentMessageList(global)?.chatId === chatId) {
    actions.openChat({ id: undefined });
  }

  void callApi('deleteChatUser', { chat, user });
});

addActionHandler('deleteChat', (global, actions, payload) => {
  const { chatId }: { chatId: string } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  global = leaveChat(global, chatId);
  setGlobal(global);

  if (selectCurrentMessageList(global)?.chatId === chatId) {
    actions.openChat({ id: undefined });
  }

  void callApi('deleteChat', { chatId: chat.id });
});

addActionHandler('leaveChannel', (global, actions, payload) => {
  const { chatId } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  global = leaveChat(global, chatId);
  setGlobal(global);

  if (selectCurrentMessageList(global)?.chatId === chatId) {
    actions.openChat({ id: undefined });
  }

  const { id: channelId, accessHash } = chat;
  if (channelId && accessHash) {
    void callApi('leaveChannel', { channelId, accessHash });
  }
});

addActionHandler('deleteChannel', (global, actions, payload) => {
  const { chatId } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  global = leaveChat(global, chatId);
  setGlobal(global);

  if (selectCurrentMessageList(global)?.chatId === chatId) {
    actions.openChat({ id: undefined });
  }

  const { id: channelId, accessHash } = chat;
  if (channelId && accessHash) {
    void callApi('deleteChannel', { channelId, accessHash });
  }
});

addActionHandler('createGroupChat', (global, actions, payload) => {
  const { title, memberIds, photo } = payload!;
  const members = (memberIds as string[])
    .map((id) => selectUser(global, id))
    .filter<ApiUser>(Boolean as any);

  void createGroupChat(title, members, photo);
});

addActionHandler('toggleChatPinned', (global, actions, payload) => {
  const { id, folderId } = payload!;
  const chat = selectChat(global, id);
  if (!chat) {
    return;
  }

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
    void callApi('toggleChatPinned', { chat, shouldBePinned: !isPinned });
  }
});

addActionHandler('toggleChatArchived', (global, actions, payload) => {
  const { id } = payload!;
  const chat = selectChat(global, id);
  if (chat) {
    void callApi('toggleChatArchived', {
      chat,
      folderId: isChatArchived(chat) ? 0 : ARCHIVED_FOLDER_ID,
    });
  }
});

addActionHandler('loadChatFolders', () => {
  void loadChatFolders();
});

addActionHandler('loadRecommendedChatFolders', () => {
  void loadRecommendedChatFolders();
});

addActionHandler('editChatFolders', (global, actions, payload) => {
  const { chatId, idsToRemove, idsToAdd } = payload!;

  (idsToRemove as number[]).forEach(async (id) => {
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

  (idsToAdd as number[]).forEach(async (id) => {
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

addActionHandler('editChatFolder', (global, actions, payload) => {
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

addActionHandler('addChatFolder', (global, actions, payload) => {
  const { folder } = payload!;
  const { orderedIds } = global.chatFolders;
  const maxId = orderedIds?.length ? Math.max.apply(Math.max, orderedIds) : ARCHIVED_FOLDER_ID;

  void createChatFolder(folder, maxId);
});

addActionHandler('deleteChatFolder', (global, actions, payload) => {
  const { id } = payload!;
  const folder = selectChatFolder(global, id);

  if (folder) {
    void deleteChatFolder(id);
  }
});

addActionHandler('toggleChatUnread', (global, actions, payload) => {
  const { id } = payload!;
  const { serverTimeOffset } = global;
  const chat = selectChat(global, id);
  if (chat) {
    if (chat.unreadCount) {
      void callApi('markMessageListRead', { serverTimeOffset, chat, threadId: MAIN_THREAD_ID });
    } else {
      void callApi('toggleDialogUnread', {
        chat,
        hasUnreadMark: !chat.hasUnreadMark,
      });
    }
  }
});

addActionHandler('openChatByInvite', async (global, actions, payload) => {
  const { hash } = payload!;

  const result = await callApi('openChatByInvite', hash);
  if (!result) {
    return;
  }

  actions.openChat({ id: result.chatId });
});

addActionHandler('openChatByPhoneNumber', async (global, actions, payload) => {
  const { phoneNumber } = payload!;

  // Open temporary empty chat to make the click response feel faster
  actions.openChat({ id: TMP_CHAT_ID });

  const chat = await fetchChatByPhoneNumber(phoneNumber);
  if (!chat) {
    actions.openPreviousChat();
    actions.showNotification({
      message: langProvider.getTranslation('lng_username_by_phone_not_found').replace('{phone}', phoneNumber),
    });
    return;
  }

  actions.openChat({ id: chat.id });
});

addActionHandler('openTelegramLink', (global, actions, payload) => {
  const { url } = payload!;
  if (url.match(RE_TG_LINK)) {
    processDeepLink(url.match(RE_TG_LINK)[0]);
    return;
  }

  const uri = new URL(url.startsWith('http') ? url : `https://${url}`);
  const [part1, part2, part3] = uri.pathname.split('/').filter(Boolean).map((l) => decodeURI(l));
  const params = Object.fromEntries(uri.searchParams);

  let hash: string | undefined;
  if (part1 === 'joinchat') {
    hash = part2;
  }

  if (part1.match(/^\+([0-9]+)(\?|$)/)) {
    actions.openChatByPhoneNumber({ phoneNumber: part1.substr(1, part1.length - 1) });
    return;
  }

  if (part1.startsWith(' ') || part1.startsWith('+')) {
    hash = part1.substr(1, part1.length - 1);
  }

  if (hash) {
    actions.openChatByInvite({ hash });
    return;
  }

  if (part1 === 'addstickers') {
    actions.openStickerSetShortName({
      stickerSetShortName: part2,
    });
    return;
  }

  const chatOrChannelPostId = part2 || undefined;
  const messageId = part3 ? Number(part3) : undefined;
  const commentId = params.comment ? Number(params.comment) : undefined;

  if (params.hasOwnProperty('voicechat') || params.hasOwnProperty('livestream')) {
    actions.joinVoiceChatByLink({
      username: part1,
      inviteHash: params.voicechat || params.livestream,
    });
  } else if (part1 === 'c' && chatOrChannelPostId && messageId) {
    const chatId = `-${chatOrChannelPostId}`;
    const chat = selectChat(global, chatId);
    if (!chat) {
      actions.showNotification({ message: 'Chat does not exist' });
      return;
    }

    actions.focusMessage({
      chatId,
      messageId,
    });
  } else {
    actions.openChatByUsername({
      username: part1,
      messageId: messageId || Number(chatOrChannelPostId),
      commentId,
      startParam: params.start,
    });
  }
});

addActionHandler('acceptInviteConfirmation', async (global, actions, payload) => {
  const { hash } = payload!;
  const result = await callApi('importChatInvite', { hash });
  if (!result) {
    return;
  }

  actions.openChat({ id: result.id });
});

addActionHandler('openChatByUsername', async (global, actions, payload) => {
  const {
    username, messageId, commentId, startParam,
  } = payload!;

  const chat = selectCurrentChat(global);

  if (!commentId) {
    if (chat && chat.username === username) {
      actions.focusMessage({ chatId: chat.id, messageId });
      return;
    }
    await openChatByUsername(actions, username, messageId, startParam);
    return;
  }

  const { chatId, type } = selectCurrentMessageList(global) || {};
  const usernameChat = selectChatByUsername(global, username);
  if (chatId && usernameChat && type === 'thread') {
    const threadInfo = selectThreadInfo(global, chatId, messageId);

    if (threadInfo && threadInfo.chatId === chatId) {
      actions.focusMessage({
        chatId: threadInfo.chatId,
        threadId: threadInfo.threadId,
        messageId: commentId,
      });
      return;
    }
  }

  if (!messageId) return;

  void openCommentsByUsername(actions, username, messageId, commentId);
});

addActionHandler('togglePreHistoryHidden', async (global, actions, payload) => {
  const { chatId, isEnabled } = payload!;

  let chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  if (isChatBasicGroup(chat)) {
    chat = await callApi('migrateChat', chat);

    if (!chat) {
      return;
    }

    actions.openChat({ id: chat.id });
  }

  void callApi('togglePreHistoryHidden', { chat, isEnabled });
});

addActionHandler('updateChatDefaultBannedRights', (global, actions, payload) => {
  const { chatId, bannedRights } = payload!;
  const chat = selectChat(global, chatId);

  if (!chat) {
    return;
  }

  void callApi('updateChatDefaultBannedRights', { chat, bannedRights });
});

addActionHandler('updateChatMemberBannedRights', async (global, actions, payload) => {
  const { chatId, userId, bannedRights } = payload!;
  let chat = selectChat(global, chatId);
  const user = selectUser(global, userId);

  if (!chat || !user) {
    return undefined;
  }

  if (isChatBasicGroup(chat)) {
    chat = await callApi('migrateChat', chat);

    if (!chat) {
      return undefined;
    }

    actions.openChat({ id: chat.id });
  }

  await callApi('updateChatMemberBannedRights', { chat, user, bannedRights });

  global = getGlobal();

  const chatAfterUpdate = selectChat(global, chatId);

  if (!chatAfterUpdate || !chatAfterUpdate.fullInfo) {
    return undefined;
  }

  const { members, kickedMembers } = chatAfterUpdate.fullInfo;

  const isBanned = Boolean(bannedRights.viewMessages);
  const isUnblocked = !Object.keys(bannedRights).length;

  return updateChat(global, chatId, {
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
});

addActionHandler('updateChatAdmin', async (global, actions, payload) => {
  const {
    chatId, userId, adminRights, customTitle,
  } = payload!;

  let chat = selectChat(global, chatId);
  const user = selectUser(global, userId);
  if (!chat || !user) {
    return undefined;
  }

  if (isChatBasicGroup(chat)) {
    chat = await callApi('migrateChat', chat);
    if (!chat) {
      return undefined;
    }

    actions.openChat({ id: chat.id });
  }

  await callApi('updateChatAdmin', {
    chat, user, adminRights, customTitle,
  });

  const chatAfterUpdate = await callApi('fetchFullChat', chat);
  if (!chatAfterUpdate?.fullInfo) {
    return undefined;
  }

  const { adminMembers } = chatAfterUpdate.fullInfo;
  const isDismissed = !Object.keys(adminRights).length;

  global = getGlobal();

  return updateChat(global, chatId, {
    fullInfo: {
      ...chatAfterUpdate.fullInfo,
      ...(adminMembers && isDismissed && {
        adminMembers: adminMembers.filter((m) => m.userId !== userId),
      }),
      ...(adminMembers && !isDismissed && {
        adminMembers: adminMembers.map((m) => (
          m.userId === userId
            ? { ...m, adminRights, customTitle }
            : m
        )),
      }),
    },
  });
});

addActionHandler('updateChat', async (global, actions, payload) => {
  const {
    chatId, title, about, photo,
  } = payload!;

  const chat = selectChat(global, chatId);
  if (!chat) {
    return undefined;
  }

  setGlobal(updateManagementProgress(getGlobal(), ManagementProgress.InProgress));

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

  return updateManagementProgress(getGlobal(), ManagementProgress.Complete);
});

addActionHandler('toggleSignatures', (global, actions, payload) => {
  const { chatId, isEnabled } = payload!;
  const chat = selectChat(global, chatId);

  if (!chat) {
    return;
  }

  void callApi('toggleSignatures', { chat, isEnabled });
});

addActionHandler('loadGroupsForDiscussion', async (global) => {
  const groups = await callApi('fetchGroupsForDiscussion');
  if (!groups) {
    return undefined;
  }

  const addedById = groups.reduce((result, group) => {
    if (group) {
      result[group.id] = group;
    }

    return result;
  }, {} as Record<string, ApiChat>);

  global = getGlobal();
  global = addChats(global, addedById);
  return {
    ...global,
    chats: {
      ...global.chats,
      forDiscussionIds: Object.keys(addedById),
    },
  };
});

addActionHandler('linkDiscussionGroup', async (global, actions, payload) => {
  const { channelId, chatId } = payload!;

  const channel = selectChat(global, channelId);
  let chat = selectChat(global, chatId);
  if (!channel || !chat) {
    return;
  }

  if (isChatBasicGroup(chat)) {
    chat = await callApi('migrateChat', chat);

    if (!chat) {
      return;
    }

    actions.openChat({ id: chat.id });
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
    await callApi('togglePreHistoryHidden', { chat, isEnabled: false });
  }

  void callApi('setDiscussionGroup', { channel, chat });
});

addActionHandler('unlinkDiscussionGroup', async (global, actions, payload) => {
  const { channelId } = payload!;

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
    loadFullChat(chat);
  }
});

addActionHandler('setActiveChatFolder', (global, actions, payload) => {
  return {
    ...global,
    chatFolders: {
      ...global.chatFolders,
      activeChatFolder: payload,
    },
  };
});

addActionHandler('loadMoreMembers', async (global) => {
  const { chatId } = selectCurrentMessageList(global) || {};
  const chat = chatId ? selectChat(global, chatId) : undefined;
  if (!chat || isChatBasicGroup(chat)) {
    return undefined;
  }

  const offset = (chat.fullInfo?.members?.length) || undefined;
  const result = await callApi('fetchMembers', chat.id, chat.accessHash!, 'recent', offset);
  if (!result) {
    return undefined;
  }

  const { members, users } = result;
  if (!members || !members.length) {
    return undefined;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = addChatMembers(global, chat, members);
  return global;
});

addActionHandler('addChatMembers', async (global, actions, payload) => {
  const { chatId, memberIds } = payload;
  const chat = selectChat(global, chatId);
  const users = (memberIds as string[]).map((userId) => selectUser(global, userId)).filter<ApiUser>(Boolean as any);

  if (!chat || !users.length) {
    return;
  }

  actions.setNewChatMembersDialogState(NewChatMembersProgress.Loading);
  await callApi('addChatMembers', chat, users);
  actions.setNewChatMembersDialogState(NewChatMembersProgress.Closed);
  loadFullChat(chat);
});

addActionHandler('deleteChatMember', async (global, actions, payload) => {
  const { chatId, userId } = payload;
  const chat = selectChat(global, chatId);
  const user = selectUser(global, userId);

  if (!chat || !user) {
    return;
  }

  await callApi('deleteChatMember', chat, user);
  loadFullChat(chat);
});

addActionHandler('toggleIsProtected', (global, actions, payload) => {
  const { chatId, isProtected } = payload;
  const chat = selectChat(global, chatId);

  if (!chat) {
    return;
  }

  void callApi('toggleIsProtected', { chat, isProtected });
});

addActionHandler('setChatEnabledReactions', async (global, actions, payload) => {
  const { chatId, enabledReactions } = payload;
  const chat = selectChat(global, chatId);
  if (!chat) return;

  await callApi('setChatEnabledReactions', {
    chat,
    enabledReactions,
  });

  void loadFullChat(chat);
});

addActionHandler('loadChatSettings', async (global, actions, payload) => {
  const { chatId } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) return undefined;

  const settings = await callApi('fetchChatSettings', chat);
  if (!settings) return undefined;

  return updateChat(getGlobal(), chat.id, { settings });
});

async function loadChats(
  listType: 'active' | 'archived', offsetId?: string, offsetDate?: number, shouldReplace = false,
) {
  let global = getGlobal();

  const result = await callApi('fetchChats', {
    limit: CHAT_LIST_LOAD_SLICE,
    offsetDate,
    archived: listType === 'archived',
    withPinned: shouldReplace,
    serverTimeOffset: global.serverTimeOffset,
    lastLocalServiceMessage: selectLastServiceNotification(global)?.message,
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
    const currentChat = selectCurrentChat(global);
    const visibleChats = currentChat ? [currentChat] : [];

    const visibleUsers = selectVisibleUsers(global) || [];
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

  Object.keys(result.draftsById).forEach((chatId) => {
    global = replaceThreadParam(
      global, chatId, MAIN_THREAD_ID, 'draft', result.draftsById[chatId],
    );
  });

  Object.keys(result.replyingToById).forEach((chatId) => {
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

export async function loadFullChat(chat: ApiChat) {
  const result = await callApi('fetchFullChat', chat);
  if (!result) {
    return undefined;
  }

  const {
    users, fullInfo, groupCall, membersCount,
  } = result;

  let global = getGlobal();
  if (users) {
    global = addUsers(global, buildCollectionByKey(users, 'id'));
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

  return result;
}

async function createChannel(title: string, users: ApiUser[], about?: string, photo?: File) {
  setGlobal({
    ...getGlobal(),
    chatCreation: {
      progress: ChatCreationProgress.InProgress,
    },
  });

  const createdChannel = await callApi('createChannel', { title, about, users });
  if (!createdChannel) {
    return;
  }

  const { id: channelId, accessHash } = createdChannel;

  let global = getGlobal();
  global = updateChat(global, channelId, createdChannel);
  global = {
    ...global,
    chatCreation: {
      ...global.chatCreation,
      progress: createdChannel ? ChatCreationProgress.Complete : ChatCreationProgress.Error,
    },
  };
  setGlobal(global);
  getActions().openChat({ id: channelId, shouldReplaceHistory: true });

  if (channelId && accessHash && photo) {
    await callApi('editChatPhoto', { chatId: channelId, accessHash, photo });
  }
}

async function createGroupChat(title: string, users: ApiUser[], photo?: File) {
  setGlobal({
    ...getGlobal(),
    chatCreation: {
      progress: ChatCreationProgress.InProgress,
    },
  });

  try {
    const createdChat = await callApi('createGroupChat', {
      title,
      users,
    });

    if (!createdChat) {
      return;
    }

    const { id: chatId } = createdChat;

    let global = getGlobal();
    global = updateChat(global, chatId, createdChat);
    global = {
      ...global,
      chatCreation: {
        ...global.chatCreation,
        progress: createdChat ? ChatCreationProgress.Complete : ChatCreationProgress.Error,
      },
    };
    setGlobal(global);
    getActions()
      .openChat({
        id: chatId,
        shouldReplaceHistory: true,
      });

    if (chatId && photo) {
      await callApi('editChatPhoto', {
        chatId,
        photo,
      });
    }
  } catch (e: any) {
    if (e.message === 'USERS_TOO_FEW') {
      const global = getGlobal();
      setGlobal({
        ...global,
        chatCreation: {
          ...global.chatCreation,
          progress: ChatCreationProgress.Error,
          error: 'CreateGroupError',
        },
      });
    }
  }
}

async function loadChatFolders() {
  const chatFolders = await callApi('fetchChatFolders');

  if (chatFolders) {
    const global = getGlobal();

    setGlobal({
      ...global,
      chatFolders: {
        ...global.chatFolders,
        ...chatFolders,
      },
    });
  }
}

async function loadRecommendedChatFolders() {
  const recommendedChatFolders = await callApi('fetchRecommendedChatFolders');

  if (recommendedChatFolders) {
    const global = getGlobal();

    setGlobal({
      ...global,
      chatFolders: {
        ...global.chatFolders,
        recommended: recommendedChatFolders,
      },
    });
  }
}

async function createChatFolder(folder: ApiChatFolder, maxId: number) {
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

  const global = getGlobal();
  const { recommended } = global.chatFolders;

  if (recommended) {
    setGlobal({
      ...global,
      chatFolders: {
        ...global.chatFolders,
        recommended: recommended.filter(({ id }) => id !== recommendedId),
      },
    });
  }
}

async function deleteChatFolder(id: number) {
  await callApi('deleteChatFolder', id);
}

export async function fetchChatByUsername(
  username: string,
) {
  const global = getGlobal();
  const localChat = selectChatByUsername(global, username);
  if (localChat && !localChat.isMin) {
    return localChat;
  }

  const chat = await callApi('getChatByUsername', username);
  if (!chat) {
    return undefined;
  }

  setGlobal(updateChat(getGlobal(), chat.id, chat));

  return chat;
}

export async function fetchChatByPhoneNumber(phoneNumber: string) {
  const global = getGlobal();
  const localUser = selectUserByPhoneNumber(global, phoneNumber);
  if (localUser && !localUser.isMin) {
    return selectChat(global, localUser.id);
  }

  const chat = await callApi('getChatByPhoneNumber', phoneNumber);
  if (!chat) {
    return undefined;
  }

  setGlobal(updateChat(getGlobal(), chat.id, chat));

  return chat;
}

async function openChatByUsername(
  actions: GlobalActions,
  username: string,
  channelPostId?: number,
  startParam?: string,
) {
  // Open temporary empty chat to make the click response feel faster
  actions.openChat({ id: TMP_CHAT_ID });

  const chat = await fetchChatByUsername(username);

  if (!chat) {
    actions.openPreviousChat();
    actions.showNotification({ message: 'User does not exist' });
    return;
  }

  if (channelPostId) {
    actions.focusMessage({ chatId: chat.id, messageId: channelPostId });
  } else {
    actions.openChat({ id: chat.id });
  }
  if (startParam) {
    actions.startBot({ botId: chat.id, param: startParam });
  }
}

async function openCommentsByUsername(
  actions: GlobalActions,
  username: string,
  messageId: number,
  commentId: number,
) {
  actions.openChat({ id: TMP_CHAT_ID });

  const chat = await fetchChatByUsername(username);

  if (!chat) return;

  const global = getGlobal();

  const threadInfo = selectThreadInfo(global, chat.id, messageId);
  let discussionChatId: string | undefined;

  if (!threadInfo) {
    const result = await callApi('requestThreadInfoUpdate', { chat, threadId: messageId });
    if (!result) return;

    discussionChatId = result.discussionChatId;
  } else {
    discussionChatId = threadInfo.chatId;
  }

  if (!discussionChatId) return;

  actions.focusMessage({
    chatId: discussionChatId,
    threadId: messageId,
    messageId: Number(commentId),
  });
}

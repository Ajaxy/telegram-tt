import {
  addReducer, getDispatch, getGlobal, setGlobal,
} from '../../../lib/teact/teactn';

import {
  ApiChat, ApiUser, ApiChatFolder, MAIN_THREAD_ID,
} from '../../../api/types';
import { NewChatMembersProgress, ChatCreationProgress, ManagementProgress } from '../../../types';
import { GlobalActions } from '../../../global/types';

import {
  ARCHIVED_FOLDER_ID,
  TOP_CHAT_MESSAGES_PRELOAD_LIMIT,
  CHAT_LIST_LOAD_SLICE,
  RE_TME_INVITE_LINK,
  RE_TME_LINK,
  TIPS_USERNAME,
  LOCALIZED_TIPS,
} from '../../../config';
import { callApi } from '../../../api/gramjs';
import {
  addChats,
  addUsers,
  replaceThreadParam,
  updateChatListIds,
  updateChats,
  updateChat,
  updateChatListSecondaryInfo,
  updateManagementProgress,
} from '../../reducers';
import {
  selectChat,
  selectCurrentChat,
  selectUser,
  selectChatListType,
  selectIsChatPinned,
  selectChatFolder,
  selectSupportChat,
  selectChatByUsername,
  selectThreadTopMessageId,
  selectCurrentMessageList,
} from '../../selectors';
import { buildCollectionByKey } from '../../../util/iteratees';
import { debounce, pause, throttle } from '../../../util/schedulers';
import {
  isChatSummaryOnly, isChatArchived, prepareChatList, isChatBasicGroup,
} from '../../helpers';

const TOP_CHATS_PRELOAD_PAUSE = 100;
// We expect this ID does not exist
const TMP_CHAT_ID = -1;

const runThrottledForLoadChats = throttle((cb) => cb(), 1000, true);
const runThrottledForLoadTopChats = throttle((cb) => cb(), 3000, true);
const runDebouncedForLoadFullChat = debounce((cb) => cb(), 500, false, true);

addReducer('preloadTopChatMessages', (global, actions) => {
  (async () => {
    const preloadedChatIds: number[] = [];

    for (let i = 0; i < TOP_CHAT_MESSAGES_PRELOAD_LIMIT; i++) {
      await pause(TOP_CHATS_PRELOAD_PAUSE);

      const {
        byId,
        listIds: { active: listIds },
        orderedPinnedIds: { active: orderedPinnedIds },
      } = getGlobal().chats;
      if (!listIds) {
        return;
      }

      const { chatId: currentChatId } = selectCurrentMessageList(global) || {};
      const { pinnedChats, otherChats } = prepareChatList(byId, listIds, orderedPinnedIds);
      const topChats = [...pinnedChats, ...otherChats];
      const chatToPreload = topChats.find(({ id }) => id !== currentChatId && !preloadedChatIds.includes(id));
      if (!chatToPreload) {
        return;
      }

      preloadedChatIds.push(chatToPreload.id);

      actions.loadViewportMessages({ chatId: chatToPreload.id, threadId: MAIN_THREAD_ID });
    }
  })();
});

addReducer('openChat', (global, actions, payload) => {
  const { id, threadId } = payload!;
  const { currentUserId } = global;
  const chat = selectChat(global, id);

  if (chat && chat.hasUnreadMark) {
    actions.toggleChatUnread({ id });
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

addReducer('openSupportChat', (global, actions) => {
  const chat = selectSupportChat(global);

  actions.openChat({ id: chat ? chat.id : TMP_CHAT_ID });

  if (chat) {
    return;
  }

  (async () => {
    const result = await callApi('fetchChat', { type: 'support' });
    if (result) {
      actions.openChat({ id: result.chatId });
    }
  })();
});

addReducer('openTipsChat', (global, actions, payload) => {
  const { langCode } = payload;

  const usernamePostfix = langCode === 'pt-br'
    ? 'BR'
    : LOCALIZED_TIPS.includes(langCode) ? (langCode as string).toUpperCase() : '';

  actions.openChatByUsername({ username: `${TIPS_USERNAME}${usernamePostfix}` });
});

addReducer('loadMoreChats', (global, actions, payload) => {
  const { listType = 'active' } = payload!;
  const listIds = global.chats.listIds[listType as ('active' | 'archived')];
  const isFullyLoaded = global.chats.isFullyLoaded[listType as ('active' | 'archived')];

  if (isFullyLoaded) {
    return;
  }

  const oldestChat = listIds
    ? listIds
      .map((id) => global.chats.byId[id])
      .filter((chat) => Boolean(chat && chat.lastMessage) && !selectIsChatPinned(global, chat.id))
      .sort((chat1, chat2) => (chat1.lastMessage!.date - chat2.lastMessage!.date))[0]
    : undefined;

  if (oldestChat) {
    runThrottledForLoadChats(() => loadChats(listType, oldestChat.id, oldestChat.lastMessage!.date));
  } else {
    runThrottledForLoadChats(() => loadChats(listType));
  }
});

addReducer('loadFullChat', (global, actions, payload) => {
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

addReducer('loadTopChats', () => {
  runThrottledForLoadTopChats(() => loadChats('active'));
});

addReducer('requestChatUpdate', (global, actions, payload) => {
  const { serverTimeOffset } = global;
  const { chatId } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  void callApi('requestChatUpdate', {
    chat,
    serverTimeOffset,
  });
});

addReducer('updateChatMutedState', (global, actions, payload) => {
  const { serverTimeOffset } = global;
  const { chatId, isMuted } = payload!;
  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  setGlobal(updateChat(global, chatId, { isMuted }));
  void callApi('updateChatMutedState', { chat, isMuted, serverTimeOffset });
});

addReducer('createChannel', (global, actions, payload) => {
  const {
    title, about, photo, memberIds,
  } = payload!;

  const members = (memberIds as number[])
    .map((id: number) => selectUser(global, id))
    .filter<ApiUser>(Boolean as any);

  void createChannel(title, members, about, photo);
});

addReducer('joinChannel', (global, actions, payload) => {
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

addReducer('deleteChatUser', (global, actions, payload) => {
  (async () => {
    const { chatId, userId } : { chatId: number; userId: number } = payload!;
    const chat = selectChat(global, chatId);
    const user = selectUser(global, userId);
    if (!chat || !user) {
      return;
    }
    await callApi('deleteChatUser', { chat, user });

    const activeChat = selectCurrentMessageList(global);
    if (activeChat && activeChat.chatId === chatId && global.currentUserId === userId) {
      actions.openChat({ id: undefined });
    }
  })();
});

addReducer('deleteChat', (global, actions, payload) => {
  (async () => {
    const { chatId } : { chatId: number } = payload!;
    const chat = selectChat(global, chatId);
    if (!chat) {
      return;
    }
    await callApi('deleteChat', { chatId: chat.id });

    const activeChat = selectCurrentMessageList(global);
    if (activeChat && activeChat.chatId === chatId) {
      actions.openChat({ id: undefined });
    }
  })();
});

addReducer('leaveChannel', (global, actions, payload) => {
  (async () => {
    const { chatId } = payload!;
    const chat = selectChat(global, chatId);
    if (!chat) {
      return;
    }

    const { id: channelId, accessHash } = chat;

    if (channelId && accessHash) {
      await callApi('leaveChannel', { channelId, accessHash });
    }

    const activeChannel = selectCurrentMessageList(global);
    if (activeChannel && activeChannel.chatId === chatId) {
      actions.openChat({ id: undefined });
    }
  })();
});

addReducer('deleteChannel', (global, actions, payload) => {
  (async () => {
    const { chatId } = payload!;
    const chat = selectChat(global, chatId);
    if (!chat) {
      return;
    }

    const { id: channelId, accessHash } = chat;

    if (channelId && accessHash) {
      await callApi('deleteChannel', { channelId, accessHash });
    }

    const activeChannel = selectCurrentMessageList(global);
    if (activeChannel && activeChannel.chatId === chatId) {
      actions.openChat({ id: undefined });
    }
  })();
});

addReducer('createGroupChat', (global, actions, payload) => {
  const { title, memberIds, photo } = payload!;
  const members = (memberIds as number[])
    .map((id: number) => selectUser(global, id))
    .filter<ApiUser>(Boolean as any);

  void createGroupChat(title, members, photo);
});

addReducer('toggleChatPinned', (global, actions, payload) => {
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

addReducer('toggleChatArchived', (global, actions, payload) => {
  const { id } = payload!;
  const chat = selectChat(global, id);
  if (chat) {
    void callApi('toggleChatArchived', {
      chat,
      folderId: isChatArchived(chat) ? 0 : ARCHIVED_FOLDER_ID,
    });
  }
});

addReducer('loadChatFolders', () => {
  void loadChatFolders();
});

addReducer('loadRecommendedChatFolders', () => {
  void loadRecommendedChatFolders();
});

addReducer('editChatFolder', (global, actions, payload) => {
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

addReducer('addChatFolder', (global, actions, payload) => {
  const { folder } = payload!;
  const { orderedIds } = global.chatFolders;
  const maxId = orderedIds && orderedIds.length ? Math.max.apply(Math.max, orderedIds) : ARCHIVED_FOLDER_ID;

  void createChatFolder(folder, maxId);
});

addReducer('deleteChatFolder', (global, actions, payload) => {
  const { id } = payload!;
  const folder = selectChatFolder(global, id);

  if (folder) {
    void deleteChatFolder(id);
  }
});

addReducer('toggleChatUnread', (global, actions, payload) => {
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

addReducer('openTelegramLink', (global, actions, payload) => {
  const { url } = payload!;
  let match = RE_TME_INVITE_LINK.exec(url);

  if (match) {
    const hash = match[1];

    (async () => {
      const result = await callApi('openChatByInvite', hash);
      if (!result) {
        return;
      }

      actions.openChat({ id: result.chatId });
    })();
  } else {
    match = RE_TME_LINK.exec(url)!;

    const username = match[1];
    const chatOrChannelPostId = match[2] ? Number(match[2]) : undefined;
    const messageId = match[3] ? Number(match[3]) : undefined;

    // Open message in private chat
    if (username === 'c' && chatOrChannelPostId && messageId) {
      actions.focusMessage({ chatId: -chatOrChannelPostId, messageId });
    } else {
      void openChatByUsername(actions, username, chatOrChannelPostId);
    }
  }
});

addReducer('acceptInviteConfirmation', (global, actions, payload) => {
  const { hash } = payload!;
  (async () => {
    const result = await callApi('importChatInvite', { hash });
    if (!result) {
      return;
    }

    actions.openChat({ id: result.id });
  })();
});

addReducer('openChatByUsername', (global, actions, payload) => {
  const { username } = payload!;

  void openChatByUsername(actions, username);
});

addReducer('togglePreHistoryHidden', (global, actions, payload) => {
  const { chatId, isEnabled } = payload!;
  let chat = selectChat(global, chatId);

  if (!chat) {
    return;
  }

  (async () => {
    if (isChatBasicGroup(chat)) {
      chat = await callApi('migrateChat', chat);

      if (!chat) {
        return;
      }

      actions.openChat({ id: chat.id });
    }

    void callApi('togglePreHistoryHidden', { chat, isEnabled });
  })();
});

addReducer('updateChatDefaultBannedRights', (global, actions, payload) => {
  const { chatId, bannedRights } = payload!;
  const chat = selectChat(global, chatId);

  if (!chat) {
    return;
  }

  void callApi('updateChatDefaultBannedRights', { chat, bannedRights });
});

addReducer('updateChatMemberBannedRights', (global, actions, payload) => {
  const { chatId, userId, bannedRights } = payload!;
  let chat = selectChat(global, chatId);
  const user = selectUser(global, userId);

  if (!chat || !user) {
    return;
  }

  (async () => {
    if (isChatBasicGroup(chat)) {
      chat = await callApi('migrateChat', chat);

      if (!chat) {
        return;
      }

      actions.openChat({ id: chat.id });
    }

    await callApi('updateChatMemberBannedRights', { chat, user, bannedRights });

    const newGlobal = getGlobal();
    const chatAfterUpdate = selectChat(newGlobal, chatId);

    if (!chatAfterUpdate || !chatAfterUpdate.fullInfo) {
      return;
    }

    const { members, kickedMembers } = chatAfterUpdate.fullInfo;

    const isBanned = !!bannedRights.viewMessages;
    const isUnblocked = !Object.keys(bannedRights).length;

    setGlobal(updateChat(newGlobal, chatId, {
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
    }));
  })();
});

addReducer('updateChatAdmin', (global, actions, payload) => {
  const {
    chatId, userId, adminRights, customTitle,
  } = payload!;
  let chat = selectChat(global, chatId);
  const user = selectUser(global, userId);

  if (!chat || !user) {
    return;
  }

  (async () => {
    if (isChatBasicGroup(chat)) {
      chat = await callApi('migrateChat', chat);

      if (!chat) {
        return;
      }

      actions.openChat({ id: chat.id });
    }

    await callApi('updateChatAdmin', {
      chat, user, adminRights, customTitle,
    });

    const newGlobal = getGlobal();
    const chatAfterUpdate = selectChat(newGlobal, chatId);

    if (!chatAfterUpdate || !chatAfterUpdate.fullInfo) {
      return;
    }

    const { adminMembers } = chatAfterUpdate.fullInfo;

    const isDismissed = !Object.keys(adminRights).length;

    setGlobal(updateChat(newGlobal, chatId, {
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
    }));
  })();
});

addReducer('updateChat', (global, actions, payload) => {
  const {
    chatId, title, about, photo,
  } = payload!;

  const chat = selectChat(global, chatId);
  if (!chat) {
    return;
  }

  (async () => {
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

    setGlobal(updateManagementProgress(getGlobal(), ManagementProgress.Complete));
  })();
});

addReducer('toggleSignatures', (global, actions, payload) => {
  const { chatId, isEnabled } = payload!;
  const chat = selectChat(global, chatId);

  if (!chat) {
    return;
  }

  void callApi('toggleSignatures', { chat, isEnabled });
});

addReducer('loadGroupsForDiscussion', () => {
  (async () => {
    const groups = await callApi('fetchGroupsForDiscussion');
    if (!groups) {
      return;
    }

    const addedById = groups.reduce((result, group) => {
      if (group) {
        result[group.id] = group;
      }

      return result;
    }, {} as Record<number, ApiChat>);

    const global = addChats(getGlobal(), addedById);
    setGlobal({
      ...global,
      chats: {
        ...global.chats,
        forDiscussionIds: Object.keys(addedById).map(Number),
      },
    });
  })();
});

addReducer('linkDiscussionGroup', (global, actions, payload) => {
  const { channelId, chatId } = payload!;

  const channel = selectChat(global, channelId);
  let chat = selectChat(global, chatId);
  if (!channel || !chat) {
    return;
  }

  (async () => {
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

    if (fullInfo.isPreHistoryHidden) {
      await callApi('togglePreHistoryHidden', { chat, isEnabled: false });
    }

    void callApi('setDiscussionGroup', { channel, chat });
  })();
});

addReducer('unlinkDiscussionGroup', (global, actions, payload) => {
  const { channelId } = payload!;

  const channel = selectChat(global, channelId);
  if (!channel) {
    return;
  }

  let chat: ApiChat | undefined;
  if (channel.fullInfo && channel.fullInfo.linkedChatId) {
    chat = selectChat(global, channel.fullInfo.linkedChatId);
  }

  (async () => {
    await callApi('setDiscussionGroup', { channel });
    if (chat) {
      loadFullChat(chat);
    }
  })();
});

addReducer('setActiveChatFolder', (global, actions, payload) => {
  return {
    ...global,
    chatFolders: {
      ...global.chatFolders,
      activeChatFolder: payload,
    },
  };
});

addReducer('loadMoreMembers', (global) => {
  (async () => {
    const { chatId } = selectCurrentMessageList(global) || {};
    const chat = chatId ? selectChat(global, chatId) : undefined;
    if (!chat || isChatBasicGroup(chat)) {
      return;
    }

    const offset = (chat.fullInfo && chat.fullInfo.members && chat.fullInfo.members.length) || undefined;
    const result = await callApi('fetchMembers', chat.id, chat.accessHash!, 'recent', offset);
    if (!result) {
      return;
    }

    const { members, users } = result;
    if (!members || !members.length) {
      return;
    }

    global = getGlobal();
    global = addUsers(global, buildCollectionByKey(users, 'id'));
    global = updateChat(global, chat.id, {
      fullInfo: {
        ...chat.fullInfo,
        members: [
          ...((chat.fullInfo || {}).members || []),
          ...(members || []),
        ],
      },
    });
    setGlobal(global);
  })();
});

addReducer('addChatMembers', (global, actions, payload) => {
  const { chatId, memberIds } = payload;
  const chat = selectChat(global, chatId);
  const users = (memberIds as number[]).map((userId) => selectUser(global, userId)).filter<ApiUser>(Boolean as any);

  if (!chat || !users.length) {
    return;
  }

  actions.setNewChatMembersDialogState(NewChatMembersProgress.Loading);
  (async () => {
    await callApi('addChatMembers', chat, users);
    actions.setNewChatMembersDialogState(NewChatMembersProgress.Closed);
    loadFullChat(chat);
  })();
});

addReducer('deleteChatMember', (global, actions, payload) => {
  const { chatId, userId } = payload;
  const chat = selectChat(global, chatId);
  const user = selectUser(global, userId);

  if (!chat || !user) {
    return;
  }

  (async () => {
    await callApi('deleteChatMember', chat, user);
    loadFullChat(chat);
  })();
});

async function loadChats(listType: 'active' | 'archived', offsetId?: number, offsetDate?: number) {
  const result = await callApi('fetchChats', {
    limit: CHAT_LIST_LOAD_SLICE,
    offsetDate,
    archived: listType === 'archived',
    withPinned: getGlobal().chats.orderedPinnedIds[listType] === undefined,
    serverTimeOffset: getGlobal().serverTimeOffset,
  });

  if (!result) {
    return;
  }

  const { chatIds } = result;

  if (chatIds.length > 0 && chatIds[0] === offsetId) {
    chatIds.shift();
  }

  let global = getGlobal();

  global = addUsers(global, buildCollectionByKey(result.users, 'id'));
  global = updateChats(global, buildCollectionByKey(result.chats, 'id'));
  global = updateChatListIds(global, listType, chatIds);
  global = updateChatListSecondaryInfo(global, listType, result);

  Object.keys(result.draftsById).map(Number).forEach((chatId) => {
    global = replaceThreadParam(
      global, chatId, MAIN_THREAD_ID, 'draft', result.draftsById[chatId],
    );
  });

  Object.keys(result.replyingToById).map(Number).forEach((chatId) => {
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

async function loadFullChat(chat: ApiChat) {
  const result = await callApi('fetchFullChat', chat);
  if (!result) {
    return;
  }

  const { users, fullInfo } = result;

  let global = getGlobal();
  if (users) {
    global = addUsers(global, buildCollectionByKey(users, 'id'));
  }
  global = updateChat(global, chat.id, { fullInfo });

  setGlobal(global);
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
  getDispatch().openChat({ id: channelId });

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

  const createdChat = await callApi('createGroupChat', { title, users });
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
  getDispatch().openChat({ id: chatId });

  if (chatId && photo) {
    await callApi('editChatPhoto', { chatId, photo });
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

async function openChatByUsername(
  actions: GlobalActions,
  username: string,
  channelPostId?: number,
) {
  const global = getGlobal();
  const localChat = selectChatByUsername(global, username);
  if (localChat && !localChat.isMin) {
    if (channelPostId) {
      actions.focusMessage({ chatId: localChat.id, messageId: channelPostId });
    } else {
      actions.openChat({ id: localChat.id });
    }
    return;
  }

  const previousChat = selectCurrentChat(global);
  // Open temporary empty chat to make the click response feel faster
  actions.openChat({ id: TMP_CHAT_ID });

  const chat = await callApi('getChatByUsername', username);
  if (!chat) {
    if (previousChat) {
      actions.openChat({ id: previousChat.id });
    }

    actions.showNotification({ message: 'User does not exist' });

    return;
  }

  setGlobal(updateChat(getGlobal(), chat.id, chat));

  if (channelPostId) {
    actions.focusMessage({ chatId: chat.id, messageId: channelPostId });
  } else {
    actions.openChat({ id: chat.id });
  }
}

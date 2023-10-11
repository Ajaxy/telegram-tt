import type { ApiUser } from '../../../api/types';
import type { ActionReturnType } from '../../types';
import { ManagementProgress } from '../../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { buildCollectionByKey, unique } from '../../../util/iteratees';
import * as langProvider from '../../../util/langProvider';
import { throttle } from '../../../util/schedulers';
import { getServerTime } from '../../../util/serverTime';
import { callApi } from '../../../api/gramjs';
import { isUserBot, isUserId } from '../../helpers';
import {
  addActionHandler,
  getGlobal,
  setGlobal,
} from '../../index';
import {
  addChats,
  addUsers,
  addUserStatuses,
  closeNewContactDialog,
  replaceUserStatuses,
  updateChat,
  updateManagementProgress,
  updateUser,
  updateUserFullInfo,
  updateUsers,
  updateUserSearch,
  updateUserSearchFetchingStatus,
} from '../../reducers';
import {
  selectChat, selectCurrentMessageList, selectPeer, selectTabState, selectUser, selectUserFullInfo,
} from '../../selectors';

const TOP_PEERS_REQUEST_COOLDOWN = 60; // 1 min
const runThrottledForSearch = throttle((cb) => cb(), 500, false);

addActionHandler('loadFullUser', async (global, actions, payload): Promise<void> => {
  const { userId, withPhotos } = payload!;
  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  const { id, accessHash } = user;
  const result = await callApi('fetchFullUser', { id, accessHash });
  if (!result?.user) return;

  global = getGlobal();
  const fullInfo = selectUserFullInfo(global, userId);
  const { user: newUser, fullInfo: newFullInfo } = result;
  const hasChangedAvatarHash = user.avatarHash !== newUser.avatarHash;
  const hasChangedProfilePhoto = fullInfo?.profilePhoto?.id !== newFullInfo?.profilePhoto?.id;
  const hasChangedFallbackPhoto = fullInfo?.fallbackPhoto?.id !== newFullInfo?.fallbackPhoto?.id;
  const hasChangedPersonalPhoto = fullInfo?.personalPhoto?.id !== newFullInfo?.personalPhoto?.id;
  const hasChangedPhoto = hasChangedAvatarHash
    || hasChangedProfilePhoto
    || hasChangedFallbackPhoto
    || hasChangedPersonalPhoto;

  global = updateUser(global, userId, result.user);
  global = updateUserFullInfo(global, userId, result.fullInfo);
  setGlobal(global);
  if (withPhotos || (user.photos?.length && hasChangedPhoto)) {
    actions.loadProfilePhotos({ profileId: userId });
  }
});

addActionHandler('loadUser', async (global, actions, payload): Promise<void> => {
  const { userId } = payload!;
  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  const result = await callApi('fetchUsers', { users: [user] });
  if (!result) {
    return;
  }

  const { users, userStatusesById } = result;

  global = getGlobal();
  global = updateUsers(global, buildCollectionByKey(users, 'id'));
  global = replaceUserStatuses(global, {
    ...global.users.statusesById,
    ...userStatusesById,
  });
  setGlobal(global);
});

addActionHandler('loadTopUsers', async (global): Promise<void> => {
  const { topPeers: { lastRequestedAt } } = global;

  if (!(!lastRequestedAt || getServerTime() - lastRequestedAt > TOP_PEERS_REQUEST_COOLDOWN)) {
    return;
  }

  const result = await callApi('fetchTopUsers');
  if (!result) {
    return;
  }

  const { ids, users } = result;

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = {
    ...global,
    topPeers: {
      ...global.topPeers,
      userIds: ids,
      lastRequestedAt: getServerTime(),
    },
  };
  setGlobal(global);
});

addActionHandler('loadContactList', async (global): Promise<void> => {
  const contactList = await callApi('fetchContactList');
  if (!contactList) {
    return;
  }

  global = getGlobal();
  global = addUsers(global, buildCollectionByKey(contactList.users, 'id'));
  global = addChats(global, buildCollectionByKey(contactList.chats, 'id'));
  global = addUserStatuses(global, contactList.userStatusesById);

  // Sort contact list by Last Name (or First Name), with latin names being placed first
  const getCompareString = (user: ApiUser) => (user.lastName || user.firstName || '');
  const collator = new Intl.Collator('en-US');

  const sortedUsers = contactList.users.sort((a, b) => (
    collator.compare(getCompareString(a), getCompareString(b))
  )).filter((user) => !user.isSelf);

  global = {
    ...global,
    contactList: {
      userIds: sortedUsers.map((user) => user.id),
    },
  };
  setGlobal(global);
});

addActionHandler('loadCurrentUser', (): ActionReturnType => {
  void callApi('fetchCurrentUser');
});

addActionHandler('loadCommonChats', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};
  const { chatId } = selectCurrentMessageList(global, tabId) || {};
  const user = chatId ? selectUser(global, chatId) : undefined;
  if (!user || isUserBot(user) || user.commonChats?.isFullyLoaded) {
    return;
  }

  const maxId = user.commonChats?.maxId;
  const result = await callApi('fetchCommonChats', user.id, user.accessHash!, maxId);
  if (!result) {
    return;
  }

  const { chats, chatIds, isFullyLoaded } = result;

  global = getGlobal();
  if (chats.length) {
    global = addChats(global, buildCollectionByKey(chats, 'id'));
  }
  global = updateUser(global, user.id, {
    commonChats: {
      maxId: chatIds.length ? chatIds[chatIds.length - 1] : '0',
      ids: unique((user.commonChats?.ids || []).concat(chatIds)),
      isFullyLoaded,
    },
  });

  setGlobal(global);
});

addActionHandler('updateContact', async (global, actions, payload): Promise<void> => {
  const {
    userId, isMuted = false, firstName, lastName, shouldSharePhoneNumber,
    tabId = getCurrentTabId(),
  } = payload;

  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  actions.updateChatMutedState({ chatId: userId, isMuted });

  global = getGlobal();
  global = updateManagementProgress(global, ManagementProgress.InProgress, tabId);
  setGlobal(global);

  let result;
  if (!user.isContact && user.phoneNumber) {
    result = await callApi('importContact', { phone: user.phoneNumber, firstName, lastName });
  } else {
    const { id, accessHash } = user;
    result = await callApi('updateContact', {
      id,
      accessHash,
      phoneNumber: '',
      firstName,
      lastName,
      shouldSharePhoneNumber,
    });
  }

  if (result) {
    actions.loadChatSettings({ chatId: userId });
    actions.loadPeerStories({ peerId: userId });

    global = getGlobal();
    global = updateUser(
      global,
      user.id,
      {
        firstName,
        lastName,
      },
    );
    setGlobal(global);
  }

  global = getGlobal();
  global = updateManagementProgress(global, ManagementProgress.Complete, tabId);
  global = closeNewContactDialog(global, tabId);
  setGlobal(global);
});

addActionHandler('deleteContact', async (global, actions, payload): Promise<void> => {
  const { userId } = payload;

  const user = selectUser(global, userId);

  if (!user) {
    return;
  }

  const { id, accessHash } = user;

  await callApi('deleteContact', { id, accessHash });
});

addActionHandler('loadProfilePhotos', async (global, actions, payload): Promise<void> => {
  const { profileId } = payload!;
  const isPrivate = isUserId(profileId);

  let user = isPrivate ? selectUser(global, profileId) : undefined;
  const chat = !isPrivate ? selectChat(global, profileId) : undefined;
  if (!user && !chat) {
    return;
  }

  let fullInfo = selectUserFullInfo(global, profileId);
  if (user && !fullInfo?.profilePhoto) {
    const { id, accessHash } = user;
    const result = await callApi('fetchFullUser', { id, accessHash });
    if (!result?.user) {
      return;
    }

    user = result.user;
    fullInfo = result.fullInfo;
  }

  const result = await callApi('fetchProfilePhotos', user, chat);
  if (!result || !result.photos) {
    return;
  }

  global = getGlobal();

  const userOrChat = user || chat;
  const { photos, users } = result;

  const fallbackPhoto = fullInfo?.fallbackPhoto;
  const personalPhoto = fullInfo?.personalPhoto;
  if (fallbackPhoto) photos.push(fallbackPhoto);
  if (personalPhoto) photos.unshift(personalPhoto);

  photos.sort((a) => (a.id === userOrChat?.avatarHash ? -1 : 1));

  global = addUsers(global, buildCollectionByKey(users, 'id'));

  if (isPrivate) {
    global = updateUser(global, profileId, { photos });
  } else {
    global = updateChat(global, profileId, { photos });
  }

  setGlobal(global);
});

addActionHandler('setUserSearchQuery', (global, actions, payload): ActionReturnType => {
  const { query, tabId = getCurrentTabId() } = payload!;

  if (!query) return;

  void runThrottledForSearch(async () => {
    const result = await callApi('searchChats', { query });

    global = getGlobal();
    const currentSearchQuery = selectTabState(global, tabId).userSearch.query;

    if (!result || !currentSearchQuery || (query !== currentSearchQuery)) {
      global = updateUserSearchFetchingStatus(global, false, tabId);
      setGlobal(global);
      return;
    }

    const { localUsers, globalUsers } = result;

    let localUserIds;
    let globalUserIds;
    if (localUsers.length) {
      global = addUsers(global, buildCollectionByKey(localUsers, 'id'));
      localUserIds = localUsers.map(({ id }) => id);
    }
    if (globalUsers.length) {
      global = addUsers(global, buildCollectionByKey(globalUsers, 'id'));
      globalUserIds = globalUsers.map(({ id }) => id);
    }

    global = updateUserSearchFetchingStatus(global, false, tabId);
    global = updateUserSearch(global, { localUserIds, globalUserIds }, tabId);

    setGlobal(global);
  });
});

addActionHandler('importContact', async (global, actions, payload): Promise<void> => {
  const {
    phoneNumber: phone, firstName, lastName,
    tabId = getCurrentTabId(),
  } = payload;

  const result = await callApi('importContact', { phone, firstName, lastName });
  if (!result) {
    actions.showNotification({
      message: langProvider.translate('Contacts.PhoneNumber.NotRegistred'),
      tabId,
    });

    return;
  }

  actions.openChat({ id: result, tabId });

  global = getGlobal();
  global = closeNewContactDialog(global, tabId);
  setGlobal(global);
});

addActionHandler('reportSpam', (global, actions, payload): ActionReturnType => {
  const { chatId } = payload!;
  const peer = selectPeer(global, chatId);
  if (!peer) {
    return;
  }

  void callApi('reportSpam', peer);
});

addActionHandler('setEmojiStatus', (global, actions, payload): ActionReturnType => {
  const { emojiStatus, expires } = payload!;

  void callApi('updateEmojiStatus', emojiStatus, expires);
});

addActionHandler('saveCloseFriends', async (global, actions, payload): Promise<void> => {
  const { userIds } = payload!;

  const result = await callApi('saveCloseFriends', userIds);
  if (!result) {
    return;
  }

  global = getGlobal();
  global.contactList?.userIds.forEach((userId) => {
    const { isCloseFriend } = global.users.byId[userId] || {};
    if (isCloseFriend && !userIds.includes(userId)) {
      global = updateUser(global, userId, {
        isCloseFriend: undefined,
      });
    }
  });
  userIds.forEach((userId) => {
    global = updateUser(global, userId, {
      isCloseFriend: true,
    });
  });
  setGlobal(global);
});

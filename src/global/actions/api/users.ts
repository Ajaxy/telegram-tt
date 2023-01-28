import {
  addActionHandler, getActions, getGlobal, setGlobal,
} from '../../index';

import type { ApiUser } from '../../../api/types';
import { ManagementProgress } from '../../../types';

import { throttle } from '../../../util/schedulers';
import { buildCollectionByKey, unique } from '../../../util/iteratees';
import { isUserBot, isUserId } from '../../helpers';
import { callApi } from '../../../api/gramjs';
import { selectChat, selectCurrentMessageList, selectUser } from '../../selectors';
import {
  addChats,
  addUsers,
  addUserStatuses,
  closeNewContactDialog,
  replaceUserStatuses,
  updateChat,
  updateManagementProgress,
  updateUser,
  updateUsers,
  updateUserSearch,
  updateUserSearchFetchingStatus,
} from '../../reducers';
import { getServerTime } from '../../../util/serverTime';
import * as langProvider from '../../../util/langProvider';

const TOP_PEERS_REQUEST_COOLDOWN = 60; // 1 min
const runThrottledForSearch = throttle((cb) => cb(), 500, false);

addActionHandler('loadFullUser', async (global, actions, payload) => {
  const { userId } = payload!;
  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  const { id, accessHash } = user;
  const newUser = await callApi('fetchFullUser', { id, accessHash });
  if (!newUser) return;

  const hasChangedAvatarHash = user.avatarHash !== newUser.avatarHash;
  const hasChangedProfilePhoto = user.fullInfo?.profilePhoto?.id !== newUser.fullInfo?.profilePhoto?.id;
  const hasChangedFallbackPhoto = user.fullInfo?.fallbackPhoto?.id !== newUser.fullInfo?.fallbackPhoto?.id;
  const hasChangedPersonalPhoto = user.fullInfo?.personalPhoto?.id !== newUser.fullInfo?.personalPhoto?.id;
  if ((hasChangedAvatarHash || hasChangedProfilePhoto || hasChangedFallbackPhoto || hasChangedPersonalPhoto)
    && user.photos?.length) {
    actions.loadProfilePhotos({ profileId: userId });
  }
});

addActionHandler('loadUser', async (global, actions, payload) => {
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

addActionHandler('loadTopUsers', (global) => {
  const { topPeers: { lastRequestedAt } } = global;

  if (!lastRequestedAt || getServerTime() - lastRequestedAt > TOP_PEERS_REQUEST_COOLDOWN) {
    void loadTopUsers();
  }
});

addActionHandler('loadContactList', () => {
  void loadContactList();
});

addActionHandler('loadCurrentUser', () => {
  void callApi('fetchCurrentUser');
});

addActionHandler('loadCommonChats', async (global) => {
  const { chatId } = selectCurrentMessageList(global) || {};
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

addActionHandler('updateContact', (global, actions, payload) => {
  const {
    userId, isMuted = false, firstName, lastName, shouldSharePhoneNumber,
  } = payload;

  void updateContact(userId, isMuted, firstName, lastName, shouldSharePhoneNumber);
});

addActionHandler('deleteContact', (global, actions, payload) => {
  const { userId } = payload!;

  void deleteContact(userId);
});

async function loadTopUsers() {
  const result = await callApi('fetchTopUsers');
  if (!result) {
    return;
  }

  const { ids, users } = result;

  let global = getGlobal();
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
}

async function loadContactList() {
  const contactList = await callApi('fetchContactList');
  if (!contactList) {
    return;
  }

  let global = addUsers(getGlobal(), buildCollectionByKey(contactList.users, 'id'));
  global = addChats(global, buildCollectionByKey(contactList.chats, 'id'));
  global = addUserStatuses(global, contactList.userStatusesById);

  // Sort contact list by Last Name (or First Name), with latin names being placed first
  const getCompareString = (user: ApiUser) => (user.lastName || user.firstName || '');
  const collator = new Intl.Collator('en-US');

  const sortedUsers = contactList.users.sort((a, b) => (
    collator.compare(getCompareString(a), getCompareString(b))
  )).filter((user) => !user.isSelf);

  setGlobal({
    ...global,
    contactList: {
      userIds: sortedUsers.map((user) => user.id),
    },
  });
}

async function updateContact(
  userId: string,
  isMuted: boolean,
  firstName: string,
  lastName?: string,
  shouldSharePhoneNumber?: boolean,
) {
  let global = getGlobal();
  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  getActions().updateChatMutedState({ chatId: userId, isMuted });

  setGlobal(updateManagementProgress(getGlobal(), ManagementProgress.InProgress));

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
    getActions().loadChatSettings({ chatId: userId });

    setGlobal(updateUser(
      getGlobal(),
      user.id,
      {
        firstName,
        lastName,
      },
    ));
  }

  global = getGlobal();
  global = updateManagementProgress(global, ManagementProgress.Complete);
  global = closeNewContactDialog(global);
  setGlobal(global);
}

async function deleteContact(userId: string) {
  const global = getGlobal();
  const user = selectUser(global, userId);

  if (!user) {
    return;
  }

  const { id, accessHash } = user;

  await callApi('deleteContact', { id, accessHash });
}

addActionHandler('loadProfilePhotos', async (global, actions, payload) => {
  const { profileId } = payload!;
  const isPrivate = isUserId(profileId);

  let user = isPrivate ? selectUser(global, profileId) : undefined;
  const chat = !isPrivate ? selectChat(global, profileId) : undefined;
  if (!user && !chat) {
    return;
  }

  if (user && !user?.fullInfo) {
    const { id, accessHash } = user;
    user = await callApi('fetchFullUser', { id, accessHash });
    if (!user) return;
  }

  const result = await callApi('fetchProfilePhotos', user, chat);
  if (!result || !result.photos) {
    return;
  }

  global = getGlobal();

  const userOrChat = user || chat;
  const { photos, users } = result;
  photos.sort((a) => (a.id === userOrChat?.avatarHash ? -1 : 1));
  const fallbackPhoto = user?.fullInfo?.fallbackPhoto;
  const personalPhoto = user?.fullInfo?.personalPhoto;
  if (fallbackPhoto) photos.push(fallbackPhoto);
  if (personalPhoto) photos.unshift(personalPhoto);

  global = addUsers(global, buildCollectionByKey(users, 'id'));

  if (isPrivate) {
    global = updateUser(global, profileId, { photos });
  } else {
    global = updateChat(global, profileId, { photos });
  }

  setGlobal(global);
});

addActionHandler('setUserSearchQuery', (global, actions, payload) => {
  const { query } = payload!;

  if (!query) return;

  void runThrottledForSearch(() => {
    searchUsers(query);
  });
});

addActionHandler('importContact', async (global, actions, payload) => {
  const { phoneNumber: phone, firstName, lastName } = payload!;

  const result = await callApi('importContact', { phone, firstName, lastName });
  if (!result) {
    actions.showNotification({
      message: langProvider.translate('Contacts.PhoneNumber.NotRegistred'),
    });

    return;
  }

  actions.openChat({ id: result });

  setGlobal(closeNewContactDialog(getGlobal()));
});

addActionHandler('reportSpam', (global, actions, payload) => {
  const { chatId } = payload!;
  const userOrChat = isUserId(chatId) ? selectUser(global, chatId) : selectChat(global, chatId);
  if (!userOrChat) {
    return;
  }

  void callApi('reportSpam', userOrChat);
});

async function searchUsers(query: string) {
  const result = await callApi('searchChats', { query });

  let global = getGlobal();
  const currentSearchQuery = global.userSearch.query;

  if (!result || !currentSearchQuery || (query !== currentSearchQuery)) {
    setGlobal(updateUserSearchFetchingStatus(global, false));
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

  global = updateUserSearchFetchingStatus(global, false);
  global = updateUserSearch(global, { localUserIds, globalUserIds });

  setGlobal(global);
}

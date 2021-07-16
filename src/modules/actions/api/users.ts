import {
  addReducer, getDispatch, getGlobal, setGlobal,
} from '../../../lib/teact/teactn';

import { ApiUser } from '../../../api/types';
import { ManagementProgress } from '../../../types';

import { debounce, throttle } from '../../../util/schedulers';
import { buildCollectionByKey } from '../../../util/iteratees';
import { isChatPrivate } from '../../helpers';
import { callApi } from '../../../api/gramjs';
import { selectChat, selectUser } from '../../selectors';
import {
  addChats, addUsers, updateChat, updateManagementProgress, updateUser, updateUsers,
  updateUserSearch, updateUserSearchFetchingStatus,
} from '../../reducers';

const runDebouncedForFetchFullUser = debounce((cb) => cb(), 500, false, true);
const TOP_PEERS_REQUEST_COOLDOWN = 60; // 1 min
const runThrottledForSearch = throttle((cb) => cb(), 500, false);

addReducer('loadFullUser', (global, actions, payload) => {
  const { userId } = payload!;
  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  const { id, accessHash } = user;

  runDebouncedForFetchFullUser(() => callApi('fetchFullUser', { id, accessHash }));
});

addReducer('loadUser', (global, actions, payload) => {
  const { userId } = payload!;
  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  (async () => {
    const updatedUsers = await callApi('fetchUsers', { users: [user] });
    if (!updatedUsers) {
      return;
    }

    global = getGlobal();
    global = updateUsers(global, buildCollectionByKey(updatedUsers, 'id'));
    setGlobal(global);
  })();
});

addReducer('loadTopUsers', (global) => {
  const {
    serverTimeOffset,
    topPeers: {
      hash, lastRequestedAt,
    },
  } = global;

  if (!lastRequestedAt || Date.now() / 1000 + serverTimeOffset - lastRequestedAt > TOP_PEERS_REQUEST_COOLDOWN) {
    void loadTopUsers(hash);
  }
});

addReducer('loadContactList', (global) => {
  const { hash } = global.contactList || {};
  void loadContactList(hash);
});

addReducer('loadCurrentUser', () => {
  void callApi('fetchCurrentUser');
});

addReducer('updateContact', (global, actions, payload) => {
  const {
    userId, isMuted, firstName, lastName,
  } = payload!;

  void updateContact(userId, isMuted, firstName, lastName);
});

addReducer('deleteUser', (global, actions, payload) => {
  const { userId } = payload!;

  void deleteUser(userId);
});

async function loadTopUsers(usersHash?: number) {
  const result = await callApi('fetchTopUsers', { hash: usersHash });
  if (!result) {
    return;
  }

  const { hash, ids, users } = result;

  let global = getGlobal();
  global = addUsers(global, buildCollectionByKey(users, 'id'));
  global = {
    ...global,
    topPeers: {
      ...global.topPeers,
      hash,
      userIds: ids,
      lastRequestedAt: Date.now() / 1000 + global.serverTimeOffset,
    },
  };
  setGlobal(global);
}

async function loadContactList(hash?: number) {
  const contactList = await callApi('fetchContactList', { hash });
  if (!contactList) {
    return;
  }

  let global = addUsers(getGlobal(), buildCollectionByKey(contactList.users, 'id'));
  global = addChats(global, buildCollectionByKey(contactList.chats, 'id'));

  // Sort contact list by Last Name (or First Name), with latin names being placed first
  const getCompareString = (user: ApiUser) => (user.lastName || user.firstName || '');
  const collator = new Intl.Collator('en-US');

  const sortedUsers = contactList.users.sort((a, b) => (
    collator.compare(getCompareString(a), getCompareString(b))
  )).filter((user) => !user.isSelf);

  setGlobal({
    ...global,
    contactList: {
      hash: contactList.hash,
      userIds: sortedUsers.map((user) => user.id),
    },
  });
}

async function updateContact(
  userId: number,
  isMuted: boolean,
  firstName: string,
  lastName?: string,
) {
  const global = getGlobal();
  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  getDispatch().updateChatMutedState({ chatId: userId, isMuted });

  setGlobal(updateManagementProgress(getGlobal(), ManagementProgress.InProgress));

  const result = await callApi('updateContact', { phone: user.phoneNumber, firstName, lastName });

  if (result) {
    setGlobal(updateUser(
      getGlobal(),
      user.id,
      {
        firstName,
        lastName,
      },
    ));
  }

  setGlobal(updateManagementProgress(getGlobal(), ManagementProgress.Complete));
}

async function deleteUser(userId: number) {
  const global = getGlobal();
  const user = selectUser(global, userId);

  if (!user) {
    return;
  }

  const { id, accessHash } = user;

  await callApi('deleteUser', { id, accessHash });
}

addReducer('loadProfilePhotos', (global, actions, payload) => {
  const { profileId } = payload!;
  const isPrivate = isChatPrivate(profileId);
  const user = isPrivate ? selectUser(global, profileId) : undefined;
  const chat = !isPrivate ? selectChat(global, profileId) : undefined;

  (async () => {
    const result = await callApi('fetchProfilePhotos', user, chat);
    if (!result || !result.photos) {
      return;
    }

    let newGlobal = getGlobal();
    if (isPrivate) {
      newGlobal = updateUser(newGlobal, profileId, { photos: result.photos });
    } else {
      newGlobal = addUsers(newGlobal, buildCollectionByKey(result.users!, 'id'));
      newGlobal = updateChat(newGlobal, profileId, { photos: result.photos });
    }

    setGlobal(newGlobal);
  })();
});


addReducer('setUserSearchQuery', (global, actions, payload) => {
  const { query } = payload!;

  if (!query) return;

  void runThrottledForSearch(() => {
    searchUsers(query);
  });
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

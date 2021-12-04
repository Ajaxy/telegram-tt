import {
  addReducer, getDispatch, getGlobal, setGlobal,
} from '../../../lib/teact/teactn';

import { ApiUser } from '../../../api/types';
import { ManagementProgress } from '../../../types';

import { debounce, throttle } from '../../../util/schedulers';
import { buildCollectionByKey, pick, unique } from '../../../util/iteratees';
import { isUserBot, isUserId } from '../../helpers';
import { callApi } from '../../../api/gramjs';
import { selectChat, selectCurrentMessageList, selectUser } from '../../selectors';
import {
  addChats, addUsers, replaceUserStatuses, updateChat, updateManagementProgress, updateUser, updateUsers,
  updateUserSearch, updateUserSearchFetchingStatus,
} from '../../reducers';
import { getServerTime } from '../../../util/serverTime';

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
    const result = await callApi('fetchUsers', { users: [user] });
    if (!result) {
      return;
    }

    const { users, userStatusesById } = result;

    global = getGlobal();

    global = updateUsers(global, buildCollectionByKey(users, 'id'));
    setGlobal(replaceUserStatuses(global, {
      ...global.users.statusesById,
      ...userStatusesById,
    }));

    setGlobal(global);
  })();
});

addReducer('loadTopUsers', (global) => {
  const { topPeers: { lastRequestedAt } } = global;

  if (!lastRequestedAt || getServerTime(global.serverTimeOffset) - lastRequestedAt > TOP_PEERS_REQUEST_COOLDOWN) {
    void loadTopUsers();
  }
});

addReducer('loadContactList', () => {
  void loadContactList();
});

addReducer('loadCurrentUser', () => {
  void callApi('fetchCurrentUser');
});

addReducer('loadCommonChats', (global) => {
  const { chatId } = selectCurrentMessageList(global) || {};
  const user = chatId ? selectUser(global, chatId) : undefined;
  if (!user || isUserBot(user) || user.commonChats?.isFullyLoaded) {
    return;
  }

  (async () => {
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
  })();
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
      lastRequestedAt: getServerTime(global.serverTimeOffset),
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
) {
  const global = getGlobal();
  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  getDispatch().updateChatMutedState({ chatId: userId, isMuted });

  setGlobal(updateManagementProgress(getGlobal(), ManagementProgress.InProgress));

  let result;
  if (user.phoneNumber) {
    result = await callApi('updateContact', { phone: user.phoneNumber, firstName, lastName });
  } else {
    const { id, accessHash } = user;
    result = await callApi('addContact', {
      id,
      accessHash,
      phoneNumber: '',
      firstName,
      lastName,
    });
  }

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

async function deleteUser(userId: string) {
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
  const isPrivate = isUserId(profileId);
  const user = isPrivate ? selectUser(global, profileId) : undefined;
  const chat = !isPrivate ? selectChat(global, profileId) : undefined;

  if (!user && !chat) {
    return;
  }

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

addReducer('addContact', (global, actions, payload) => {
  const { userId } = payload!;
  const user = selectUser(global, userId);
  if (!user) {
    return;
  }

  void callApi('addContact', pick(user, ['id', 'accessHash', 'firstName', 'lastName', 'phoneNumber']));
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

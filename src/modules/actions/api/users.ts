import {
  addReducer, getDispatch, getGlobal, setGlobal,
} from '../../../lib/teact/teactn';

import { ApiUser } from '../../../api/types';
import { ManagementProgress } from '../../../types';

import { debounce } from '../../../util/schedulers';
import { buildCollectionByKey } from '../../../util/iteratees';
import { callApi } from '../../../api/gramjs';
import { selectUser } from '../../selectors';
import {
  addChats, addUsers, updateManagementProgress, updateUser, updateUsers,
} from '../../reducers';

const runDebouncedForFetchFullUser = debounce((cb) => cb(), 500, false, true);
const TOP_PEERS_REQUEST_COOLDOWN = 60000; // 1 min

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
  const { hash, lastRequestedAt } = global.topPeers;

  if (!lastRequestedAt || Date.now() - lastRequestedAt > TOP_PEERS_REQUEST_COOLDOWN) {
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
      lastRequestedAt: Date.now(),
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

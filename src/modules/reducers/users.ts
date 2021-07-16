import { GlobalState } from '../../global/types';
import { ApiUser } from '../../api/types';

import { omit } from '../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';

export function replaceUsers(global: GlobalState, newById: Record<number, ApiUser>): GlobalState {
  return {
    ...global,
    users: {
      ...global.users,
      byId: newById,
    },
  };
}

// @optimization Don't spread/unspread global for each element, do it in a batch
function getUpdatedUser(global: GlobalState, userId: number, userUpdate: Partial<ApiUser>): ApiUser {
  const { byId } = global.users;
  const user = byId[userId];
  const shouldOmitMinInfo = userUpdate.isMin && user && !user.isMin;

  const updatedUser = {
    ...user,
    ...(shouldOmitMinInfo ? omit(userUpdate, ['isMin', 'accessHash']) : userUpdate),
  };

  if (!updatedUser.id || !updatedUser.type) {
    return user;
  }

  return updatedUser;
}

function updateContactList(global: GlobalState, updatedUsers: ApiUser[]): GlobalState {
  const { hash, userIds: contactUserIds } = global.contactList || {};

  if (!contactUserIds) return global;

  const newContactUserIds = updatedUsers
    .filter((user) => user && user.isContact && !contactUserIds.includes(user.id))
    .map((user) => user.id);

  if (newContactUserIds.length === 0) return global;

  return {
    ...global,
    contactList: {
      hash: hash || 0,
      userIds: [
        ...newContactUserIds,
        ...contactUserIds,
      ],
    },
  };
}

export function updateUser(global: GlobalState, userId: number, userUpdate: Partial<ApiUser>): GlobalState {
  const { byId } = global.users;

  const updatedUser = getUpdatedUser(global, userId, userUpdate);

  global = updateContactList(global, [updatedUser]);

  return replaceUsers(global, {
    ...byId,
    [userId]: updatedUser,
  });
}


export function updateUsers(global: GlobalState, updatedById: Record<number, ApiUser>): GlobalState {
  const updatedUsers = Object.keys(updatedById).map(Number).reduce<Record<number, ApiUser>>((acc, id) => {
    const updatedUser = getUpdatedUser(global, id, updatedById[id]);
    if (updatedUser) {
      acc[id] = updatedUser;
    }
    return acc;
  }, {});

  global = updateContactList(global, Object.values(updatedUsers));

  global = replaceUsers(global, {
    ...global.users.byId,
    ...updatedUsers,
  });

  return global;
}

// @optimization Allows to avoid redundant updates which cause a lot of renders
export function addUsers(global: GlobalState, addedById: Record<number, ApiUser>): GlobalState {
  const { byId } = global.users;
  let isAdded = false;

  const addedUsers = Object.keys(addedById).map(Number).reduce<Record<number, ApiUser>>((acc, id) => {
    if (!byId[id] || (byId[id].isMin && !addedById[id].isMin)) {
      const updatedUser = getUpdatedUser(global, id, addedById[id]);
      if (updatedUser) {
        acc[id] = updatedUser;

        if (!isAdded) {
          isAdded = true;
        }
      }
    }
    return acc;
  }, {});

  if (isAdded) {
    global = replaceUsers(global, {
      ...global.users.byId,
      ...addedUsers,
    });

    global = updateContactList(global, Object.values(addedUsers));
  }

  return global;
}

export function updateSelectedUserId(global: GlobalState, selectedId?: number): GlobalState {
  if (global.users.selectedId === selectedId) {
    return global;
  }

  return {
    ...global,
    users: {
      ...global.users,
      selectedId,
    },
  };
}

export function deleteUser(global: GlobalState, userId: number): GlobalState {
  const { byId } = global.users;
  const { hash, userIds } = global.contactList || {};
  delete byId[userId];

  global = {
    ...global,
    contactList: {
      hash: hash || 0,
      userIds: userIds ? userIds.filter((id) => id !== userId) : MEMO_EMPTY_ARRAY,
    },
  };

  return replaceUsers(global, byId);
}

export function updateUserSearch(
  global: GlobalState,
  searchStatePartial: Partial<GlobalState['userSearch']>,
) {
  return {
    ...global,
    userSearch: {
      ...global.userSearch,
      ...searchStatePartial,
    },
  };
}

export function updateUserSearchFetchingStatus(
  global: GlobalState, newState: boolean,
) {
  return updateUserSearch(global, {
    fetchingStatus: newState,
  });
}

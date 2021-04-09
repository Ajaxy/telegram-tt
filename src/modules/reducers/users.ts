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
export function updateUser(global: GlobalState, userId: number, userUpdate: Partial<ApiUser>): GlobalState {
  const { byId } = global.users;
  const { hash, userIds: contactUserIds } = global.contactList || {};
  const user = byId[userId];
  const shouldOmitMinInfo = userUpdate.isMin && user && !user.isMin;
  const updatedUser = {
    ...user,
    ...(shouldOmitMinInfo ? omit(userUpdate, ['isMin', 'accessHash']) : userUpdate),
  };

  if (!updatedUser.id || !updatedUser.type) {
    return global;
  }

  if (updatedUser.isContact && (contactUserIds && !contactUserIds.includes(userId))) {
    global = {
      ...global,
      contactList: {
        hash: hash || 0,
        userIds: [userId, ...contactUserIds],
      },
    };
  }

  return replaceUsers(global, {
    ...byId,
    [userId]: updatedUser,
  });
}

export function updateUsers(global: GlobalState, updatedById: Record<number, ApiUser>): GlobalState {
  Object.keys(updatedById).map(Number).forEach((id) => {
    global = updateUser(global, id, updatedById[id]);
  });

  return global;
}

// @optimization Allows to avoid redundant updates which cause a lot of renders
export function addUsers(global: GlobalState, addedById: Record<number, ApiUser>): GlobalState {
  const { byId } = global.users;
  Object.keys(addedById).map(Number).forEach((id) => {
    if (!byId[id] || (byId[id].isMin && !addedById[id].isMin)) {
      global = updateUser(global, id, addedById[id]);
    }
  });

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

import { GlobalState } from '../types';
import { ApiUser, ApiUserStatus } from '../../api/types';

import { omit, pick } from '../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { updateChat } from './chats';

export function replaceUsers(global: GlobalState, newById: Record<string, ApiUser>): GlobalState {
  return {
    ...global,
    users: {
      ...global.users,
      byId: newById,
    },
  };
}

function updateContactList(global: GlobalState, updatedUsers: ApiUser[]): GlobalState {
  const { userIds: contactUserIds } = global.contactList || {};

  if (!contactUserIds) return global;

  const newContactUserIds = updatedUsers
    .filter((user) => user?.isContact && !contactUserIds.includes(user.id))
    .map((user) => user.id);

  if (newContactUserIds.length === 0) return global;

  return {
    ...global,
    contactList: {
      userIds: [
        ...newContactUserIds,
        ...contactUserIds,
      ],
    },
  };
}

export function updateUser(global: GlobalState, userId: string, userUpdate: Partial<ApiUser>): GlobalState {
  const { byId } = global.users;

  const updatedUser = getUpdatedUser(global, userId, userUpdate);
  if (!updatedUser) {
    return global;
  }

  global = updateContactList(global, [updatedUser]);

  return replaceUsers(global, {
    ...byId,
    [userId]: updatedUser,
  });
}

export function updateUsers(global: GlobalState, newById: Record<string, ApiUser>): GlobalState {
  const updatedById = Object.keys(newById).reduce((acc: Record<string, ApiUser>, id) => {
    const updatedUser = getUpdatedUser(global, id, newById[id]);
    if (updatedUser) {
      acc[id] = updatedUser;
    }

    return acc;
  }, {});

  global = replaceUsers(global, {
    ...global.users.byId,
    ...updatedById,
  });

  global = updateContactList(global, Object.values(updatedById));

  return global;
}

// @optimization Allows to avoid redundant updates which cause a lot of renders
export function addUsers(global: GlobalState, newById: Record<string, ApiUser>): GlobalState {
  const { byId } = global.users;
  let isUpdated = false;

  const addedById = Object.keys(newById).reduce<Record<string, ApiUser>>((acc, id) => {
    if (!byId[id] || (byId[id].isMin && !newById[id].isMin)) {
      const updatedUser = getUpdatedUser(global, id, newById[id]);
      if (updatedUser) {
        acc[id] = updatedUser;
        if (!isUpdated) {
          isUpdated = true;
        }
      }
    }
    return acc;
  }, {});

  if (!isUpdated) {
    return global;
  }

  global = replaceUsers(global, {
    ...byId,
    ...addedById,
  });

  global = updateContactList(global, Object.values(addedById));

  return global;
}

// @optimization Don't spread/unspread global for each element, do it in a batch
function getUpdatedUser(global: GlobalState, userId: string, userUpdate: Partial<ApiUser>) {
  const { byId } = global.users;
  const user = byId[userId];
  const shouldOmitMinInfo = userUpdate.isMin && user && !user.isMin;

  const updatedUser = {
    ...user,
    ...(shouldOmitMinInfo ? omit(userUpdate, ['isMin', 'accessHash']) : userUpdate),
  };

  if (!updatedUser.id || !updatedUser.type) {
    return undefined;
  }

  return updatedUser;
}

export function deleteContact(global: GlobalState, userId: string): GlobalState {
  const { byId } = global.users;
  const { userIds } = global.contactList || {};

  global = {
    ...global,
    contactList: {
      userIds: userIds ? userIds.filter((id) => id !== userId) : MEMO_EMPTY_ARRAY,
    },
  };

  global = replaceUsers(global, {
    ...byId,
    [userId]: {
      ...byId[userId],
      isContact: undefined,
    },
  });

  return updateChat(global, userId, {
    settings: undefined,
  });
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

export function updateUserBlockedState(global: GlobalState, userId: string, isBlocked: boolean) {
  const { byId } = global.users;
  const user = byId[userId];
  if (!user || !user.fullInfo) {
    return global;
  }

  return updateUser(global, userId, {
    ...user,
    fullInfo: {
      ...user.fullInfo,
      isBlocked,
    },
  });
}

export function replaceUserStatuses(global: GlobalState, newById: Record<string, ApiUserStatus>): GlobalState {
  return {
    ...global,
    users: {
      ...global.users,
      statusesById: newById,
    },
  };
}

// @optimization Allows to avoid redundant updates which cause a lot of renders
export function addUserStatuses(global: GlobalState, newById: Record<string, ApiUserStatus>): GlobalState {
  const { statusesById } = global.users;

  const newKeys = Object.keys(newById).filter((id) => !statusesById[id]);
  if (!newKeys.length) {
    return global;
  }

  global = replaceUserStatuses(global, {
    ...statusesById,
    ...pick(newById, newKeys),
  });

  return global;
}

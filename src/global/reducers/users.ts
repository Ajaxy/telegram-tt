import type { ApiUser, ApiUserFullInfo, ApiUserStatus } from '../../api/types';
import type { GlobalState, TabArgs, TabState } from '../types';

import { areDeepEqual } from '../../util/areDeepEqual';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import { omit, pick } from '../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { selectTabState } from '../selectors';
import { updateChat } from './chats';
import { updateTabState } from './tabs';

export function replaceUsers<T extends GlobalState>(global: T, newById: Record<string, ApiUser>): T {
  return {
    ...global,
    users: {
      ...global.users,
      byId: newById,
    },
  };
}

function updateContactList<T extends GlobalState>(global: T, updatedUsers: ApiUser[]): T {
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

export function updateUser<T extends GlobalState>(global: T, userId: string, userUpdate: Partial<ApiUser>): T {
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

export function updateUsers<T extends GlobalState>(global: T, newById: Record<string, ApiUser>): T {
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
export function addUsers<T extends GlobalState>(global: T, newById: Record<string, ApiUser>): T {
  const { byId } = global.users;
  let isUpdated = false;

  const addedById = Object.keys(newById).reduce<Record<string, ApiUser>>((acc, id) => {
    const existingUser = byId[id];
    const newUser = newById[id];

    if (existingUser && !existingUser.isMin && (newUser.isMin || existingUser.accessHash === newUser.accessHash)) {
      return acc;
    }

    const updatedUser = getUpdatedUser(global, id, newUser);
    if (updatedUser) {
      acc[id] = updatedUser;
      if (!isUpdated) {
        isUpdated = true;
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
  const omitProps: (keyof ApiUser)[] = [];

  if (userUpdate.isMin && user && !user.isMin) {
    return undefined; // Do not apply updates from min constructor
  }

  if (areDeepEqual(user?.usernames, userUpdate.usernames)) {
    omitProps.push('usernames');
  }

  const updatedUser = {
    ...user,
    ...omit(userUpdate, omitProps),
  } as ApiUser;

  if (!updatedUser.id || !updatedUser.type) {
    return undefined;
  }

  return updatedUser;
}

export function deleteContact<T extends GlobalState>(global: T, userId: string): T {
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

  global = {
    ...global,
    stories: {
      ...global.stories,
      orderedPeerIds: {
        active: global.stories.orderedPeerIds.active.filter((id) => id !== userId),
        archived: global.stories.orderedPeerIds.archived.filter((id) => id !== userId),
      },
    },
  };

  return updateChat(global, userId, {
    settings: undefined,
  });
}

export function updateUserSearch<T extends GlobalState>(
  global: T,
  searchStatePartial: Partial<TabState['userSearch']>,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    userSearch: {
      ...selectTabState(global, tabId).userSearch,
      ...searchStatePartial,
    },
  }, tabId);
}

export function updateUserSearchFetchingStatus<T extends GlobalState>(
  global: T, newState: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateUserSearch(global, {
    fetchingStatus: newState,
  }, tabId);
}

export function updateUserBlockedState<T extends GlobalState>(global: T, userId: string, isBlocked: boolean): T {
  const { fullInfoById } = global.users;
  const fullInfo = fullInfoById[userId];
  if (!fullInfo) {
    return global;
  }

  return updateUserFullInfo(global, userId, { isBlocked });
}

export function replaceUserStatuses<T extends GlobalState>(global: T, newById: Record<string, ApiUserStatus>): T {
  return {
    ...global,
    users: {
      ...global.users,
      statusesById: newById,
    },
  };
}

export function updateUserFullInfo<T extends GlobalState>(
  global: T, userId: string, fullInfo: Partial<ApiUserFullInfo>,
): T {
  const userFullInfo = global.users.fullInfoById[userId];

  return {
    ...global,
    users: {
      ...global.users,
      fullInfoById: {
        ...global.users.fullInfoById,
        [userId]: {
          ...userFullInfo,
          ...fullInfo,
        },
      },
    },
  };
}

// @optimization Allows to avoid redundant updates which cause a lot of renders
export function addUserStatuses<T extends GlobalState>(global: T, newById: Record<string, ApiUserStatus>): T {
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

export function closeNewContactDialog<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    newContact: undefined,
  }, tabId);
}

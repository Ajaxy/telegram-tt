import type {
  ApiChat, ApiChatFullInfo, ApiChatMember,
} from '../../api/types';
import type { ChatListType } from '../../types';
import type { GlobalState } from '../types';

import { ARCHIVED_FOLDER_ID } from '../../config';
import { areDeepEqual } from '../../util/areDeepEqual';
import {
  areSortedArraysEqual, buildCollectionByKey, omit, omitUndefined, pick, unique,
} from '../../util/iteratees';
import { selectChatFullInfo } from '../selectors';

const DEFAULT_CHAT_LISTS: ChatListType[] = ['active', 'archived'];

export function replaceChatListIds<T extends GlobalState>(
  global: T,
  type: ChatListType,
  newIds: string[] | undefined,
): T {
  return {
    ...global,
    chats: {
      ...global.chats,
      listIds: {
        ...global.chats.listIds,
        [type]: newIds,
      },
    },
  };
}

export function replaceChatListLoadingParameters<T extends GlobalState>(
  global: T, type: ChatListType, nextOffsetId?: number, nextOffsetPeerId?: string, nextOffsetDate?: number,
): T {
  return {
    ...global,
    chats: {
      ...global.chats,
      loadingParameters: {
        ...global.chats.loadingParameters,
        [type]: {
          nextOffsetId,
          nextOffsetPeerId,
          nextOffsetDate,
        },
      },
    },
  };
}

export function updateChatLastMessageId<T extends GlobalState>(
  global: T, chatId: string, lastMessageId: number, listType?: ChatListType,
): T {
  const key = listType === 'saved' ? 'saved' : 'all';
  return {
    ...global,
    chats: {
      ...global.chats,
      lastMessageIds: {
        ...global.chats.lastMessageIds,
        [key]: {
          ...global.chats.lastMessageIds[key],
          [chatId]: lastMessageId,
        },
      },
    },
  };
}

export function updateChatsLastMessageId<T extends GlobalState>(
  global: T, messageIds: Record<string, number>, listType?: ChatListType,
): T {
  const key = listType === 'saved' ? 'saved' : 'all';
  return {
    ...global,
    chats: {
      ...global.chats,
      lastMessageIds: {
        ...global.chats.lastMessageIds,
        [key]: {
          ...global.chats.lastMessageIds[key],
          ...messageIds,
        },
      },
    },
  };
}

export function addChatListIds<T extends GlobalState>(
  global: T, type: ChatListType, idsUpdate: string[],
): T {
  const { [type]: listIds } = global.chats.listIds;
  const newIds = listIds?.length
    ? idsUpdate.filter((id) => !listIds.includes(id))
    : idsUpdate;

  if (listIds && !newIds.length) {
    return global;
  }

  return replaceChatListIds(global, type, [
    ...(listIds || []),
    ...newIds,
  ]);
}

export function replaceChats<T extends GlobalState>(global: T, newById: Record<string, ApiChat>): T {
  return {
    ...global,
    chats: {
      ...global.chats,
      byId: newById,
    },
  };
}

export function addUnreadMentions<T extends GlobalState>(
  global: T, chatId: string, chat: ApiChat, ids: number[], shouldUpdateCount: boolean = false,
): T {
  const prevChatUnreadMentions = (chat.unreadMentions || []);
  const updatedUnreadMentions = unique([...prevChatUnreadMentions, ...ids]).sort((a, b) => b - a);
  global = updateChat(global, chatId, {
    unreadMentions: updatedUnreadMentions,
  });

  if (shouldUpdateCount) {
    const updatedUnreadMentionsCount = (chat.unreadMentionsCount || 0)
    + Math.max(0, updatedUnreadMentions.length - prevChatUnreadMentions.length);

    global = updateChat(global, chatId, {
      unreadMentionsCount: updatedUnreadMentionsCount,
    });
  }
  return global;
}

export function removeUnreadMentions<T extends GlobalState>(
  global: T, chatId: string, chat: ApiChat, ids: number[], shouldUpdateCount: boolean = false,
): T {
  const prevChatUnreadMentions = (chat.unreadMentions || []);
  const updatedUnreadMentions = prevChatUnreadMentions?.filter((id) => !ids.includes(id));

  global = updateChat(global, chatId, {
    unreadMentions: updatedUnreadMentions,
  });

  if (shouldUpdateCount && chat.unreadMentionsCount) {
    const removedCount = prevChatUnreadMentions.length - updatedUnreadMentions.length;
    const updatedUnreadMentionsCount = Math.max(chat.unreadMentionsCount - removedCount, 0) || undefined;

    global = updateChat(global, chatId, {
      unreadMentionsCount: updatedUnreadMentionsCount,
    });
  }
  return global;
}

export function updateChat<T extends GlobalState>(
  global: T, chatId: string, chatUpdate: Partial<ApiChat>, noOmitUnreadReactionCount = false, withDeepCheck = false,
): T {
  const { byId } = global.chats;

  const chat = byId[chatId];
  if (withDeepCheck && chat) {
    const updateKeys = Object.keys(chatUpdate) as (keyof ApiChat)[];
    if (areDeepEqual(pick(chat, updateKeys), chatUpdate)) {
      return global;
    }
  }

  const updatedChat = getUpdatedChat(global, chatId, chatUpdate, noOmitUnreadReactionCount);
  if (!updatedChat) {
    return global;
  }

  return replaceChats(global, {
    ...byId,
    [chatId]: updatedChat,
  });
}

export function updateChatFullInfo<T extends GlobalState>(
  global: T, chatId: string, fullInfoUpdate: Partial<ApiChatFullInfo>,
): T {
  const currentFullInfo = selectChatFullInfo(global, chatId);
  const updatedFullInfo = {
    ...currentFullInfo,
    ...fullInfoUpdate,
  };

  if (areDeepEqual(currentFullInfo, updatedFullInfo)) {
    return global;
  }

  return {
    ...global,
    chats: {
      ...global.chats,
      fullInfoById: {
        ...global.chats.fullInfoById,
        [chatId]: updatedFullInfo,
      },
    },
  };
}

export function replaceChatFullInfo<T extends GlobalState>(global: T, chatId: string, fullInfo: ApiChatFullInfo): T {
  const currentFullInfo = selectChatFullInfo(global, chatId);

  if (areDeepEqual(currentFullInfo, fullInfo)) {
    return global;
  }

  return {
    ...global,
    chats: {
      ...global.chats,
      fullInfoById: {
        ...global.chats.fullInfoById,
        [chatId]: fullInfo,
      },
    },
  };
}

export function updateChats<T extends GlobalState>(global: T, newById: Record<string, ApiChat>): T {
  const updatedById = Object.keys(newById).reduce((acc: Record<string, ApiChat>, id) => {
    const updatedChat = getUpdatedChat(global, id, newById[id]);
    if (updatedChat) {
      acc[id] = updatedChat;
    }

    return acc;
  }, {});

  global = replaceChats(global, {
    ...global.chats.byId,
    ...updatedById,
  });

  return global;
}

// @optimization Allows to avoid redundant updates which cause a lot of renders
export function addChats<T extends GlobalState>(global: T, newById: Record<string, ApiChat>): T {
  const { byId } = global.chats;
  let isUpdated = false;

  const addedById = Object.keys(newById).reduce<Record<string, ApiChat>>((acc, id) => {
    const existingChat = byId[id];
    const newChat = newById[id];

    const membersCountChanged = !existingChat?.membersCount && newChat.membersCount;

    if (existingChat && !existingChat.isMin && !membersCountChanged
        && (newChat.isMin || existingChat.accessHash === newChat.accessHash)) {
      return acc;
    }

    const updatedChat = getUpdatedChat(global, id, newChat);
    if (updatedChat) {
      acc[id] = updatedChat;
      if (!isUpdated) {
        isUpdated = true;
      }
    }

    return acc;
  }, {});

  if (!isUpdated) {
    return global;
  }

  global = replaceChats(global, {
    ...byId,
    ...addedById,
  });

  return global;
}

// @optimization Don't spread/unspread global for each element, do it in a batch
function getUpdatedChat<T extends GlobalState>(
  global: T, chatId: string, chatUpdate: Partial<ApiChat>,
  noOmitUnreadReactionCount = false,
) {
  const { byId } = global.chats;
  const chat = byId[chatId];
  const omitProps: (keyof ApiChat)[] = [];

  if (chatUpdate.isMin && chat && !chat.isMin) {
    return undefined; // Do not apply updates from min constructor
  }

  if (!noOmitUnreadReactionCount) {
    omitProps.push('unreadReactionsCount');
  }

  if (areDeepEqual(chat?.usernames, chatUpdate.usernames)) {
    omitProps.push('usernames');
  }

  const updatedChat: ApiChat = {
    ...chat,
    ...omit(chatUpdate, omitProps),
  } as ApiChat;

  if (!updatedChat.id || !updatedChat.type) {
    return undefined;
  }

  return omitUndefined(updatedChat);
}

export function updateChatListType<T extends GlobalState>(
  global: T,
  chatId: string,
  folderId?: number,
): T {
  const listType = folderId === ARCHIVED_FOLDER_ID ? 'archived' : 'active';

  let currentListIds = global.chats.listIds;
  (Object.keys(currentListIds) as Array<keyof typeof currentListIds>).forEach((listTypeKey) => {
    const currentFolderList = currentListIds[listTypeKey] || [];
    if (listTypeKey === listType && !currentFolderList.includes(chatId)) {
      currentListIds = {
        ...currentListIds,
        [listTypeKey]: [...currentFolderList, chatId],
      };
    } else if (listTypeKey !== listType && currentFolderList.includes(chatId)) {
      currentListIds = {
        ...currentListIds,
        [listTypeKey]: currentFolderList.filter((id) => id !== chatId),
      };
    }
  });

  global = {
    ...global,
    chats: {
      ...global.chats,
      listIds: currentListIds,
    },
  };

  global = updateChat(global, chatId, { folderId: folderId || undefined });

  return global;
}

export function updateChatListSecondaryInfo<T extends GlobalState>(
  global: T,
  type: ChatListType,
  info: {
    orderedPinnedIds?: string[];
    totalChatCount: number;
  },
): T {
  const totalCountKey = type === 'active' ? 'all' : type;

  return {
    ...global,
    chats: {
      ...global.chats,
      ...(info.orderedPinnedIds && {
        orderedPinnedIds: {
          ...global.chats.orderedPinnedIds,
          [type]: info.orderedPinnedIds,
        },
      }),
      totalCount: {
        ...global.chats.totalCount,
        [totalCountKey]: info.totalChatCount,
      },
    },
  };
}

export function leaveChat<T extends GlobalState>(global: T, leftChatId: string): T {
  global = removeChatFromChatLists(global, leftChatId);

  global = updateChat(global, leftChatId, { isNotJoined: true });
  global = updateChatFullInfo(global, leftChatId, { joinInfo: undefined });

  return global;
}

export function removeChatFromChatLists<T extends GlobalState>(
  global: T, chatId: string, type: 'all' | 'saved' = 'all',
): T {
  const chatLists = type === 'all' ? DEFAULT_CHAT_LISTS : [type];
  chatLists.forEach((listType) => {
    global = replaceChatListIds(global, listType, global.chats.listIds[listType]?.filter((id) => id !== chatId));
  });

  return global;
}

export function addChatMembers<T extends GlobalState>(global: T, chat: ApiChat, membersToAdd: ApiChatMember[]): T {
  const currentMembers = selectChatFullInfo(global, chat.id)?.members;
  const newMemberIds = new Set(membersToAdd.map((m) => m.userId));
  const updatedMembers = [
    ...currentMembers?.filter(({ userId }) => !newMemberIds.has(userId)) || [],
    ...membersToAdd,
  ];
  const currentIds = currentMembers?.map(({ userId }) => userId) || [];
  const updatedIds = updatedMembers.map(({ userId }) => userId);

  if (areSortedArraysEqual(currentIds, updatedIds)) {
    return global;
  }

  const adminMembers = updatedMembers.filter(({ isAdmin, isOwner }) => isAdmin || isOwner);

  return updateChatFullInfo(global, chat.id, {
    members: updatedMembers,
    adminMembersById: buildCollectionByKey(adminMembers, 'userId'),
  });
}

export function replaceSimilarChannels<T extends GlobalState>(
  global: T,
  chatId: string,
  similarChannelIds: string[],
  count?: number,
) {
  return {
    ...global,
    chats: {
      ...global.chats,
      similarChannelsById: {
        ...global.chats.similarChannelsById,
        [chatId]: {
          similarChannelIds,
          count: count || similarChannelIds.length,
        },
      },
    },
  };
}

export function toggleSimilarChannels<T extends GlobalState>(
  global: T,
  chatId: string,
) {
  const similarChannels = global.chats.similarChannelsById[chatId];

  return {
    ...global,
    chats: {
      ...global.chats,
      similarChannelsById: {
        ...global.chats.similarChannelsById,
        [chatId]: {
          ...similarChannels,
          isExpanded: !similarChannels?.isExpanded,
        },
      },
    },
  };
}

export function addSimilarBots<T extends GlobalState>(
  global: T,
  chatId: string,
  similarBotsIds: string[],
  count?: number,
) {
  return {
    ...global,
    chats: {
      ...global.chats,
      similarBotsById: {
        ...global.chats.similarBotsById,
        [chatId]: {
          similarBotsIds,
          count,
        },
      },
    },
  };
}

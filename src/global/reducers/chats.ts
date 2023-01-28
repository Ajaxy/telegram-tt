import type { GlobalState } from '../types';
import type {
  ApiChat, ApiChatMember, ApiTopic, ApiPhoto,
} from '../../api/types';

import { ARCHIVED_FOLDER_ID } from '../../config';
import {
  areSortedArraysEqual, buildCollectionByKey, omit, unique,
} from '../../util/iteratees';
import { selectChat, selectChatListType } from '../selectors';
import { updateThread, updateThreadInfo } from './messages';
import { areDeepEqual } from '../../util/areDeepEqual';

export function replaceChatListIds<T extends GlobalState>(
  global: T,
  type: 'active' | 'archived',
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

export function updateChatListIds<T extends GlobalState>(
  global: T, type: 'active' | 'archived', idsUpdate: string[],
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

export function updateChat<T extends GlobalState>(
  global: T, chatId: string, chatUpdate: Partial<ApiChat>, photo?: ApiPhoto,
  noOmitUnreadReactionCount = false,
): T {
  const { byId } = global.chats;

  const updatedChat = getUpdatedChat(global, chatId, chatUpdate, photo, noOmitUnreadReactionCount);
  if (!updatedChat) {
    return global;
  }

  return replaceChats(global, {
    ...byId,
    [chatId]: updatedChat,
  });
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
    if (!byId[id] || (byId[id].isMin && !newById[id].isMin)) {
      const updatedChat = getUpdatedChat(global, id, newById[id]);
      if (updatedChat) {
        acc[id] = updatedChat;
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

  global = replaceChats(global, {
    ...byId,
    ...addedById,
  });

  return global;
}

// @optimization Don't spread/unspread global for each element, do it in a batch
function getUpdatedChat<T extends GlobalState>(
  global: T, chatId: string, chatUpdate: Partial<ApiChat>, photo?: ApiPhoto,
  noOmitUnreadReactionCount = false,
) {
  const { byId } = global.chats;
  const chat = byId[chatId];
  const omitProps: (keyof ApiChat)[] = [];

  const shouldOmitMinInfo = chatUpdate.isMin && chat && !chat.isMin;
  if (shouldOmitMinInfo) {
    omitProps.push('isMin', 'accessHash');
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
    ...(photo && { photos: [photo, ...(chat.photos || [])] }),
  };

  if (!updatedChat.id || !updatedChat.type) {
    return undefined;
  }

  return updatedChat;
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
  type: 'active' | 'archived',
  info: {
    orderedPinnedIds?: string[];
    totalChatCount: number;
  },
): T {
  const totalCountKey = type === 'active' ? 'all' : 'archived';

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
      isFullyLoaded: {
        ...global.chats.isFullyLoaded,
        [type]: false,
      },
    },
  };
}

export function leaveChat<T extends GlobalState>(global: T, leftChatId: string): T {
  const listType = selectChatListType(global, leftChatId);
  if (!listType) {
    return global;
  }

  const { [listType]: listIds } = global.chats.listIds;

  if (listIds) {
    global = replaceChatListIds(global, listType, listIds.filter((listId) => listId !== leftChatId));
  }

  global = updateChat(global, leftChatId, { isNotJoined: true });

  return global;
}

export function addChatMembers<T extends GlobalState>(global: T, chat: ApiChat, membersToAdd: ApiChatMember[]): T {
  const currentMembers = chat.fullInfo?.members;
  const newMemberIds = new Set(membersToAdd.map((m) => m.userId));
  const updatedMembers = [
    ...currentMembers?.filter((m) => !newMemberIds.has(m.userId)) || [],
    ...membersToAdd,
  ];
  const currentIds = currentMembers?.map(({ userId }) => userId) || [];
  const updatedIds = updatedMembers.map(({ userId }) => userId);

  if (areSortedArraysEqual(currentIds, updatedIds)) {
    return global;
  }

  const adminMembers = updatedMembers.filter(({ isAdmin, isOwner }) => isAdmin || isOwner);

  return updateChat(global, chat.id, {
    fullInfo: {
      ...chat.fullInfo,
      members: updatedMembers,
      adminMembersById: buildCollectionByKey(adminMembers, 'userId'),
    },
  });
}

export function updateListedTopicIds<T extends GlobalState>(
  global: T, chatId: string, topicIds: number[],
): T {
  return updateChat(global, chatId, {
    listedTopicIds: unique([
      ...(global.chats.byId[chatId]?.listedTopicIds || []),
      ...topicIds,
    ]),
  });
}

export function updateTopics<T extends GlobalState>(
  global: T, chatId: string, topicsCount: number, topics: ApiTopic[],
): T {
  const chat = selectChat(global, chatId);

  const newTopics = buildCollectionByKey(topics, 'id');

  global = updateChat(global, chatId, {
    topics: {
      ...chat?.topics,
      ...newTopics,
    },
    topicsCount,
  });

  topics.forEach((topic) => {
    global = updateThread(global, chatId, topic.id, {
      firstMessageId: topic.id,
    });

    global = updateThreadInfo(global, chatId, topic.id, {
      lastMessageId: topic.lastMessageId,
      threadId: topic.id,
      chatId,
    });
  });

  return global;
}

export function updateTopic<T extends GlobalState>(
  global: T, chatId: string, topicId: number, update: Partial<ApiTopic>,
): T {
  const chat = selectChat(global, chatId);

  if (!chat) return global;

  const topic = chat?.topics?.[topicId];

  const updatedTopic = {
    ...topic,
    ...update,
  } as ApiTopic;

  if (!updatedTopic.id) return global;

  global = updateChat(global, chatId, {
    topics: {
      ...(chat.topics || {}),
      [topicId]: updatedTopic,
    },
  });

  global = updateThread(global, chatId, updatedTopic.id, {
    firstMessageId: updatedTopic.id,
  });

  global = updateThreadInfo(global, chatId, updatedTopic.id, {
    lastMessageId: updatedTopic.lastMessageId,
    threadId: updatedTopic.id,
    chatId,
  });

  return global;
}

export function deleteTopic<T extends GlobalState>(
  global: T, chatId: string, topicId: number,
) {
  const chat = selectChat(global, chatId);
  const topics = chat?.topics || [];

  global = updateChat(global, chatId, {
    topics: omit(topics, [topicId]),
  });

  return global;
}

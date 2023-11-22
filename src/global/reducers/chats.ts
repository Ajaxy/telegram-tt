import type {
  ApiChat, ApiChatFullInfo, ApiChatMember, ApiPhoto, ApiTopic,
} from '../../api/types';
import type { GlobalState } from '../types';

import { ARCHIVED_FOLDER_ID } from '../../config';
import { areDeepEqual } from '../../util/areDeepEqual';
import {
  areSortedArraysEqual, buildCollectionByKey, omit, unique,
} from '../../util/iteratees';
import { selectChat, selectChatFullInfo } from '../selectors';
import { updateThread, updateThreadInfo } from './messages';

import { updateChatDone } from '../../hooks/useDone';

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

  updateChatDone(updatedChat);

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

    if (existingChat && !existingChat.isMin && (newChat.isMin || existingChat.accessHash === newChat.accessHash)) {
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
  global: T, chatId: string, chatUpdate: Partial<ApiChat>, photo?: ApiPhoto,
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
    ...(photo && { photos: [photo, ...(chat.photos || [])] }),
  } as ApiChat;

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
  global = removeChatFromChatLists(global, leftChatId);

  global = updateChat(global, leftChatId, { isNotJoined: true });

  return global;
}

export function removeChatFromChatLists<T extends GlobalState>(global: T, chatId: string): T {
  const lists = global.chats.listIds;
  Object.entries(lists).forEach(([listType, listIds]) => {
    global = replaceChatListIds(global, listType as keyof typeof lists, listIds.filter((id) => id !== chatId));
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

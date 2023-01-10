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

export function replaceChatListIds(
  global: GlobalState,
  type: 'active' | 'archived',
  newIds: string[] | undefined,
): GlobalState {
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

export function updateChatListIds(global: GlobalState, type: 'active' | 'archived', idsUpdate: string[]): GlobalState {
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

export function replaceChats(global: GlobalState, newById: Record<string, ApiChat>): GlobalState {
  return {
    ...global,
    chats: {
      ...global.chats,
      byId: newById,
    },
  };
}

export function updateChat(
  global: GlobalState, chatId: string, chatUpdate: Partial<ApiChat>, photo?: ApiPhoto,
  noOmitUnreadReactionCount = false,
): GlobalState {
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

export function updateChats(global: GlobalState, newById: Record<string, ApiChat>): GlobalState {
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
export function addChats(global: GlobalState, newById: Record<string, ApiChat>): GlobalState {
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
function getUpdatedChat(
  global: GlobalState, chatId: string, chatUpdate: Partial<ApiChat>, photo?: ApiPhoto,
  noOmitUnreadReactionCount = false,
) {
  const { byId } = global.chats;
  const chat = byId[chatId];
  const shouldOmitMinInfo = chatUpdate.isMin && chat && !chat.isMin;

  chatUpdate = noOmitUnreadReactionCount
    ? chatUpdate : omit(chatUpdate, ['unreadReactionsCount']);
  const updatedChat: ApiChat = {
    ...chat,
    ...(shouldOmitMinInfo
      ? omit(chatUpdate, ['isMin', 'accessHash'])
      : chatUpdate),
    ...(photo && { photos: [photo, ...(chat.photos || [])] }),
  };

  if (!updatedChat.id || !updatedChat.type) {
    return undefined;
  }

  return updatedChat;
}

export function updateChatListType(
  global: GlobalState,
  chatId: string,
  folderId?: number,
): GlobalState {
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

export function updateChatListSecondaryInfo(
  global: GlobalState,
  type: 'active' | 'archived',
  info: {
    orderedPinnedIds?: string[];
    totalChatCount: number;
  },
): GlobalState {
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

export function leaveChat(global: GlobalState, leftChatId: string): GlobalState {
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

export function addChatMembers(global: GlobalState, chat: ApiChat, membersToAdd: ApiChatMember[]): GlobalState {
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

  return updateChat(global, chat.id, {
    fullInfo: {
      ...chat.fullInfo,
      members: updatedMembers,
      adminMembersById: buildCollectionByKey(updatedMembers, 'userId'),
    },
  });
}

export function updateListedTopicIds(
  global: GlobalState, chatId: string, topicIds: number[],
): GlobalState {
  return updateChat(global, chatId, {
    listedTopicIds: unique([
      ...(global.chats.byId[chatId]?.listedTopicIds || []),
      ...topicIds,
    ]),
  });
}

export function updateTopics(
  global: GlobalState, chatId: string, topicsCount: number, topics: ApiTopic[],
): GlobalState {
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

export function updateTopic(
  global: GlobalState, chatId: string, topicId: number, update: Partial<ApiTopic>,
): GlobalState {
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

export function deleteTopic(
  global: GlobalState, chatId: string, topicId: number,
) {
  const chat = selectChat(global, chatId);
  const topics = chat?.topics || [];

  global = updateChat(global, chatId, {
    topics: omit(topics, [topicId]),
  });

  return global;
}

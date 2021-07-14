import { GlobalState } from '../../global/types';
import { ApiChat, ApiPhoto } from '../../api/types';

import { ARCHIVED_FOLDER_ID } from '../../config';
import { omit } from '../../util/iteratees';

export function replaceChatListIds(
  global: GlobalState,
  type: 'active' | 'archived',
  newIds: number[] | undefined,
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

export function updateChatListIds(global: GlobalState, type: 'active' | 'archived', idsUpdate: number[]): GlobalState {
  const { [type]: listIds } = global.chats.listIds;
  const newIds = listIds && listIds.length
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

export function replaceChats(global: GlobalState, newById: Record<number, ApiChat>): GlobalState {
  return {
    ...global,
    chats: {
      ...global.chats,
      byId: newById,
    },
  };
}

// @optimization Don't spread/unspread global for each element, do it in a batch
function getUpdatedChat(
  global: GlobalState, chatId: number, chatUpdate: Partial<ApiChat>, photo?: ApiPhoto,
): ApiChat {
  const { byId } = global.chats;
  const chat = byId[chatId];
  const shouldOmitMinInfo = chatUpdate.isMin && chat && !chat.isMin;
  const updatedChat = {
    ...chat,
    ...(shouldOmitMinInfo ? omit(chatUpdate, ['isMin', 'accessHash']) : chatUpdate),
    ...(photo && { photos: [photo, ...(chat.photos || [])] }),
  };

  if (!updatedChat.id || !updatedChat.type) {
    return updatedChat;
  }

  return updatedChat;
}

export function updateChat(
  global: GlobalState, chatId: number, chatUpdate: Partial<ApiChat>, photo?: ApiPhoto,
): GlobalState {
  const { byId } = global.chats;

  const updatedChat = getUpdatedChat(global, chatId, chatUpdate, photo);

  return replaceChats(global, {
    ...byId,
    [chatId]: updatedChat,
  });
}

export function updateChats(global: GlobalState, updatedById: Record<number, ApiChat>): GlobalState {
  const updatedChats = Object.keys(updatedById).map(Number).reduce<Record<number, ApiChat>>((acc, id) => {
    const updatedChat = getUpdatedChat(global, id, updatedById[id]);
    if (updatedChat) {
      acc[id] = updatedChat;
    }
    return acc;
  }, {});

  global = replaceChats(global, {
    ...global.chats.byId,
    ...updatedChats,
  });

  return global;
}

// @optimization Allows to avoid redundant updates which cause a lot of renders
export function addChats(global: GlobalState, addedById: Record<number, ApiChat>): GlobalState {
  const { byId } = global.chats;
  let isAdded = false;

  const addedChats = Object.keys(addedById).map(Number).reduce<Record<number, ApiChat>>((acc, id) => {
    if (!byId[id] || (byId[id].isMin && !addedById[id].isMin)) {
      const updatedChat = getUpdatedChat(global, id, addedById[id]);
      if (updatedChat) {
        acc[id] = updatedChat;

        if (!isAdded) {
          isAdded = true;
        }
      }
    }
    return acc;
  }, {});

  if (isAdded) {
    global = replaceChats(global, {
      ...global.chats.byId,
      ...addedChats,
    });
  }

  return global;
}

export function updateChatListType(
  global: GlobalState,
  chatId: number,
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
    orderedPinnedIds?: number[];
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

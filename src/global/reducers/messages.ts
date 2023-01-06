import type {
  GlobalState, MessageList, MessageListType, Thread,
} from '../types';
import type { ApiMessage, ApiSponsoredMessage, ApiThreadInfo } from '../../api/types';
import { MAIN_THREAD_ID } from '../../api/types';
import type { FocusDirection } from '../../types';

import {
  IS_MOCKED_CLIENT,
  IS_TEST, MESSAGE_LIST_SLICE, MESSAGE_LIST_VIEWPORT_LIMIT, TMP_CHAT_ID,
} from '../../config';
import {
  selectListedIds,
  selectChatMessages,
  selectViewportIds,
  selectOutlyingIds,
  selectPinnedIds,
  selectThreadInfo,
  selectMessageIdsByGroupId,
  selectChatScheduledMessages,
  selectScheduledIds,
  selectCurrentMessageIds,
  selectChatMessage,
  selectCurrentMessageList,
  selectChat,
} from '../selectors';
import {
  areSortedArraysEqual, omit, pickTruthy, unique,
} from '../../util/iteratees';

type MessageStoreSections = {
  byId: Record<number, ApiMessage>;
  threadsById: Record<number, Thread>;
};

export function updateCurrentMessageList(
  global: GlobalState,
  chatId: string | undefined,
  threadId: number = MAIN_THREAD_ID,
  type: MessageListType = 'thread',
  shouldReplaceHistory?: boolean,
): GlobalState {
  const { messageLists } = global.messages;
  let newMessageLists: MessageList[] = messageLists;
  if (shouldReplaceHistory || (IS_TEST && !IS_MOCKED_CLIENT)) {
    newMessageLists = chatId ? [{ chatId, threadId, type }] : [];
  } else if (chatId) {
    const last = messageLists[messageLists.length - 1];
    if (!last || last.chatId !== chatId || last.threadId !== threadId || last.type !== type) {
      if (last && last.chatId === TMP_CHAT_ID) {
        newMessageLists = [...messageLists.slice(0, -1), { chatId, threadId, type }];
      } else {
        newMessageLists = [...messageLists, { chatId, threadId, type }];
      }
    }
  } else {
    newMessageLists = messageLists.slice(0, -1);
  }

  return {
    ...global,
    messages: {
      ...global.messages,
      messageLists: newMessageLists,
    },
  };
}

function replaceChatMessages(global: GlobalState, chatId: string, newById: Record<number, ApiMessage>): GlobalState {
  return updateMessageStore(global, chatId, {
    byId: newById,
  });
}

export function updateThread(
  global: GlobalState, chatId: string, threadId: number, threadUpdate: Partial<Thread>,
): GlobalState {
  const current = global.messages.byChatId[chatId];

  if (threadUpdate.listedIds?.length) {
    const lastListedId = threadUpdate.listedIds[threadUpdate.listedIds.length - 1];
    if (lastListedId) {
      global = updateTopicLastMessageId(global, chatId, threadId, lastListedId);
    }
  }

  return updateMessageStore(global, chatId, {
    threadsById: {
      ...(current?.threadsById),
      [threadId]: {
        ...(current?.threadsById[threadId]),
        ...threadUpdate,
      },
    },
  });
}

function updateMessageStore(
  global: GlobalState, chatId: string, update: Partial<MessageStoreSections>,
): GlobalState {
  const current = global.messages.byChatId[chatId] || { byId: {}, threadsById: {} };

  return {
    ...global,
    messages: {
      ...global.messages,
      byChatId: {
        ...global.messages.byChatId,
        [chatId]: {
          ...current,
          ...update,
        },
      },
    },
  };
}

export function replaceThreadParam<T extends keyof Thread>(
  global: GlobalState, chatId: string, threadId: number, paramName: T, newValue: Thread[T] | undefined,
) {
  return updateThread(global, chatId, threadId, { [paramName]: newValue });
}

export function addMessages(
  global: GlobalState, messages: ApiMessage[],
): GlobalState {
  const addedByChatId = messages.reduce((messagesByChatId, message: ApiMessage) => {
    if (!messagesByChatId[message.chatId]) {
      messagesByChatId[message.chatId] = {};
    }
    messagesByChatId[message.chatId][message.id] = message;

    return messagesByChatId;
  }, {} as Record<string, Record<number, ApiMessage>>);

  Object.keys(addedByChatId).forEach((chatId) => {
    global = addChatMessagesById(global, chatId, addedByChatId[chatId]);
  });

  return global;
}

export function addChatMessagesById(
  global: GlobalState, chatId: string, newById: Record<number, ApiMessage>,
): GlobalState {
  const byId = selectChatMessages(global, chatId);

  if (byId && Object.keys(newById).every((newId) => Boolean(byId[Number(newId)]))) {
    return global;
  }

  return replaceChatMessages(global, chatId, {
    ...newById,
    ...byId,
  });
}

export function updateChatMessage(
  global: GlobalState, chatId: string, messageId: number, messageUpdate: Partial<ApiMessage>,
): GlobalState {
  const byId = selectChatMessages(global, chatId) || {};
  const message = byId[messageId];
  const updatedMessage = {
    ...message,
    ...messageUpdate,
  };

  if (!updatedMessage.id) {
    return global;
  }

  return replaceChatMessages(global, chatId, {
    ...byId,
    [messageId]: updatedMessage,
  });
}

export function updateScheduledMessage(
  global: GlobalState, chatId: string, messageId: number, messageUpdate: Partial<ApiMessage>,
): GlobalState {
  const byId = selectChatScheduledMessages(global, chatId) || {};
  const message = byId[messageId];
  const updatedMessage = {
    ...message,
    ...messageUpdate,
  };

  if (!updatedMessage.id) {
    return global;
  }

  return replaceScheduledMessages(global, chatId, {
    ...byId,
    [messageId]: updatedMessage,
  });
}

export function deleteChatMessages(
  global: GlobalState,
  chatId: string,
  messageIds: number[],
): GlobalState {
  const byId = selectChatMessages(global, chatId);
  if (!byId) {
    return global;
  }
  const newById = omit(byId, messageIds);
  const deletedForwardedPosts = Object.values(pickTruthy(byId, messageIds)).filter(
    ({ forwardInfo }) => forwardInfo?.isLinkedChannelPost,
  );

  const threadIds = Object.keys(global.messages.byChatId[chatId].threadsById).map(Number);
  threadIds.forEach((threadId) => {
    const threadInfo = selectThreadInfo(global, chatId, threadId);

    let listedIds = selectListedIds(global, chatId, threadId);
    let outlyingIds = selectOutlyingIds(global, chatId, threadId);
    let viewportIds = selectViewportIds(global, chatId, threadId);
    let pinnedIds = selectPinnedIds(global, chatId, threadId);
    let mainPinnedIds = selectPinnedIds(global, chatId, MAIN_THREAD_ID);
    let newMessageCount = threadInfo?.messagesCount;

    messageIds.forEach((messageId) => {
      if (listedIds?.includes(messageId)) {
        listedIds = listedIds.filter((id) => id !== messageId);
        if (newMessageCount !== undefined) newMessageCount -= 1;
      }

      if (outlyingIds?.includes(messageId)) {
        outlyingIds = outlyingIds.filter((id) => id !== messageId);
      }

      if (viewportIds?.includes(messageId)) {
        viewportIds = viewportIds.filter((id) => id !== messageId);
      }

      if (pinnedIds?.includes(messageId)) {
        pinnedIds = pinnedIds.filter((id) => id !== messageId);
      }

      if (mainPinnedIds?.includes(messageId)) {
        mainPinnedIds = mainPinnedIds.filter((id) => id !== messageId);
      }
    });

    global = replaceThreadParam(global, chatId, threadId, 'listedIds', listedIds);
    global = replaceThreadParam(global, chatId, threadId, 'outlyingIds', outlyingIds);
    global = replaceThreadParam(global, chatId, threadId, 'viewportIds', viewportIds);
    global = replaceThreadParam(global, chatId, threadId, 'pinnedIds', pinnedIds);
    global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'pinnedIds', mainPinnedIds);

    if (threadInfo && newMessageCount !== undefined) {
      global = replaceThreadParam(global, chatId, threadId, 'threadInfo', {
        ...threadInfo,
        messagesCount: newMessageCount,
      });
    }
  });

  if (deletedForwardedPosts.length) {
    const currentMessageList = selectCurrentMessageList(global);
    const canDeleteCurrentThread = currentMessageList && currentMessageList.chatId === chatId
      && currentMessageList.type === 'thread';
    const currentThreadId = currentMessageList?.threadId;

    deletedForwardedPosts.forEach((message) => {
      const { fromChatId, fromMessageId } = message.forwardInfo!;
      const originalPost = selectChatMessage(global, fromChatId!, fromMessageId!);

      if (canDeleteCurrentThread && currentThreadId === fromMessageId) {
        global = updateCurrentMessageList(global, chatId);
      }
      if (originalPost) {
        global = updateChatMessage(global, fromChatId!, fromMessageId!, { threadInfo: undefined });
      }
    });
  }

  global = replaceChatMessages(global, chatId, newById);

  return global;
}

export function deleteChatScheduledMessages(
  global: GlobalState,
  chatId: string,
  messageIds: number[],
): GlobalState {
  const byId = selectChatScheduledMessages(global, chatId);
  if (!byId) {
    return global;
  }
  const newById = omit(byId, messageIds);

  let scheduledIds = selectScheduledIds(global, chatId, MAIN_THREAD_ID);
  if (scheduledIds) {
    messageIds.forEach((messageId) => {
      if (scheduledIds!.includes(messageId)) {
        scheduledIds = scheduledIds!.filter((id) => id !== messageId);
      }
    });
    global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'scheduledIds', scheduledIds);

    Object.entries(global.messages.byChatId[chatId].threadsById).forEach(([threadId, thread]) => {
      if (thread.scheduledIds) {
        const newScheduledIds = thread.scheduledIds.filter((id) => !messageIds.includes(id));
        global = replaceThreadParam(global, chatId, Number(threadId), 'scheduledIds', newScheduledIds);
      }
    });
  }

  global = replaceScheduledMessages(global, chatId, newById);

  return global;
}

export function updateListedIds(
  global: GlobalState,
  chatId: string,
  threadId: number,
  idsUpdate: number[],
): GlobalState {
  const listedIds = selectListedIds(global, chatId, threadId);
  const newIds = listedIds?.length
    ? idsUpdate.filter((id) => !listedIds.includes(id))
    : idsUpdate;

  if (listedIds && !newIds.length) {
    return global;
  }

  return replaceThreadParam(global, chatId, threadId, 'listedIds', orderHistoryIds([
    ...(listedIds || []),
    ...newIds,
  ]));
}

export function updateOutlyingIds(
  global: GlobalState,
  chatId: string,
  threadId: number,
  idsUpdate: number[],
): GlobalState {
  const outlyingIds = selectOutlyingIds(global, chatId, threadId);
  const newIds = outlyingIds?.length
    ? idsUpdate.filter((id) => !outlyingIds.includes(id))
    : idsUpdate;

  if (outlyingIds && !newIds.length) {
    return global;
  }

  return replaceThreadParam(global, chatId, threadId, 'outlyingIds', orderHistoryIds([
    ...(outlyingIds || []),
    ...newIds,
  ]));
}

function orderHistoryIds(listedIds: number[]) {
  return listedIds.sort((a, b) => a - b);
}

export function addViewportId(
  global: GlobalState,
  chatId: string,
  threadId: number,
  newId: number,
): GlobalState {
  const viewportIds = selectViewportIds(global, chatId, threadId) || [];
  if (viewportIds.includes(newId)) {
    return global;
  }

  const newIds = orderHistoryIds([
    ...(
      viewportIds.length < MESSAGE_LIST_VIEWPORT_LIMIT
        ? viewportIds
        : viewportIds.slice(-(MESSAGE_LIST_SLICE / 2))
    ),
    newId,
  ]);

  return replaceThreadParam(global, chatId, threadId, 'viewportIds', newIds);
}

export function safeReplaceViewportIds(
  global: GlobalState,
  chatId: string,
  threadId: number,
  newViewportIds: number[],
): GlobalState {
  const currentIds = selectViewportIds(global, chatId, threadId) || [];
  const newIds = orderHistoryIds(newViewportIds);

  return replaceThreadParam(
    global,
    chatId,
    threadId,
    'viewportIds',
    areSortedArraysEqual(currentIds, newIds) ? currentIds : newIds,
  );
}

export function updateThreadInfo(
  global: GlobalState, chatId: string, threadId: number, update: Partial<ApiThreadInfo> | undefined,
): GlobalState {
  const newThreadInfo = {
    ...(selectThreadInfo(global, chatId, threadId) as ApiThreadInfo),
    ...update,
  };

  if (!newThreadInfo.threadId) {
    return global;
  }

  return replaceThreadParam(global, chatId, threadId, 'threadInfo', newThreadInfo);
}

export function updateThreadInfos(
  global: GlobalState, chatId: string, updates: Partial<ApiThreadInfo>[],
): GlobalState {
  updates.forEach((update) => {
    global = updateThreadInfo(global, update.chatId!, update.threadId!, update);
  });

  return global;
}

export function replaceScheduledMessages(
  global: GlobalState, chatId: string, newById: Record<number, ApiMessage>,
): GlobalState {
  return updateScheduledMessages(global, chatId, {
    byId: newById,
  });
}

function updateScheduledMessages(
  global: GlobalState, chatId: string, update: Partial<{ byId: Record<number, ApiMessage> }>,
): GlobalState {
  const current = global.scheduledMessages.byChatId[chatId] || { byId: {}, hash: 0 };

  return {
    ...global,
    scheduledMessages: {
      byChatId: {
        ...global.scheduledMessages.byChatId,
        [chatId]: {
          ...current,
          ...update,
        },
      },
    },
  };
}

export function updateFocusedMessage(
  global: GlobalState, chatId?: string, messageId?: number, noHighlight = false, isResizingContainer = false,
): GlobalState {
  return {
    ...global,
    focusedMessage: {
      ...global.focusedMessage,
      chatId,
      messageId,
      noHighlight,
      isResizingContainer,
    },
  };
}

export function updateSponsoredMessage(
  global: GlobalState, chatId: string, message: ApiSponsoredMessage,
): GlobalState {
  return {
    ...global,
    messages: {
      ...global.messages,
      sponsoredByChatId: {
        ...global.messages.sponsoredByChatId,
        [chatId]: message,
      },
    },
  };
}

export function updateFocusDirection(
  global: GlobalState, direction?: FocusDirection,
): GlobalState {
  return {
    ...global,
    focusedMessage: {
      ...global.focusedMessage,
      direction,
    },
  };
}

export function enterMessageSelectMode(
  global: GlobalState,
  chatId: string,
  messageId?: number | number[],
): GlobalState {
  const messageIds = messageId ? Array.prototype.concat([], messageId) : [];
  return {
    ...global,
    selectedMessages: {
      chatId,
      messageIds,
    },
  };
}

export function toggleMessageSelection(
  global: GlobalState,
  chatId: string,
  threadId: number,
  messageListType: MessageListType,
  messageId: number,
  groupedId?: string,
  childMessageIds?: number[],
  withShift = false,
): GlobalState {
  const { selectedMessages: oldSelectedMessages } = global;
  if (groupedId) {
    childMessageIds = selectMessageIdsByGroupId(global, chatId, groupedId);
  }
  const selectedMessageIds = childMessageIds || [messageId];
  if (!oldSelectedMessages) {
    return enterMessageSelectMode(global, chatId, selectedMessageIds);
  }

  const { messageIds } = oldSelectedMessages;

  let newMessageIds;
  const newSelectedMessageIds = selectedMessageIds.filter((id) => !messageIds.includes(id));
  if (newSelectedMessageIds && !newSelectedMessageIds.length) {
    newMessageIds = messageIds.filter((id) => !selectedMessageIds.includes(id));
  } else if (withShift && messageIds.length) {
    const viewportIds = selectCurrentMessageIds(global, chatId, threadId, messageListType)!;
    const prevIndex = viewportIds.indexOf(messageIds[messageIds.length - 1]);
    const currentIndex = viewportIds.indexOf(messageId);
    const from = Math.min(prevIndex, currentIndex);
    const to = Math.max(prevIndex, currentIndex);
    const slice = viewportIds.slice(from, to + 1);
    newMessageIds = unique([...messageIds, ...slice]);
  } else {
    newMessageIds = [...messageIds, ...newSelectedMessageIds];
  }

  if (!newMessageIds.length) {
    return exitMessageSelectMode(global);
  }

  return {
    ...global,
    selectedMessages: {
      ...oldSelectedMessages,
      messageIds: newMessageIds,
    },
  };
}

export function exitMessageSelectMode(global: GlobalState): GlobalState {
  return {
    ...global,
    selectedMessages: undefined,
  };
}

export function updateThreadUnreadFromForwardedMessage(
  global: GlobalState,
  originMessage: ApiMessage,
  chatId: string,
  lastMessageId: number,
  isDeleting?: boolean,
) {
  const { channelPostId, fromChatId } = originMessage.forwardInfo || {};
  if (channelPostId && fromChatId) {
    const threadInfoOld = selectThreadInfo(global, chatId, channelPostId);
    if (threadInfoOld) {
      global = replaceThreadParam(global, chatId, channelPostId, 'threadInfo', {
        ...threadInfoOld,
        lastMessageId,
        messagesCount: threadInfoOld.messagesCount + (isDeleting ? -1 : 1),
      });
    }
  }
  return global;
}

export function updateTopicLastMessageId(
  global: GlobalState, chatId: string, threadId: number, lastMessageId: number,
) {
  const chat = selectChat(global, chatId);
  if (!chat?.topics?.[threadId]) return global;
  return {
    ...global,
    chats: {
      ...global.chats,
      byId: {
        ...global.chats.byId,
        [chatId]: {
          ...chat,
          topics: {
            ...chat.topics,
            [threadId]: {
              ...chat.topics[threadId],
              lastMessageId,
            },
          },
        },
      },
    },
  };
}

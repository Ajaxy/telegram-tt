import type {
  GlobalState, MessageList, MessageListType, TabArgs, Thread, TabThread,
} from '../types';
import type {
  ApiMessage, ApiSponsoredMessage, ApiThreadInfo,
} from '../../api/types';
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
  selectTabState,
} from '../selectors';
import {
  areSortedArraysEqual, omit, pickTruthy, unique,
} from '../../util/iteratees';
import { updateTabState } from './tabs';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import { isLocalMessageId } from '../helpers';

type MessageStoreSections = {
  byId: Record<number, ApiMessage>;
  threadsById: Record<number, Thread>;
};

export function updateCurrentMessageList<T extends GlobalState>(
  global: T,
  chatId: string | undefined,
  threadId: number = MAIN_THREAD_ID,
  type: MessageListType = 'thread',
  shouldReplaceHistory?: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const { messageLists } = selectTabState(global, tabId);
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

  return updateTabState(global, {
    messageLists: newMessageLists,
  }, tabId);
}

function replaceChatMessages<T extends GlobalState>(global: T, chatId: string, newById: Record<number, ApiMessage>): T {
  return updateMessageStore(global, chatId, {
    byId: newById,
  });
}

export function updateTabThread<T extends GlobalState>(
  global: T, chatId: string, threadId: number, threadUpdate: Partial<TabThread>,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const tabState = selectTabState(global, tabId);
  const current = tabState.tabThreads[chatId]?.[threadId] || {};

  return updateTabState(global, {
    tabThreads: {
      ...tabState.tabThreads,
      [chatId]: {
        ...tabState.tabThreads[chatId],
        [threadId]: {
          ...current,
          ...threadUpdate,
        },
      },
    },
  }, tabId);
}

export function updateThread<T extends GlobalState>(
  global: T, chatId: string, threadId: number, threadUpdate: Partial<Thread>,
): T {
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

function updateMessageStore<T extends GlobalState>(
  global: T, chatId: string, update: Partial<MessageStoreSections>,
): T {
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

export function replaceTabThreadParam<T extends GlobalState, K extends keyof TabThread>(
  global: T, chatId: string, threadId: number, paramName: K, newValue: TabThread[K] | undefined,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  if (paramName === 'viewportIds') {
    global = replaceThreadParam(
      global, chatId, threadId, 'lastViewportIds', newValue as number[] | undefined,
    );
  }
  return updateTabThread(global, chatId, threadId, { [paramName]: newValue }, tabId);
}

export function replaceThreadParam<T extends GlobalState, K extends keyof Thread>(
  global: T, chatId: string, threadId: number, paramName: K, newValue: Thread[K] | undefined,
) {
  return updateThread(global, chatId, threadId, { [paramName]: newValue });
}

export function addMessages<T extends GlobalState>(
  global: T, messages: ApiMessage[],
): T {
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

export function addChatMessagesById<T extends GlobalState>(
  global: T, chatId: string, newById: Record<number, ApiMessage>,
): T {
  const byId = selectChatMessages(global, chatId);

  if (byId && Object.keys(newById).every((newId) => Boolean(byId[Number(newId)]))) {
    return global;
  }

  return replaceChatMessages(global, chatId, {
    ...newById,
    ...byId,
  });
}

export function updateChatMessage<T extends GlobalState>(
  global: T, chatId: string, messageId: number, messageUpdate: Partial<ApiMessage>,
): T {
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

export function updateScheduledMessage<T extends GlobalState>(
  global: T, chatId: string, messageId: number, messageUpdate: Partial<ApiMessage>,
): T {
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

export function deleteChatMessages<T extends GlobalState>(
  global: T,
  chatId: string,
  messageIds: number[],
): T {
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
    let pinnedIds = selectPinnedIds(global, chatId, threadId);
    let mainPinnedIds = selectPinnedIds(global, chatId, MAIN_THREAD_ID);
    let newMessageCount = threadInfo?.messagesCount;

    messageIds.forEach((messageId) => {
      if (listedIds?.includes(messageId)) {
        listedIds = listedIds.filter((id) => id !== messageId);
        if (newMessageCount !== undefined && !isLocalMessageId(messageId)) newMessageCount -= 1;
      }

      if (pinnedIds?.includes(messageId)) {
        pinnedIds = pinnedIds.filter((id) => id !== messageId);
      }

      if (mainPinnedIds?.includes(messageId)) {
        mainPinnedIds = mainPinnedIds.filter((id) => id !== messageId);
      }
    });

    Object.values(global.byTabId).forEach(({ id: tabId }) => {
      let outlyingIds = selectOutlyingIds(global, chatId, threadId, tabId);
      let viewportIds = selectViewportIds(global, chatId, threadId, tabId);

      messageIds.forEach((messageId) => {
        if (outlyingIds?.includes(messageId)) {
          outlyingIds = outlyingIds.filter((id) => id !== messageId);
        }

        if (viewportIds?.includes(messageId)) {
          viewportIds = viewportIds.filter((id) => id !== messageId);
        }
      });

      global = replaceTabThreadParam(global, chatId, threadId, 'outlyingIds', outlyingIds, tabId);
      global = replaceTabThreadParam(global, chatId, threadId, 'viewportIds', viewportIds, tabId);
    });

    global = replaceThreadParam(global, chatId, threadId, 'listedIds', listedIds);
    global = replaceThreadParam(global, chatId, threadId, 'pinnedIds', pinnedIds);
    global = replaceThreadParam(global, chatId, MAIN_THREAD_ID, 'pinnedIds', mainPinnedIds);

    if (threadInfo && newMessageCount !== undefined) {
      global = updateThreadInfo(global, chatId, threadId, {
        messagesCount: newMessageCount,
      });
    }
  });

  if (deletedForwardedPosts.length) {
    Object.values(global.byTabId).forEach(({ id: tabId }) => {
      const currentMessageList = selectCurrentMessageList(global, tabId);
      const canDeleteCurrentThread = currentMessageList && currentMessageList.chatId === chatId
        && currentMessageList.type === 'thread';
      const currentThreadId = currentMessageList?.threadId;

      deletedForwardedPosts.forEach((message) => {
        const { fromChatId, fromMessageId } = message.forwardInfo!;
        const originalPost = selectChatMessage(global, fromChatId!, fromMessageId!);

        if (canDeleteCurrentThread && currentThreadId === fromMessageId) {
          global = updateCurrentMessageList(global, chatId, undefined, undefined, undefined, tabId);
        }
        if (originalPost) {
          global = updateChatMessage(global, fromChatId!, fromMessageId!, { repliesThreadInfo: undefined });
        }
      });
    });
  }

  global = replaceChatMessages(global, chatId, newById);

  return global;
}

export function deleteChatScheduledMessages<T extends GlobalState>(
  global: T,
  chatId: string,
  messageIds: number[],
): T {
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

export function updateListedIds<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: number,
  idsUpdate: number[],
): T {
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

export function updateOutlyingIds<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: number,
  idsUpdate: number[],
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const outlyingIds = selectOutlyingIds(global, chatId, threadId, tabId);
  const newIds = outlyingIds?.length
    ? idsUpdate.filter((id) => !outlyingIds.includes(id))
    : idsUpdate;

  if (outlyingIds && !newIds.length) {
    return global;
  }

  return replaceTabThreadParam(global, chatId, threadId, 'outlyingIds', orderHistoryIds([
    ...(outlyingIds || []),
    ...newIds,
  ]), tabId);
}

function orderHistoryIds(listedIds: number[]) {
  return listedIds.sort((a, b) => a - b);
}

export function addViewportId<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: number,
  newId: number,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const viewportIds = selectViewportIds(global, chatId, threadId, tabId) || [];
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

  return replaceTabThreadParam(global, chatId, threadId, 'viewportIds', newIds, tabId);
}

export function safeReplaceViewportIds<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: number,
  newViewportIds: number[],
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const currentIds = selectViewportIds(global, chatId, threadId, tabId) || [];
  const newIds = orderHistoryIds(newViewportIds);

  return replaceTabThreadParam(
    global,
    chatId,
    threadId,
    'viewportIds',
    areSortedArraysEqual(currentIds, newIds) ? currentIds : newIds,
    tabId,
  );
}

export function updateThreadInfo<T extends GlobalState>(
  global: T, chatId: string, threadId: number, update: Partial<ApiThreadInfo> | undefined,
): T {
  const newThreadInfo = {
    ...(selectThreadInfo(global, chatId, threadId) as ApiThreadInfo),
    ...update,
  };

  if (!newThreadInfo.threadId) {
    return global;
  }

  return replaceThreadParam(global, chatId, threadId, 'threadInfo', newThreadInfo);
}

export function updateThreadInfos<T extends GlobalState>(
  global: T, chatId: string, updates: Partial<ApiThreadInfo>[],
): T {
  updates.forEach((update) => {
    global = updateThreadInfo(global, update.chatId!, update.threadId!, update);
  });

  return global;
}

export function replaceScheduledMessages<T extends GlobalState>(
  global: T, chatId: string, newById: Record<number, ApiMessage>,
): T {
  return updateScheduledMessages(global, chatId, {
    byId: newById,
  });
}

function updateScheduledMessages<T extends GlobalState>(
  global: T, chatId: string, update: Partial<{ byId: Record<number, ApiMessage> }>,
): T {
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

export function updateFocusedMessage<T extends GlobalState>(
  global: T, chatId?: string, messageId?: number, noHighlight = false, isResizingContainer = false,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    focusedMessage: {
      ...selectTabState(global, tabId).focusedMessage,
      chatId,
      messageId,
      noHighlight,
      isResizingContainer,
    },
  }, tabId);
}

export function updateFocusedMessageReached<T extends GlobalState>(
  global: T, hasReachedMessage: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const focusedMessage = selectTabState(global, tabId).focusedMessage;

  if (!focusedMessage) return global;

  return updateTabState(global, {
    focusedMessage: {
      ...focusedMessage,
      hasReachedMessage,
    },
  }, tabId);
}

export function updateSponsoredMessage<T extends GlobalState>(
  global: T, chatId: string, message: ApiSponsoredMessage,
): T {
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

export function updateFocusDirection<T extends GlobalState>(
  global: T, direction?: FocusDirection,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    focusedMessage: {
      ...selectTabState(global, tabId).focusedMessage,
      direction,
    },
  }, tabId);
}

export function enterMessageSelectMode<T extends GlobalState>(
  global: T,
  chatId: string,
  messageId?: number | number[],
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const messageIds = messageId ? Array.prototype.concat([], messageId) : [];

  return updateTabState(global, {
    selectedMessages: {
      chatId,
      messageIds,
    },
  }, tabId);
}

export function toggleMessageSelection<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: number,
  messageListType: MessageListType,
  messageId: number,
  groupedId?: string,
  childMessageIds?: number[],
  withShift = false,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const { selectedMessages: oldSelectedMessages } = selectTabState(global, tabId);
  if (groupedId) {
    childMessageIds = selectMessageIdsByGroupId(global, chatId, groupedId);
  }
  const selectedMessageIds = childMessageIds || [messageId];
  if (!oldSelectedMessages) {
    return enterMessageSelectMode(global, chatId, selectedMessageIds, tabId);
  }

  const { messageIds } = oldSelectedMessages;

  let newMessageIds;
  const newSelectedMessageIds = selectedMessageIds.filter((id) => !messageIds.includes(id));
  if (newSelectedMessageIds && !newSelectedMessageIds.length) {
    newMessageIds = messageIds.filter((id) => !selectedMessageIds.includes(id));
  } else if (withShift && messageIds.length) {
    const viewportIds = selectCurrentMessageIds(global, chatId, threadId, messageListType, tabId)!;
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
    return exitMessageSelectMode(global, tabId);
  }

  return updateTabState(global, {
    selectedMessages: {
      ...oldSelectedMessages,
      messageIds: newMessageIds,
    },
  }, tabId);
}

export function exitMessageSelectMode<T extends GlobalState>(
  global: T,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    selectedMessages: undefined,
  }, tabId);
}

export function updateThreadUnreadFromForwardedMessage<T extends GlobalState>(
  global: T,
  originMessage: ApiMessage,
  chatId: string,
  lastMessageId: number,
  isDeleting?: boolean,
): T {
  const { channelPostId, fromChatId } = originMessage.forwardInfo || {};
  if (channelPostId && fromChatId) {
    const threadInfoOld = selectThreadInfo(global, chatId, channelPostId);
    if (threadInfoOld) {
      global = replaceThreadParam(global, chatId, channelPostId, 'threadInfo', {
        ...threadInfoOld,
        lastMessageId,
        messagesCount: (threadInfoOld.messagesCount || 0) + (isDeleting ? -1 : 1),
      });
    }
  }
  return global;
}

export function updateTopicLastMessageId<T extends GlobalState>(
  global: T, chatId: string, threadId: number, lastMessageId: number,
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

import type {
  ApiMessage, ApiSponsoredMessage, ApiThreadInfo,
} from '../../api/types';
import type { FocusDirection } from '../../types';
import type {
  GlobalState, MessageList, MessageListType, TabArgs, TabThread,
  Thread,
} from '../types';
import { MAIN_THREAD_ID } from '../../api/types';

import {
  IS_MOCKED_CLIENT,
  IS_TEST, MESSAGE_LIST_SLICE, MESSAGE_LIST_VIEWPORT_LIMIT, TMP_CHAT_ID,
} from '../../config';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import {
  areSortedArraysEqual, excludeSortedArray, omit, pick, pickTruthy, unique,
} from '../../util/iteratees';
import {
  isLocalMessageId, mergeIdRanges, orderHistoryIds, orderPinnedIds,
} from '../helpers';
import {
  selectChat,
  selectChatMessage,
  selectChatMessages,
  selectChatScheduledMessages,
  selectCurrentMessageIds,
  selectCurrentMessageList,
  selectListedIds,
  selectMessageIdsByGroupId,
  selectOutlyingLists,
  selectPinnedIds,
  selectScheduledIds,
  selectTabState, selectThreadIdFromMessage, selectThreadInfo,
  selectViewportIds,
} from '../selectors';
import { updateTabState } from './tabs';

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
  shouldReplaceLast?: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const { messageLists } = selectTabState(global, tabId);
  let newMessageLists: MessageList[] = messageLists;
  if (shouldReplaceHistory || (IS_TEST && !IS_MOCKED_CLIENT)) {
    newMessageLists = chatId ? [{ chatId, threadId, type }] : [];
  } else if (chatId) {
    const last = messageLists[messageLists.length - 1];
    if (!last || last.chatId !== chatId || last.threadId !== threadId || last.type !== type) {
      if (last && (last.chatId === TMP_CHAT_ID || shouldReplaceLast)) {
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
  global: T, chatId: string, threadId: number, threadUpdate: Partial<Thread> | undefined,
): T {
  if (!threadUpdate) {
    return updateMessageStore(global, chatId, {
      threadsById: omit(global.messages.byChatId[chatId]?.threadsById, [threadId]),
    });
  }

  const current = global.messages.byChatId[chatId];

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

  orderHistoryIds(messageIds);
  const updatedThreads = new Map<number, number[]>();
  updatedThreads.set(MAIN_THREAD_ID, messageIds);

  messageIds.forEach((messageId) => {
    const message = byId[messageId];
    if (!message) return;
    const threadId = selectThreadIdFromMessage(global, message);
    if (!threadId || threadId === MAIN_THREAD_ID) return;
    const threadMessages = updatedThreads.get(threadId) || [];
    threadMessages.push(messageId);
    updatedThreads.set(threadId, threadMessages);
  });

  const deletedForwardedPosts = Object.values(pickTruthy(byId, messageIds)).filter(
    ({ forwardInfo }) => forwardInfo?.isLinkedChannelPost,
  );

  updatedThreads.forEach((threadMessageIds, threadId) => {
    const threadInfo = selectThreadInfo(global, chatId, threadId);

    let listedIds = selectListedIds(global, chatId, threadId);
    let pinnedIds = selectPinnedIds(global, chatId, threadId);
    let outlyingLists = selectOutlyingLists(global, chatId, threadId);
    let newMessageCount = threadInfo?.messagesCount;

    if (listedIds) {
      listedIds = excludeSortedArray(listedIds, threadMessageIds);
    }

    if (outlyingLists) {
      outlyingLists = outlyingLists.map((list) => excludeSortedArray(list, threadMessageIds));
    }

    if (pinnedIds) {
      pinnedIds = excludeSortedArray(pinnedIds, orderPinnedIds(threadMessageIds));
    }

    const nonLocalMessageCount = threadMessageIds.filter((id) => !isLocalMessageId(id)).length;
    if (newMessageCount !== undefined) {
      newMessageCount -= nonLocalMessageCount;
    }

    Object.values(global.byTabId).forEach(({ id: tabId }) => {
      let viewportIds = selectViewportIds(global, chatId, threadId, tabId);

      messageIds.forEach((messageId) => {
        if (viewportIds?.includes(messageId)) {
          viewportIds = viewportIds.filter((id) => id !== messageId);
        }
      });

      global = replaceTabThreadParam(global, chatId, threadId, 'viewportIds', viewportIds, tabId);
    });

    global = replaceThreadParam(global, chatId, threadId, 'listedIds', listedIds);
    global = replaceThreadParam(global, chatId, threadId, 'outlyingLists', outlyingLists);
    global = replaceThreadParam(global, chatId, threadId, 'pinnedIds', pinnedIds);

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

        if (canDeleteCurrentThread && currentThreadId === message.id) {
          global = updateCurrentMessageList(global, chatId, undefined, undefined, undefined, undefined, tabId);
        }
        if (originalPost) {
          global = updateThread(global, fromChatId!, fromMessageId!, undefined);
        }
      });
    });
  }

  const newById = omit(byId, messageIds);
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

export function removeOutlyingList<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: number,
  list: number[],
): T {
  const outlyingLists = selectOutlyingLists(global, chatId, threadId);
  if (!outlyingLists) {
    return global;
  }

  const newOutlyingLists = outlyingLists.filter((l) => l !== list);

  return replaceThreadParam(global, chatId, threadId, 'outlyingLists', newOutlyingLists);
}

export function updateOutlyingLists<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: number,
  idsUpdate: number[],
): T {
  if (!idsUpdate.length) return global;

  const outlyingLists = selectOutlyingLists(global, chatId, threadId);

  const newOutlyingLists = mergeIdRanges(outlyingLists || [], idsUpdate);

  return replaceThreadParam(global, chatId, threadId, 'outlyingLists', newOutlyingLists);
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

export function safeReplacePinnedIds<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: number,
  newPinnedIds: number[],
): T {
  const currentIds = selectPinnedIds(global, chatId, threadId) || [];
  const newIds = orderPinnedIds(newPinnedIds);

  return replaceThreadParam(
    global,
    chatId,
    threadId,
    'pinnedIds',
    areSortedArraysEqual(currentIds, newIds) ? currentIds : newIds,
  );
}

export function updateThreadInfo<T extends GlobalState>(
  global: T, chatId: string, threadId: number, update: Partial<ApiThreadInfo> | undefined,
  doNotUpdateLinked?: boolean,
): T {
  const newThreadInfo = {
    ...(selectThreadInfo(global, chatId, threadId) as ApiThreadInfo),
    ...update,
  } as ApiThreadInfo;

  if (!doNotUpdateLinked) {
    const linkedUpdate = pick(newThreadInfo, ['messagesCount', 'lastMessageId', 'lastReadInboxMessageId']);
    if (newThreadInfo.isCommentsInfo) {
      if (newThreadInfo.threadId) {
        global = updateThreadInfo(
          global, newThreadInfo.chatId, newThreadInfo.threadId, linkedUpdate, true,
        );
      }
    } else if (newThreadInfo.fromChannelId && newThreadInfo.fromMessageId) {
      global = updateThreadInfo(
        global, newThreadInfo.fromChannelId, newThreadInfo.fromMessageId, linkedUpdate, true,
      );
    }
  }

  return replaceThreadParam(global, chatId, threadId, 'threadInfo', newThreadInfo);
}

export function updateThreadInfos<T extends GlobalState>(
  global: T, updates: Partial<ApiThreadInfo>[],
): T {
  updates.forEach((update) => {
    global = updateThreadInfo(global,
      update.isCommentsInfo ? update.originChannelId! : update.chatId!,
      update.isCommentsInfo ? update.originMessageId! : update.threadId!,
      update);
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

export function updateFocusedMessage<T extends GlobalState>({
  global,
  chatId,
  messageId,
  threadId = MAIN_THREAD_ID,
  noHighlight = false,
  isResizingContainer = false,
  quote,
}: {
  global: T;
  chatId?: string;
  messageId?: number;
  threadId?: number;
  noHighlight?: boolean;
  isResizingContainer?: boolean;
  quote?: string;
},
...[tabId = getCurrentTabId()]: TabArgs<T>): T {
  return updateTabState(global, {
    focusedMessage: {
      ...selectTabState(global, tabId).focusedMessage,
      chatId,
      threadId,
      messageId,
      noHighlight,
      isResizingContainer,
      quote,
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

export function addActiveMessageMediaDownload<T extends GlobalState>(
  global: T,
  message: ApiMessage,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const tabState = selectTabState(global, tabId);
  const byChatId = tabState.activeDownloads.byChatId[message.chatId] || {};
  const currentIds = (message.isScheduled ? byChatId?.scheduledIds : byChatId?.ids) || [];

  global = updateTabState(global, {
    activeDownloads: {
      byChatId: {
        ...tabState.activeDownloads.byChatId,
        [message.chatId]: {
          ...byChatId,
          [message.isScheduled ? 'scheduledIds' : 'ids']: unique([...currentIds, message.id]),
        },
      },
    },
  }, tabId);

  return global;
}

export function cancelMessageMediaDownload<T extends GlobalState>(
  global: T,
  message: ApiMessage,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const tabState = selectTabState(global, tabId);
  const byChatId = tabState.activeDownloads.byChatId[message.chatId];
  if (!byChatId) return global;

  const currentIds = (message.isScheduled ? byChatId.scheduledIds : byChatId.ids) || [];

  global = updateTabState(global, {
    activeDownloads: {
      byChatId: {
        ...tabState.activeDownloads.byChatId,
        [message.chatId]: {
          ...byChatId,
          [message.isScheduled ? 'scheduledIds' : 'ids']: currentIds.filter((id) => id !== message.id),
        },
      },
    },
  }, tabId);

  return global;
}

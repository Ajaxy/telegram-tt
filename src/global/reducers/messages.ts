import type {
  ApiMessage, ApiPoll, ApiPollResult, ApiQuickReply, ApiSponsoredMessage, ApiThreadInfo,
  ApiWebPage,
  ApiWebPageFull,
} from '../../api/types';
import type {
  MessageList,
  MessageListType,
  TabThread,
  Thread,
  ThreadId,
} from '../../types';
import type {
  GlobalState, TabArgs, TabState,
} from '../types';
import { MAIN_THREAD_ID } from '../../api/types';

import {
  IS_MOCKED_CLIENT, IS_TEST, MESSAGE_LIST_SLICE, MESSAGE_LIST_VIEWPORT_LIMIT, TMP_CHAT_ID,
} from '../../config';
import { areDeepEqual } from '../../util/areDeepEqual';
import { addTimestampEntities } from '../../util/dates/timestamp';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import {
  areSortedArraysEqual, excludeSortedArray, omit, omitUndefined, pick, pickTruthy, unique,
} from '../../util/iteratees';
import { isLocalMessageId, type MessageKey } from '../../util/keys/messageKey';
import {
  hasMessageTtl, isMediaLoadableInViewer, mergeIdRanges, orderHistoryIds, orderPinnedIds,
} from '../helpers';
import { getEmojiOnlyCountForMessage } from '../helpers/getEmojiOnlyCountForMessage';
import {
  selectChatMessage,
  selectChatMessages,
  selectChatScheduledMessages,
  selectCurrentMessageIds,
  selectCurrentMessageList,
  selectListedIds,
  selectMessageIdsByGroupId,
  selectOutlyingLists,
  selectPinnedIds,
  selectPoll,
  selectQuickReplyMessage,
  selectScheduledIds,
  selectScheduledMessage,
  selectTabState,
  selectThreadIdFromMessage,
  selectThreadInfo,
  selectViewportIds,
  selectWebPage,
} from '../selectors';
import { removeIdFromSearchResults } from './middleSearch';
import { updateTabState } from './tabs';
import { clearMessageTranslation } from './translations';

type MessageStoreSections = GlobalState['messages']['byChatId'][string];

export function updateCurrentMessageList<T extends GlobalState>(
  global: T,
  chatId: string | undefined,
  threadId: ThreadId = MAIN_THREAD_ID,
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
    const current = messageLists[messageLists.length - 1];
    if (current?.chatId === chatId && current.threadId === threadId && current.type === type) {
      return global;
    }

    if (current && (current.chatId === TMP_CHAT_ID || shouldReplaceLast)) {
      newMessageLists = [...messageLists.slice(0, -1), { chatId, threadId, type }];
    } else {
      const previous = messageLists[messageLists.length - 2];

      if (previous?.chatId === chatId && previous.threadId === threadId && previous.type === type) {
        newMessageLists = messageLists.slice(0, -1);
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
  global: T, chatId: string, threadId: ThreadId, threadUpdate: Partial<TabThread>,
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
  global: T, chatId: string, threadId: ThreadId, threadUpdate: Partial<Thread> | undefined,
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

export function updateMessageStore<T extends GlobalState>(
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
  global: T, chatId: string, threadId: ThreadId, paramName: K, newValue: TabThread[K] | undefined,
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
  global: T, chatId: string, threadId: ThreadId, paramName: K, newValue: Thread[K] | undefined,
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

export function replaceMessages<T extends GlobalState>(
  global: T, messages: ApiMessage[],
): T {
  const updatedByChatId = messages.reduce((messagesByChatId, message: ApiMessage) => {
    if (!messagesByChatId[message.chatId]) {
      messagesByChatId[message.chatId] = {};
    }
    messagesByChatId[message.chatId][message.id] = message;

    return messagesByChatId;
  }, {} as Record<string, Record<number, ApiMessage>>);

  Object.keys(updatedByChatId).forEach((chatId) => {
    const currentById = selectChatMessages(global, chatId) || {};
    const newById = {
      ...currentById,
      ...updatedByChatId[chatId],
    };
    global = replaceChatMessages(global, chatId, newById);
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
  global: T, chatId: string, messageId: number, messageUpdate: Partial<ApiMessage>, withDeepCheck = false,
): T {
  const byId = selectChatMessages(global, chatId) || {};
  const message = byId[messageId];

  if (withDeepCheck && message) {
    const updateKeys = Object.keys(messageUpdate) as (keyof ApiMessage)[];
    if (areDeepEqual(pick(message, updateKeys), messageUpdate)) {
      return global;
    }
  }

  if (message && messageUpdate.isMediaUnread === false && hasMessageTtl(message)) {
    if (message.content.voice) {
      messageUpdate.content = {
        action: {
          mediaType: 'action',
          type: 'expired',
          isVoice: true,
        },
      };
    } else if (message.content.video?.isRound) {
      messageUpdate.content = {
        action: {
          mediaType: 'action',
          type: 'expired',
          isRoundVideo: true,
        },
      };
    }
  }

  let text = message?.content?.text;
  if (messageUpdate.content) {
    const emojiOnlyCount = getEmojiOnlyCountForMessage(
      messageUpdate.content, message?.groupedId || messageUpdate.groupedId,
    );
    text = messageUpdate.content.text ? addTimestampEntities(messageUpdate.content.text) : text;
    if (text) text.emojiOnlyCount = emojiOnlyCount;
  }

  const updatedMessage = omitUndefined({
    ...message,
    ...messageUpdate,
    text,
  });

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
  const message = selectScheduledMessage(global, chatId, messageId)!;

  let text = message?.content?.text;
  if (messageUpdate.content) {
    const emojiOnlyCount = getEmojiOnlyCountForMessage(
      messageUpdate.content, message?.groupedId || messageUpdate.groupedId,
    );
    text = messageUpdate.content.text ? addTimestampEntities(messageUpdate.content.text) : text;
    if (text) text.emojiOnlyCount = emojiOnlyCount;
  }

  const updatedMessage = {
    ...message,
    ...messageUpdate,
    text,
  };

  if (!updatedMessage.id) {
    return global;
  }

  return updateScheduledMessages(global, chatId, {
    [messageId]: updatedMessage,
  });
}

export function updateQuickReplyMessage<T extends GlobalState>(
  global: T, messageId: number, messageUpdate: Partial<ApiMessage>,
): T {
  const message = selectQuickReplyMessage(global, messageId);
  const updatedMessage = {
    ...message,
    ...messageUpdate,
  };

  if (!updatedMessage.id) {
    return global;
  }

  return updateQuickReplyMessages(global, {
    [messageId]: updatedMessage,
  });
}

export function deleteQuickReplyMessages<T extends GlobalState>(
  global: T, messageIds: number[],
): T {
  const byId = global.quickReplies.messagesById;
  const newById = omit(byId, messageIds);
  return {
    ...global,
    quickReplies: {
      ...global.quickReplies,
      messagesById: newById,
    },
  };
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
  const updatedThreads = new Map<ThreadId, number[]>();
  updatedThreads.set(MAIN_THREAD_ID, messageIds);

  const mediaIdsToRemove: number[] = [];
  messageIds.forEach((messageId) => {
    const message = byId[messageId];
    if (!message) return;
    if (isMediaLoadableInViewer(message)) {
      mediaIdsToRemove.push(messageId);
    }
    const threadId = selectThreadIdFromMessage(global, message);
    if (!threadId || threadId === MAIN_THREAD_ID) {
      return;
    }
    const threadMessages = updatedThreads.get(threadId) || [];
    threadMessages.push(messageId);
    updatedThreads.set(threadId, threadMessages);
    global = clearMessageTranslation(global, chatId, messageId);
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
      const tabState = selectTabState(global, tabId);
      const activeDownloadsInChat = Object.entries(tabState.activeDownloads).filter(
        ([, { originChatId, originMessageId }]) => originChatId === chatId && originMessageId,
      );

      activeDownloadsInChat.forEach(([mediaHash, context]) => {
        if (messageIds.includes(context.originMessageId!)) {
          global = cancelMessageMediaDownload(global, [mediaHash], tabId);
        }
      });

      mediaIdsToRemove.forEach((mediaId) => {
        global = removeIdFromSearchResults(global, chatId, threadId, mediaId, tabId);
      });

      const viewportIds = selectViewportIds(global, chatId, threadId, tabId);
      if (!viewportIds) return;

      const newViewportIds = excludeSortedArray(viewportIds, messageIds);
      global = replaceTabThreadParam(
        global,
        chatId,
        threadId,
        'viewportIds',
        newViewportIds.length === 0 ? undefined : newViewportIds,
        tabId,
      );
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

  global = {
    ...global,
    scheduledMessages: {
      byChatId: {
        ...global.scheduledMessages.byChatId,
        [chatId]: {
          byId: newById,
        },
      },
    },
  };

  return global;
}

export function updateListedIds<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
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
  threadId: ThreadId,
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
  threadId: ThreadId,
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
  threadId: ThreadId,
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
  threadId: ThreadId,
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
  threadId: ThreadId,
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
  global: T, chatId: string, threadId: ThreadId, update: Partial<ApiThreadInfo> | undefined,
  doNotUpdateLinked?: boolean,
): T {
  const newThreadInfo = {
    ...(selectThreadInfo(global, chatId, threadId) as ApiThreadInfo),
    ...update,
  } as ApiThreadInfo;

  if (!doNotUpdateLinked && !newThreadInfo.isCommentsInfo) {
    const linkedUpdate = pick(newThreadInfo, ['messagesCount', 'lastMessageId', 'lastReadInboxMessageId']);
    if (newThreadInfo.fromChannelId && newThreadInfo.fromMessageId) {
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
    global = updateThreadInfo(
      global,
      update.isCommentsInfo ? update.originChannelId! : update.chatId!,
      update.isCommentsInfo ? update.originMessageId! : update.threadId!,
      update,
    );
  });

  return global;
}

export function updateScheduledMessages<T extends GlobalState>(
  global: T, chatId: string, newById: Record<number, ApiMessage>,
): T {
  const current = global.scheduledMessages.byChatId[chatId] || { byId: {}, hash: 0 };

  return {
    ...global,
    scheduledMessages: {
      byChatId: {
        ...global.scheduledMessages.byChatId,
        [chatId]: {
          ...current,
          byId: {
            ...current.byId,
            ...newById,
          },
        },
      },
    },
  };
}

export function updateQuickReplyMessages<T extends GlobalState>(
  global: T, update: Record<number, ApiMessage>,
): T {
  return {
    ...global,
    quickReplies: {
      ...global.quickReplies,
      messagesById: {
        ...global.quickReplies.messagesById,
        ...update,
      },
    },
  };
}

export function updateFocusedMessage<T extends GlobalState>(
  global: T, update: Partial<TabState['focusedMessage']> | undefined, ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  if (!update) {
    return updateTabState(global, { focusedMessage: undefined }, tabId);
  }

  return updateTabState(global, {
    focusedMessage: {
      ...selectTabState(global, tabId).focusedMessage,
      ...update,
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

export function deleteSponsoredMessage<T extends GlobalState>(
  global: T, chatId: string,
): T {
  const byChatId = global.messages.sponsoredByChatId;
  if (!byChatId[chatId]) {
    return global;
  }

  return {
    ...global,
    messages: {
      ...global.messages,
      sponsoredByChatId: omit(byChatId, [chatId]),
    },
  };
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
  threadId: ThreadId,
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

export function addActiveMediaDownload<T extends GlobalState>(
  global: T,
  mediaHash: string,
  metadata: TabState['activeDownloads'][string],
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const tabState = selectTabState(global, tabId);

  global = updateTabState(global, {
    activeDownloads: {
      ...tabState.activeDownloads,
      [mediaHash]: metadata,
    },
  }, tabId);

  return global;
}

export function cancelMessageMediaDownload<T extends GlobalState>(
  global: T,
  mediaHashes: string[],
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const tabState = selectTabState(global, tabId);

  const newActiveDownloads = omit(tabState.activeDownloads, mediaHashes);

  global = updateTabState(global, {
    activeDownloads: newActiveDownloads,
  }, tabId);

  return global;
}

export function updateUploadByMessageKey<T extends GlobalState>(
  global: T,
  messageKey: MessageKey,
  progress: number | undefined,
) {
  return {
    ...global,
    fileUploads: {
      byMessageKey: progress !== undefined
        ? {
          ...global.fileUploads.byMessageKey,
          [messageKey]: { progress },
        }
        : omit(global.fileUploads.byMessageKey, [messageKey]),
    },
  };
}

export function updateQuickReplies<T extends GlobalState>(
  global: T,
  quickRepliesUpdate: Record<number, ApiQuickReply>,
) {
  return {
    ...global,
    quickReplies: {
      ...global.quickReplies,
      byId: {
        ...global.quickReplies.byId,
        ...quickRepliesUpdate,
      },
    },
  };
}

export function deleteQuickReply<T extends GlobalState>(
  global: T,
  quickReplyId: number,
) {
  return {
    ...global,
    quickReplies: {
      ...global.quickReplies,
      byId: omit(global.quickReplies.byId, [quickReplyId]),
    },
  };
}

export function updateFullWebPage<T extends GlobalState>(
  global: T,
  webPageId: string,
  update: Partial<ApiWebPageFull>,
) {
  const webpage = selectWebPage(global, webPageId);
  const updatedWebpage = webpage?.webpageType === 'full'
    ? { ...webpage, ...update }
    : { webpageType: 'full', mediaType: 'webpage', ...update };

  if (!updatedWebpage.id) {
    return global;
  }

  return replaceWebPage(global, webPageId, updatedWebpage as ApiWebPageFull);
}

export function replaceWebPage<T extends GlobalState>(
  global: T,
  webPageId: string,
  webPage: ApiWebPage,
) {
  return {
    ...global,
    messages: {
      ...global.messages,
      webPageById: {
        ...global.messages.webPageById,
        [webPageId]: webPage,
      },
    },
  };
}

export function updatePoll<T extends GlobalState>(
  global: T,
  pollId: string,
  pollUpdate: Partial<ApiPoll>,
) {
  const poll = selectPoll(global, pollId);

  const oldResults = poll?.results;
  let newResults = oldResults || pollUpdate.results;
  if (poll && pollUpdate.results?.results) {
    if (!poll.results || !pollUpdate.results.isMin) {
      newResults = pollUpdate.results;
    } else if (oldResults.results) {
      // Update voters counts, but keep local `isChosen` values
      newResults = {
        ...pollUpdate.results,
        results: pollUpdate.results.results.map((result) => ({
          ...result,
          isChosen: oldResults.results!.find((r) => r.option === result.option)?.isChosen,
        })),
        isMin: undefined,
      };
    }
  }

  const updatedPoll = {
    ...poll,
    ...pollUpdate,
    results: newResults,
  } satisfies ApiPoll;
  if (!updatedPoll.id) {
    return global;
  }

  return {
    ...global,
    messages: {
      ...global.messages,
      pollById: {
        ...global.messages.pollById,
        [pollId]: updatedPoll,
      },
    },
  };
}

export function updatePollVote<T extends GlobalState>(
  global: T,
  pollId: string,
  peerId: string,
  options: string[],
) {
  const poll = selectPoll(global, pollId);
  if (!poll) {
    return global;
  }

  const { recentVoterIds, totalVoters, results } = poll.results;
  const newRecentVoterIds = recentVoterIds ? [...recentVoterIds] : [];
  const newTotalVoters = totalVoters ? totalVoters + 1 : 1;
  const newResults = results ? [...results] : [];

  newRecentVoterIds.push(peerId);

  options.forEach((option) => {
    const targetOptionIndex = newResults.findIndex((result) => result.option === option);
    const targetOption = newResults[targetOptionIndex];
    const updatedOption: ApiPollResult = targetOption ? { ...targetOption } : { option, votersCount: 0 };

    updatedOption.votersCount += 1;
    if (peerId === global.currentUserId) {
      updatedOption.isChosen = true;
    }

    if (targetOptionIndex) {
      newResults[targetOptionIndex] = updatedOption;
    } else {
      newResults.push(updatedOption);
    }
  });

  return updatePoll(global, pollId, {
    results: {
      ...poll.results,
      recentVoterIds: newRecentVoterIds,
      totalVoters: newTotalVoters,
      results: newResults,
    },
  });
}

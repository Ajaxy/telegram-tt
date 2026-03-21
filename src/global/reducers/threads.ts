import type { ApiMessage, ApiThreadInfo } from '../../api/types';
import type { TabThread, Thread, ThreadId, ThreadLocalState, ThreadReadState } from '../../types';
import type { GlobalState, TabArgs } from '../types';
import { MAIN_THREAD_ID } from '../../api/types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { omit, pick } from '../../util/iteratees';
import { selectChatMessage, selectTabState } from '../selectors';
import { selectThread, selectThreadIdFromMessage, selectThreadInfo, selectThreadReadState } from '../selectors/threads';
import { updateMessageStore } from './messages';
import { updateTabState } from './tabs';

export function replaceTabThreadParam<T extends GlobalState, K extends keyof TabThread>(
  global: T, chatId: string, threadId: ThreadId, paramName: K, newValue: TabThread[K] | undefined,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  if (paramName === 'viewportIds') {
    global = replaceThreadLocalStateParam(
      global, chatId, threadId, 'lastViewportIds', newValue as number[] | undefined,
    );
  }
  return updateTabThread(global, chatId, threadId, { [paramName]: newValue }, tabId);
}

export function replaceThreadLocalStateParam<T extends GlobalState, K extends keyof ThreadLocalState>(
  global: T, chatId: string, threadId: ThreadId, paramName: K, newValue: ThreadLocalState[K] | undefined,
) {
  return updateThreadLocalState(global, chatId, threadId, { [paramName]: newValue });
}

export function replaceThreadReadStateParam<T extends GlobalState, K extends keyof ThreadReadState>(
  global: T, chatId: string, threadId: ThreadId, paramName: K, newValue: ThreadReadState[K] | undefined,
) {
  return updateThreadReadState(global, chatId, threadId, { [paramName]: newValue });
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

export function updateThreadLocalState<T extends GlobalState>(
  global: T, chatId: string, threadId: ThreadId, threadUpdate: Partial<ThreadLocalState> | undefined,
): T {
  const currentThread = selectThread(global, chatId, threadId);
  if (!currentThread) return global;

  if (!threadUpdate && !currentThread.threadInfo) {
    return updateMessageStore(global, chatId, {
      threadsById: omit(global.messages.byChatId[chatId]?.threadsById, [threadId]),
    });
  }

  const updated: ThreadLocalState = threadUpdate ? {
    ...currentThread.localState,
    ...threadUpdate,
  } : {};

  return updateMessageStore(global, chatId, {
    threadsById: {
      ...global.messages.byChatId[chatId]?.threadsById,
      [threadId]: {
        ...currentThread,
        localState: updated,
      },
    },
  });
}

export function updateThreadReadState<T extends GlobalState>(
  global: T, chatId: string, threadId: ThreadId, threadUpdate: Partial<ThreadReadState>,
): T {
  const currentThread = selectThread(global, chatId, threadId);
  if (!currentThread) return global;

  const updated: ThreadReadState = {
    ...currentThread.readState,
    ...threadUpdate,
  };

  return updateMessageStore(global, chatId, {
    threadsById: {
      ...global.messages.byChatId[chatId]?.threadsById,
      [threadId]: {
        ...currentThread,
        readState: updated,
      },
    },
  });
}

export function updateThreadInfo<T extends GlobalState>(
  global: T, update: Partial<ApiThreadInfo> | undefined, doNotUpdateLinked?: boolean,
): T {
  const chatId = update?.isCommentsInfo ? update.originChannelId : update?.chatId;
  const threadId = update?.isCommentsInfo ? update.originMessageId : update?.threadId;

  if (!chatId || !threadId) {
    return global;
  }

  const currentThread = selectThread(global, chatId, threadId);
  const newThreadInfo = {
    ...currentThread?.threadInfo,
    ...update,
  } as ApiThreadInfo;

  if (!doNotUpdateLinked) {
    global = updateLinkedThreadInfo(global, newThreadInfo);
  }

  return updateThreadInfoInStore(global, chatId, threadId, newThreadInfo);
}

export function updateLinkedThreadInfo<T extends GlobalState>(
  global: T, update: ApiThreadInfo,
): T {
  if (update.isCommentsInfo || !update.fromChannelId || !update.fromMessageId) {
    return global;
  }

  const threadInfo = selectThreadInfo(global, update.fromChannelId, update.fromMessageId);
  if (!threadInfo) {
    return global;
  }

  const valuesToUpdate = pick(update, ['messagesCount', 'lastMessageId']);
  const newThreadInfo: ApiThreadInfo = {
    ...threadInfo,
    ...valuesToUpdate,
  };
  return updateThreadInfoInStore(global, update.fromChannelId, update.fromMessageId, newThreadInfo);
}

export function updateThreadInfoInStore<T extends GlobalState>(
  global: T, chatId: string, threadId: ThreadId, update: ApiThreadInfo,
): T {
  const thread = selectThread(global, chatId, threadId);

  const newThread: Thread = {
    localState: thread?.localState || {},
    readState: thread?.readState || {},
    threadInfo: update,
  };

  return updateMessageStore(global, chatId, {
    threadsById: {
      ...global.messages.byChatId[chatId]?.threadsById,
      [threadId]: newThread,
    },
  });
}

export function updateThreadInfoMessagesCount<T extends GlobalState>(
  global: T, chatId: string, threadId: ThreadId, newCount: number,
): T {
  const threadInfo = selectThreadInfo(global, chatId, threadId);
  if (!threadInfo) return global;

  const newThreadInfo: ApiThreadInfo = {
    ...threadInfo,
    messagesCount: newCount,
  };
  return updateThreadInfo(global, newThreadInfo);
}

export function updateThreadInfoLastMessageId<T extends GlobalState>(
  global: T, chatId: string, threadId: ThreadId, newLastMessageId: number | undefined,
): T {
  const threadInfo = selectThreadInfo(global, chatId, threadId);
  if (!threadInfo) return global;

  const newThreadInfo: ApiThreadInfo = {
    ...threadInfo,
    lastMessageId: newLastMessageId,
  };
  return updateThreadInfo(global, newThreadInfo);
}

export function addUnreadMessageToCounter<T extends GlobalState>(
  global: T, chatId: string, message: ApiMessage,
): T {
  const threadId = selectThreadIdFromMessage(global, message);
  const currentReadState = selectThreadReadState(global, chatId, threadId);
  const newUnreadCount = (currentReadState?.unreadCount || 0) + 1;
  return replaceThreadReadStateParam(global, chatId, threadId, 'unreadCount', newUnreadCount);
}

export function decrementUnreadCount<T extends GlobalState>(
  global: T, chatId: string, messageId: number, amount: number,
): T {
  const message = selectChatMessage(global, chatId, messageId);
  if (!message) return global;

  const threadId = selectThreadIdFromMessage(global, message);
  const currentReadState = selectThreadReadState(global, chatId, threadId);
  const newUnreadCount = Math.max(0, (currentReadState?.unreadCount || 0) - amount);
  return replaceThreadReadStateParam(global, chatId, threadId, 'unreadCount', newUnreadCount);
}

export function updateMainThreadReadStates<T extends GlobalState>(
  global: T, threadReadStates: Record<string, ThreadReadState>,
): T {
  Object.entries(threadReadStates).forEach(([chatId, readState]) => {
    global = updateThreadReadState(global, chatId, MAIN_THREAD_ID, readState);
  });
  return global;
}

export function updateThreadReadStates<T extends GlobalState>(
  global: T, chatId: string, threadReadStates: Record<ThreadId, ThreadReadState>,
): T {
  Object.entries(threadReadStates).forEach(([threadId, readState]) => {
    global = updateThreadReadState(global, chatId, threadId, readState);
  });
  return global;
}

export function deleteThread<T extends GlobalState>(
  global: T, chatId: string, threadId: ThreadId,
): T {
  return updateMessageStore(global, chatId, {
    threadsById: omit(global.messages.byChatId[chatId]?.threadsById, [threadId]),
  });
}

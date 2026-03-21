import type { TabThread, ThreadId, ThreadLocalState } from '../../types';
import type { GlobalState, TabArgs } from '../types';
import { type ApiMessage, MAIN_THREAD_ID } from '../../api/types';

import { ANONYMOUS_USER_ID, GENERAL_TOPIC_ID } from '../../config';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import { isChatBasicGroup, isChatSuperGroup } from '../helpers';
import { getMessageReplyInfo } from '../helpers/replies';
import { selectChat } from './chats';
import { selectTabState } from './tabs';

export function selectTabThreadParam<T extends GlobalState, K extends keyof TabThread>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  key: K,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabState(global, tabId).tabThreads[chatId]?.[threadId]?.[key];
}

export function selectThreadInfo<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectThread(global, chatId, threadId)?.threadInfo;
}

export function selectThreadReadState<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectThread(global, chatId, threadId)?.readState;
}

export function selectThreadLocalStateParam<T extends GlobalState, K extends keyof ThreadLocalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
  key: K,
) {
  return selectThreadLocalState(global, chatId, threadId)?.[key];
}

export function selectThread<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
) {
  const messageInfo = global.messages.byChatId[chatId];
  if (!messageInfo) {
    return undefined;
  }

  const thread = messageInfo.threadsById[threadId];
  if (!thread) {
    return undefined;
  }

  return thread;
}

export function selectThreadLocalState<T extends GlobalState>(
  global: T,
  chatId: string,
  threadId: ThreadId,
) {
  return selectThread(global, chatId, threadId)?.localState;
}

export function selectThreadMessagesCount(global: GlobalState, chatId: string, threadId: ThreadId) {
  const chat = selectChat(global, chatId);
  const threadInfo = selectThreadInfo(global, chatId, threadId);
  if (!chat || !threadInfo || threadInfo.messagesCount === undefined) return undefined;
  // In forum topics first message is ignored, but not in General
  if (chat.isForum && threadId !== GENERAL_TOPIC_ID) return Math.max(threadInfo.messagesCount - 1, 0);
  return threadInfo.messagesCount;
}

export function selectThreadByMessage<T extends GlobalState>(global: T, message: ApiMessage) {
  const threadId = selectThreadIdFromMessage(global, message);
  if (!threadId || threadId === MAIN_THREAD_ID) {
    return undefined;
  }

  return selectThread(global, message.chatId, threadId);
}

export function selectScrollOffset<T extends GlobalState>(
  global: T, chatId: string, threadId: ThreadId,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabThreadParam(global, chatId, threadId, 'scrollOffset', tabId);
}

export function selectLastScrollOffset<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectThreadLocalStateParam(global, chatId, threadId, 'lastScrollOffset');
}

export function selectEditingId<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectThreadLocalStateParam(global, chatId, threadId, 'editingId');
}

export function selectEditingDraft<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectThreadLocalStateParam(global, chatId, threadId, 'editingDraft');
}

export function selectEditingScheduledId<T extends GlobalState>(global: T, chatId: string) {
  return selectThreadLocalStateParam(global, chatId, MAIN_THREAD_ID, 'editingScheduledId');
}

export function selectEditingScheduledDraft<T extends GlobalState>(global: T, chatId: string) {
  return selectThreadLocalStateParam(global, chatId, MAIN_THREAD_ID, 'editingScheduledDraft');
}

export function selectDraft<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectThreadLocalStateParam(global, chatId, threadId, 'draft');
}

export function selectNoWebPage<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectThreadLocalStateParam(global, chatId, threadId, 'noWebPage');
}

export function selectReplyStack<T extends GlobalState>(
  global: T, chatId: string, threadId: ThreadId,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  return selectTabThreadParam(global, chatId, threadId, 'replyStack', tabId);
}

export function selectSavedDialogIdFromMessage<T extends GlobalState>(
  global: T, message: ApiMessage,
): string | undefined {
  const {
    chatId, senderId, forwardInfo, savedPeerId,
  } = message;

  if (savedPeerId) return savedPeerId;

  if (chatId !== global.currentUserId) {
    return undefined;
  }

  if (forwardInfo?.savedFromPeerId) {
    return forwardInfo.savedFromPeerId;
  }

  if (forwardInfo?.fromId) {
    return forwardInfo.fromId;
  }

  if (forwardInfo?.hiddenUserName) {
    return ANONYMOUS_USER_ID;
  }

  return senderId;
}

export function selectThreadIdFromMessage<T extends GlobalState>(global: T, message: ApiMessage): ThreadId {
  const savedDialogId = selectSavedDialogIdFromMessage(global, message);
  if (savedDialogId) {
    return savedDialogId;
  }

  const chat = selectChat(global, message.chatId);
  const { content } = message;
  const { replyToMsgId, replyToTopId, isForumTopic } = getMessageReplyInfo(message) || {};
  if (content.action?.type === 'topicCreate') {
    return message.id;
  }

  if (!chat?.isForum) {
    if (chat && isChatBasicGroup(chat)) return MAIN_THREAD_ID;

    if (chat && isChatSuperGroup(chat)) {
      return replyToTopId || replyToMsgId || MAIN_THREAD_ID;
    }
    return MAIN_THREAD_ID;
  }
  if (!isForumTopic) return GENERAL_TOPIC_ID;
  return replyToTopId || replyToMsgId || GENERAL_TOPIC_ID;
}

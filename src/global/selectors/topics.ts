import type { ApiMessage } from '../../api/types';
import type { ThreadId, TopicsInfo } from '../../types';
import type { GlobalState } from '../types';

import { selectChat } from './chats';
import { selectThreadIdFromMessage } from './threads';

export function selectTopicsInfo<T extends GlobalState>(global: T, chatId: string): TopicsInfo | undefined {
  return global.chats.topicsInfoById[chatId];
}

export function selectTopics<T extends GlobalState>(global: T, chatId: string) {
  return selectTopicsInfo(global, chatId)?.topicsById;
}

export function selectTopic<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectTopicsInfo(global, chatId)?.topicsById?.[threadId];
}

export function selectTopicFromMessage<T extends GlobalState>(global: T, message: ApiMessage) {
  const { chatId } = message;
  const chat = selectChat(global, chatId);
  if (!chat?.isForum) return undefined;

  const threadId = selectThreadIdFromMessage(global, message);
  return selectTopic(global, chatId, threadId);
}

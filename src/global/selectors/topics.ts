import type { ThreadId, TopicsInfo } from '../../types';
import type { GlobalState } from '../types';

export function selectTopicsInfo<T extends GlobalState>(global: T, chatId: string): TopicsInfo | undefined {
  return global.chats.topicsInfoById[chatId];
}

export function selectTopics<T extends GlobalState>(global: T, chatId: string) {
  return selectTopicsInfo(global, chatId)?.topicsById;
}

export function selectTopic<T extends GlobalState>(global: T, chatId: string, threadId: ThreadId) {
  return selectTopicsInfo(global, chatId)?.topicsById?.[threadId];
}

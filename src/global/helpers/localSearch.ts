import type { ThreadId } from '../../types';

export function buildChatThreadKey(chatId: string, threadId: ThreadId) {
  return `${chatId}_${threadId}`;
}

import type { SharedMediaType, ThreadId } from '../../types';

export function buildChatThreadKey(chatId: string, threadId: ThreadId) {
  return `${chatId}_${threadId}`;
}

export function buildMediaSearchKey(chatId: string, threadId: ThreadId, mediaType: SharedMediaType) {
  return `${chatId}_${threadId}_${mediaType}`;
}

export const WINDOWED_MEDIA_SEARCH_TYPES: SharedMediaType[] = ['media', 'gif', 'audio', 'voice'];

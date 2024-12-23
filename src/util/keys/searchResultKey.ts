import type { ApiMessage } from '../../api/types';

export type SearchResultKey = `${string}_${number}`;

export function getSearchResultKey(message: ApiMessage): SearchResultKey {
  const { chatId, id } = message;

  return `${chatId}_${id}`;
}

export function parseSearchResultKey(key: SearchResultKey) {
  const [chatId, messageId] = key.split('_');

  return [chatId, Number(messageId)] as const;
}

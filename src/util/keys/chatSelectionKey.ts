export type ChatSelectionKey = {
  peerId: string;
  topicId?: number;
};

export function buildChatSelectionKey(peerId: string, topicId?: number): ChatSelectionKey {
  return { peerId, topicId };
}

export function areChatSelectionKeysEqual(a: ChatSelectionKey, b: ChatSelectionKey): boolean {
  return a.peerId === b.peerId && a.topicId === b.topicId;
}

export function includesChatSelectionKey(arr: ChatSelectionKey[], key: ChatSelectionKey): boolean {
  return arr.some((k) => areChatSelectionKeysEqual(k, key));
}

export function findChatSelectionKeyIndex(arr: ChatSelectionKey[], key: ChatSelectionKey): number {
  return arr.findIndex((k) => areChatSelectionKeysEqual(k, key));
}

export function getChatSelectionKeyHash(key: ChatSelectionKey): string {
  return key.topicId !== undefined ? `${key.peerId}:${key.topicId}` : key.peerId;
}

import type { ApiMessage } from '../api/types';

export type MessageKey = `msg${string}-${number}`;

export function getMessageKey(message: ApiMessage): MessageKey {
  const { chatId, id, previousLocalId } = message;

  return buildMessageKey(chatId, previousLocalId || id);
}

export function getMessageServerKey(message: ApiMessage): MessageKey | undefined {
  if (isLocalMessageId(message.id)) {
    return undefined;
  }
  const { chatId, id } = message;
  return buildMessageKey(chatId, id);
}

export function buildMessageKey(chatId: string, msgId: number): MessageKey {
  return `msg${chatId}-${msgId}`;
}

export function parseMessageKey(key: MessageKey) {
  const match = key.match(/^msg(-?\d+)-(\d+)/)!;

  return { chatId: match[1], messageId: Number(match[2]) };
}

export function isLocalMessageId(id: number) {
  return !Number.isInteger(id);
}

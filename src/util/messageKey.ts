import type { ApiMessage } from '../api/types';

export type MessageKey = `msg${string}-${number}`;

export function getMessageKey(message: ApiMessage): MessageKey {
  const { chatId, id, previousLocalId } = message;

  return buildMessageKey(chatId, previousLocalId || id);
}

function buildMessageKey(chatId: string, msgId: number): MessageKey {
  return `msg${chatId}-${msgId}`;
}

export function parseMessageKey(key: MessageKey) {
  const match = key.match(/^msg(-?\d+)-(\d+)/)!;

  return { chatId: match[1], messageId: Number(match[2]) };
}

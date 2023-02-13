import type { MessageListType } from '../global/types';
import { MAIN_THREAD_ID } from '../api/types';
import { LOCATION_HASH } from '../hooks/useHistoryBack';
import { IS_MOCKED_CLIENT } from '../config';

let parsedInitialLocationHash: Record<string, string> | undefined;
let messageHash: string | undefined;
let isAlreadyParsed = false;

export const createLocationHash = (chatId: string, type: MessageListType, threadId: number): string => {
  const displayType = type === 'thread' ? undefined : type;
  const parts = threadId === MAIN_THREAD_ID ? [chatId, displayType] : [chatId, threadId, displayType];

  return parts.filter(Boolean).join('_');
};

export function parseLocationHash() {
  parseInitialLocationHash();

  if (!messageHash) return undefined;

  const parts = messageHash.split('_');
  let chatId: string | undefined;
  let type: string | undefined;
  let threadId: string | undefined;
  if (parts.length === 1) {
    chatId = parts[0];
  } else if (parts.length === 2) {
    const isType = ['thread', 'pinned', 'scheduled'].includes(parts[1]);
    chatId = parts[0];
    type = isType ? parts[1] : 'thread';
    threadId = !isType ? parts[1] : undefined;
  } else if (parts.length >= 3) {
    [chatId, threadId, type] = parts;
  }
  if (!chatId?.match(/^-?\d+$/)) return undefined;

  const isType = ['thread', 'pinned', 'scheduled'].includes(type!);

  return {
    chatId,
    type: type && isType ? (type as MessageListType) : 'thread',
    threadId: Number(threadId) || MAIN_THREAD_ID,
  };
}

export const createMessageHashUrl = (chatId: string, type: MessageListType, threadId: number): string => {
  const url = new URL(window.location.href);
  url.hash = createLocationHash(chatId, type, threadId);
  return url.href;
};

export function parseInitialLocationHash() {
  if (parsedInitialLocationHash) return parsedInitialLocationHash;

  if (isAlreadyParsed) return undefined;

  if (!LOCATION_HASH) return undefined;

  let parsedHash = LOCATION_HASH ? LOCATION_HASH.replace(/^#/, '') : undefined;
  if (parsedHash?.includes('?')) {
    [messageHash, parsedHash] = parsedHash.split('?');
    if (!IS_MOCKED_CLIENT) {
      window.location.hash = messageHash;
    }
  } else if (parsedHash?.includes('=')) {
    if (!IS_MOCKED_CLIENT) {
      window.location.hash = '';
    }
  }

  parsedInitialLocationHash = parsedHash?.includes('=') ? parsedHash?.split('&').reduce((acc, cur) => {
    const [key, value] = cur.split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>) : undefined;
  isAlreadyParsed = true;
  if (!parsedInitialLocationHash) {
    messageHash = parsedHash;
  }

  return parsedInitialLocationHash;
}

export function clearWebTokenAuth() {
  if (!parsedInitialLocationHash) return;

  delete parsedInitialLocationHash.tgWebAuthToken;
}

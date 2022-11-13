import type { MessageListType } from '../global/types';
import { MAIN_THREAD_ID } from '../api/types';
import { LOCATION_HASH } from '../hooks/useHistoryBack';

let parsedInitialLocationHash: Record<string, string> | undefined;
let messageHash: string | undefined;
let isAlreadyParsed = false;

export const createMessageHash = (chatId: string, type: string, threadId: number): string => (
  chatId.toString()
  + (type !== 'thread' ? `_${type}`
    : (threadId !== -1 ? `_${threadId}` : ''))
);

export function parseLocationHash() {
  parseInitialLocationHash();

  if (!messageHash) return undefined;

  const [chatId, typeOrThreadId] = messageHash.split('_');
  if (!chatId?.match(/^-?\d+$/)) return undefined;

  const isType = ['thread', 'pinned', 'scheduled'].includes(typeOrThreadId);

  return {
    chatId,
    type: Boolean(typeOrThreadId) && isType ? (typeOrThreadId as MessageListType) : 'thread',
    threadId: Boolean(typeOrThreadId) && !isType ? Number(typeOrThreadId) : MAIN_THREAD_ID,
  };
}

export function parseInitialLocationHash() {
  if (parsedInitialLocationHash) return parsedInitialLocationHash;

  if (isAlreadyParsed) return undefined;

  if (!LOCATION_HASH) return undefined;

  let parsedHash = LOCATION_HASH ? LOCATION_HASH.replace(/^#/, '') : undefined;
  if (parsedHash?.includes('?')) {
    [messageHash, parsedHash] = parsedHash.split('?');
    window.location.hash = messageHash;
  } else if (parsedHash?.includes('=')) {
    window.location.hash = '';
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

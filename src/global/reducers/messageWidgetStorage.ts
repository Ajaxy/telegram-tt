import type { ApiMessage } from '../../api/types';
import type { GlobalState } from '../types';

import { omit } from '../../util/iteratees';
import { selectThreadIdFromMessage } from '../selectors/threads';

// Every widget's `local` area goes into the global cache, which is saved whole: past this many, the areas of the widgets
// seen longest ago go. The spec has no eviction; this only bounds a chat flooded with widgets
const MAX_STORED_WIDGETS = 256;
// Seen again within this long, a widget keeps its time: scrolling past widgets does not rewrite the state
const SEEN_UPDATE_INTERVAL = 60000;

export function updateMessageWidgetStorage<T extends GlobalState>(
  global: T,
  message: ApiMessage,
  area: 'local' | 'session',
  values: Record<string, string>,
): T {
  // Checked by the widget's host (`checkStorageCommit`) before it reaches here, and again when it is loaded
  const { chatId, id: messageId, senderId } = message;
  const byId = global.messageWidgetStorage[chatId];
  const record = byId?.[messageId];
  global = {
    ...global,
    messageWidgetStorage: {
      ...global.messageWidgetStorage,
      [chatId]: {
        ...byId,
        [messageId]: {
          ...record,
          senderId,
          threadId: selectThreadIdFromMessage(global, message),
          storage: { ...record?.storage, [area]: values },
          lastSeenAt: area === 'local' ? Date.now() : record?.lastSeenAt,
        },
      },
    },
  };

  return area === 'local' ? dropOldestWidgetStorage(global) : global;
}

function dropOldestWidgetStorage<T extends GlobalState>(global: T): T {
  const stored: { chatId: string; messageId: number; seenAt: number }[] = [];
  Object.entries(global.messageWidgetStorage).forEach(([chatId, byId]) => {
    Object.entries(byId).forEach(([messageId, { storage, lastSeenAt }]) => {
      if (storage.local && Object.keys(storage.local).length) {
        stored.push({ chatId, messageId: Number(messageId), seenAt: lastSeenAt ?? 0 });
      }
    });
  });
  if (stored.length <= MAX_STORED_WIDGETS) return global;

  stored.sort((a, b) => a.seenAt - b.seenAt);
  const messageWidgetStorage = { ...global.messageWidgetStorage };
  stored.slice(0, stored.length - MAX_STORED_WIDGETS).forEach(({ chatId, messageId }) => {
    const record = messageWidgetStorage[chatId][messageId];
    messageWidgetStorage[chatId] = {
      ...messageWidgetStorage[chatId],
      [messageId]: { ...record, storage: omit(record.storage, ['local']), lastSeenAt: undefined },
    };
  });

  return { ...global, messageWidgetStorage };
}

// Only a widget that stores something has a record to keep fresh
export function markMessageWidgetSeen<T extends GlobalState>(global: T, chatId: string, messageId: number): T {
  const record = global.messageWidgetStorage[chatId]?.[messageId];
  const now = Date.now();
  if (!record?.storage.local || now - (record.lastSeenAt ?? 0) < SEEN_UPDATE_INTERVAL) return global;

  return {
    ...global,
    messageWidgetStorage: {
      ...global.messageWidgetStorage,
      [chatId]: { ...global.messageWidgetStorage[chatId], [messageId]: { ...record, lastSeenAt: now } },
    },
  };
}

export function updateMessageWidgetHeight<T extends GlobalState>(
  global: T,
  message: ApiMessage,
  height: number,
  resizeAnchor: 'top' | 'bottom',
): T {
  const { chatId, id: messageId, senderId } = message;
  const byId = global.messageWidgetStorage[chatId];
  const current = byId?.[messageId];
  if (current?.height === height && current.resizeAnchor === resizeAnchor) return global;

  return {
    ...global,
    messageWidgetStorage: {
      ...global.messageWidgetStorage,
      [chatId]: {
        ...byId,
        [messageId]: {
          ...current,
          senderId,
          threadId: selectThreadIdFromMessage(global, message),
          storage: current?.storage || {},
          height,
          resizeAnchor,
        },
      },
    },
  };
}

// A sent message gets its server id; what the widget kept under the local one goes with it
export function moveMessageWidgetStorage<T extends GlobalState>(
  global: T,
  chatId: string,
  fromId: number,
  toId: number,
): T {
  const byId = global.messageWidgetStorage[chatId];
  if (!byId?.[fromId]) return global;

  return {
    ...global,
    messageWidgetStorage: {
      ...global.messageWidgetStorage,
      [chatId]: { ...omit(byId, [fromId]), [toId]: byId[fromId] },
    },
  };
}

export function deleteMessageWidgetStorage<T extends GlobalState>(
  global: T,
  chatId: string,
  messageIds?: number[],
): T {
  const byId = global.messageWidgetStorage[chatId];
  if (!byId || (messageIds && !messageIds.some((id) => byId[id]))) return global;

  const remainingById = messageIds ? omit(byId, messageIds) : undefined;
  return {
    ...global,
    messageWidgetStorage: remainingById && Object.keys(remainingById).length ? {
      ...global.messageWidgetStorage,
      [chatId]: remainingById,
    } : omit(global.messageWidgetStorage, [chatId]),
  };
}

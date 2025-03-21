import type { OnApiUpdate } from '../types';

import { MAX_INT_32 } from '../../config';
import { getServerTime } from '../../util/serverTime';

type UnmuteQueueItem = { chatId: string; topicId?: number; mutedUntil: number };
const unmuteTimers = new Map<string, any>();
const unmuteQueue: Array<UnmuteQueueItem> = [];
const scheduleUnmute = (item: UnmuteQueueItem, onUpdate: NoneToVoidFunction) => {
  const id = item.topicId ? `${item.chatId}-${item.topicId}` : item.chatId;
  if (unmuteTimers.has(id)) {
    clearTimeout(unmuteTimers.get(id));
    unmuteTimers.delete(id);
  }
  if (item.mutedUntil === MAX_INT_32 || item.mutedUntil <= getServerTime()) return;
  unmuteQueue.push(item);
  unmuteQueue.sort((a, b) => b.mutedUntil - a.mutedUntil);
  const next = unmuteQueue.pop();
  if (!next) return;
  const timer = setTimeout(() => {
    onUpdate();
    if (unmuteQueue.length) {
      const afterNext = unmuteQueue.pop();
      if (afterNext) scheduleUnmute(afterNext, onUpdate);
    }
  }, (item.mutedUntil - getServerTime()) * 1000);
  unmuteTimers.set(id, timer);
};

export function scheduleMutedChatUpdate(chatId: string, mutedUntil = 0, onUpdate: OnApiUpdate) {
  scheduleUnmute({
    chatId,
    mutedUntil,
  }, () => onUpdate({
    '@type': 'updateChatNotifySettings',
    chatId,
    settings: {
      mutedUntil: 0,
    },
  }));
}

export function scheduleMutedTopicUpdate(chatId: string, topicId: number, mutedUntil = 0, onUpdate: OnApiUpdate) {
  scheduleUnmute({
    chatId,
    topicId,
    mutedUntil,
  }, () => onUpdate({
    '@type': 'updateTopicNotifySettings',
    chatId,
    topicId,
    settings: {
      mutedUntil: 0,
    },
  }));
}

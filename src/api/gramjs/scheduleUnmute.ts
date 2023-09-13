import type { OnApiUpdate } from '../types';

import { MAX_INT_32 } from '../../config';
import { getServerTime } from '../../util/serverTime';

type UnmuteQueueItem = { chatId: string; topicId?: number; muteUntil: number };
const unmuteTimers = new Map<string, any>();
const unmuteQueue: Array<UnmuteQueueItem> = [];
const scheduleUnmute = (item: UnmuteQueueItem, onUpdate: NoneToVoidFunction) => {
  const id = item.topicId ? `${item.chatId}-${item.topicId}` : item.chatId;
  if (unmuteTimers.has(id)) {
    clearTimeout(unmuteTimers.get(id));
    unmuteTimers.delete(id);
  }
  if (item.muteUntil === MAX_INT_32 || item.muteUntil <= getServerTime()) return;
  unmuteQueue.push(item);
  unmuteQueue.sort((a, b) => b.muteUntil - a.muteUntil);
  const next = unmuteQueue.pop();
  if (!next) return;
  const timer = setTimeout(() => {
    onUpdate();
    if (unmuteQueue.length) {
      const afterNext = unmuteQueue.pop();
      if (afterNext) scheduleUnmute(afterNext, onUpdate);
    }
  }, (item.muteUntil - getServerTime()) * 1000);
  unmuteTimers.set(id, timer);
};

export function scheduleMutedChatUpdate(chatId: string, muteUntil = 0, onUpdate: OnApiUpdate) {
  scheduleUnmute({
    chatId,
    muteUntil,
  }, () => onUpdate({
    '@type': 'updateNotifyExceptions',
    chatId,
    isMuted: false,
  }));
}

export function scheduleMutedTopicUpdate(chatId: string, topicId: number, muteUntil = 0, onUpdate: OnApiUpdate) {
  scheduleUnmute({
    chatId,
    topicId,
    muteUntil,
  }, () => onUpdate({
    '@type': 'updateTopicNotifyExceptions',
    chatId,
    topicId,
    isMuted: false,
  }));
}

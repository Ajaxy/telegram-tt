import type { GlobalState } from '../../../global/types';
import type { BulkSendTarget, TelebizBulkSendState } from '../types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function updateTelebizBulkSend<T extends GlobalState>(
  global: T,
  update: Partial<TelebizBulkSendState>,
): T {
  return {
    ...global,
    telebiz: {
      ...(global.telebiz || INITIAL_TELEBIZ_STATE),
      bulkSend: {
        ...(global.telebiz?.bulkSend || INITIAL_TELEBIZ_STATE.bulkSend),
        ...update,
      },
    },
  };
}

export function startTelebizBulkSend<T extends GlobalState>(
  global: T,
  sourceChatId: string,
  messageIds: number[],
  targetChatIds: string[],
  delayMs: number,
): T {
  const targets: BulkSendTarget[] = targetChatIds.map((chatId) => ({
    chatId,
    status: 'pending',
  }));

  return updateTelebizBulkSend(global, {
    isActive: true,
    sourceChatId,
    messageIds,
    targets,
    currentIndex: 0,
    delayMs,
    completedCount: 0,
    failedCount: 0,
  });
}

export function updateTelebizBulkSendTarget<T extends GlobalState>(
  global: T,
  chatId: string,
  status: BulkSendTarget['status'],
  error?: string,
): T {
  const targets = global.telebiz?.bulkSend?.targets || [];
  const updatedTargets = targets.map((target) => {
    if (target.chatId === chatId) {
      return { ...target, status, error };
    }
    return target;
  });

  const completedCount = updatedTargets.filter((t) => t.status === 'sent').length;
  const failedCount = updatedTargets.filter((t) => t.status === 'failed').length;

  return updateTelebizBulkSend(global, {
    targets: updatedTargets,
    completedCount,
    failedCount,
  });
}

export function setTelebizBulkSendCurrentIndex<T extends GlobalState>(
  global: T,
  currentIndex: number,
): T {
  return updateTelebizBulkSend(global, { currentIndex });
}

export function cancelTelebizBulkSend<T extends GlobalState>(
  global: T,
): T {
  return updateTelebizBulkSend(global, {
    isActive: false,
  });
}

export function resetTelebizBulkSend<T extends GlobalState>(
  global: T,
): T {
  return updateTelebizBulkSend(global, INITIAL_TELEBIZ_STATE.bulkSend);
}

import type { GlobalState } from '../../../global/types';

import { INITIAL_TELEBIZ_STATE } from '../initialState';

export function selectTelebizBulkSendState(global: GlobalState) {
  return global.telebiz?.bulkSend || INITIAL_TELEBIZ_STATE.bulkSend;
}

export function selectIsTelebizBulkSendActive(global: GlobalState): boolean {
  return global.telebiz?.bulkSend?.isActive || false;
}

export function selectTelebizBulkSendProgress(global: GlobalState) {
  const bulkSend = global.telebiz?.bulkSend || INITIAL_TELEBIZ_STATE.bulkSend;
  const total = bulkSend.targets.length;
  const completed = bulkSend.completedCount + bulkSend.failedCount;
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const isCompleted = total > 0 && completed === total && !bulkSend.isActive;

  return {
    total,
    completed,
    percentage,
    isCompleted,
    successCount: bulkSend.completedCount,
    failedCount: bulkSend.failedCount,
    currentIndex: bulkSend.currentIndex,
  };
}

export function selectTelebizBulkSendCurrentTarget(global: GlobalState) {
  const bulkSend = global.telebiz?.bulkSend;
  if (!bulkSend || !bulkSend.isActive) return undefined;

  // Use currentIndex to get the current target being processed
  const currentTarget = bulkSend.targets[bulkSend.currentIndex];
  return currentTarget?.chatId;
}

import type { ManagementProgress, ManagementState } from '../../types';
import type { GlobalState, TabArgs } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { selectTabState } from '../selectors';
import { updateTabState } from './tabs';

export function updateManagementProgress<T extends GlobalState>(
  global: T, progress: ManagementProgress,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    management: {
      ...selectTabState(global, tabId).management,
      progress,
    },
  }, tabId);
}

export function updateManagement<T extends GlobalState>(
  global: T, chatId: string, update: Partial<ManagementState>,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const { management } = selectTabState(global, tabId);
  return updateTabState(global, {
    management: {
      ...management,
      byChatId: {
        ...management.byChatId,
        [chatId]: {
          ...(management.byChatId[chatId] || {}),
          ...update,
        },
      },
    },
  }, tabId);
}

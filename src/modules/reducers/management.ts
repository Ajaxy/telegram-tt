import { GlobalState } from '../../global/types';
import { ManagementProgress } from '../../types';

interface ManagementState {
  isActive: boolean;
  isUsernameAvailable?: boolean;
  error?: string;
}

export function updateManagementProgress(global: GlobalState, progress: ManagementProgress): GlobalState {
  return {
    ...global,
    management: {
      ...global.management,
      progress,
    },
  };
}

export function updateManagement(global: GlobalState, chatId: string, update: Partial<ManagementState>): GlobalState {
  return {
    ...global,
    management: {
      ...global.management,
      byChatId: {
        ...global.management.byChatId,
        [chatId]: {
          ...(global.management.byChatId[chatId] || {}),
          ...update,
        },
      },
    },
  };
}

import type { GlobalState, SharedState } from '../types';

export function updateSharedState<T extends GlobalState>(
  global: T, update: Partial<SharedState>,
): T {
  return {
    ...global,
    sharedState: {
      ...global.sharedState,
      ...update,
    },
  };
}

import type { GlobalState, TabArgs, TabState } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';

export function updateTabState<T extends GlobalState>(
  global: T,
  tabStatePartial: Partial<TabState>,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return {
    ...global,
    byTabId: {
      ...global.byTabId,
      [tabId]: {
        ...global.byTabId[tabId],
        ...tabStatePartial,
      },
    },
  };
}

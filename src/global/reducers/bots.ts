import type { InlineBotSettings } from '../../types';
import type { GlobalState, TabArgs } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { selectTabState } from '../selectors';
import { updateTabState } from './tabs';

export function replaceInlineBotSettings<T extends GlobalState>(
  global: T, username: string, inlineBotSettings: InlineBotSettings | false,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  const tabState = selectTabState(global, tabId);
  return updateTabState(global, {
    inlineBots: {
      ...tabState.inlineBots,
      byUsername: {
        ...tabState.inlineBots.byUsername,
        [username]: inlineBotSettings,
      },
    },
  }, tabId);
}

export function replaceInlineBotsIsLoading<T extends GlobalState>(
  global: T, isLoading: boolean,
  ...[tabId = getCurrentTabId()]: TabArgs<T>
): T {
  return updateTabState(global, {
    inlineBots: {
      ...selectTabState(global, tabId).inlineBots,
      isLoading,
    },
  }, tabId);
}

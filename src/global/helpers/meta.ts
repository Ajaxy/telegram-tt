import type { ActionReturnType, TabState } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { updateTabState } from '../reducers/tabs';
import { addActionHandler, type TabStateActionNames } from '..';

export function addTabStateResetterAction<ActionName extends TabStateActionNames>(
  name: ActionName, key: keyof TabState,
) {
  // @ts-ignore
  addActionHandler(name, (global, actions, payload): ActionReturnType => {
    const { tabId = getCurrentTabId() } = payload || {};

    return updateTabState(global, {
      [key]: undefined,
    }, tabId);
  });
}

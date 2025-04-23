import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler } from '../..';
import { updateTabState } from '../../reducers/tabs';

addActionHandler('openFrozenAccountModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    isFrozenAccountModalOpen: true,
  }, tabId);
});

addActionHandler('closeFrozenAccountModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    isFrozenAccountModalOpen: false,
  }, tabId);
});

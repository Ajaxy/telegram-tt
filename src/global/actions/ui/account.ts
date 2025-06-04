import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler, setGlobal } from '../..';
import { updateTabState } from '../../reducers/tabs';
import { selectTabState } from '../../selectors';

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

addActionHandler('openDeleteAccountModal', (global, actions, payload): ActionReturnType => {
  const { days, tabId = getCurrentTabId() } = payload || {};
  if (!days) return;

  global = updateTabState(global, {
    ...selectTabState(global, tabId),
    deleteAccountModal: {
      selfDestructAccountDays: days,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('closeDeleteAccountModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    deleteAccountModal: undefined,
  }, tabId);
});

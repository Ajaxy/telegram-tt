import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addTabStateResetterAction } from '../../helpers/meta';
import { addActionHandler } from '../../index';
import { updateTabState } from '../../reducers/tabs';

addActionHandler('openWishModal', (global, actions, payload): ActionReturnType => {
  const { ownerId, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    wishModal: { ownerId },
  }, tabId);
});

addTabStateResetterAction('closeWishModal', 'wishModal');

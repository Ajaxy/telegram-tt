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

addActionHandler('openWishSendModal', (global, actions, payload): ActionReturnType => {
  const { ownerId, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    wishSendModal: { ownerId },
  }, tabId);
});

addTabStateResetterAction('closeWishSendModal', 'wishSendModal');

addActionHandler('startWishBurst', (global, actions, payload): ActionReturnType => {
  const { ownerId, amountGram, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    wishSendModal: undefined,
    wishModal: undefined,
    wishBurst: { id: Date.now(), ownerId, amountGram },
  }, tabId);
});

addTabStateResetterAction('finishWishBurst', 'wishBurst');

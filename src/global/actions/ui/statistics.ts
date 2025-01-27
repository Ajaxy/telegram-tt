import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler } from '../..';
import { updateVerifyMonetizationModal } from '../../reducers';
import { updateTabState } from '../../reducers/tabs';

addActionHandler('openMonetizationVerificationModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId(), chatId } = payload || {};

  return updateTabState(global, {
    monetizationVerificationModal: {
      chatId,
    },
  }, tabId);
});

addActionHandler('closeMonetizationVerificationModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    monetizationVerificationModal: undefined,
  }, tabId);
});

addActionHandler('clearMonetizationVerificationError', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateVerifyMonetizationModal(global, { errorKey: undefined }, tabId);
});

addActionHandler('closeMonetizationStatistics', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    monetizationStatistics: undefined,
  }, tabId);
});

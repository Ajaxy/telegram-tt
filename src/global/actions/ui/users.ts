import { addActionHandler } from '../../index';

import { closeNewContactDialog, updateUserSearch } from '../../reducers';
import type { ActionReturnType } from '../../types';
import { updateTabState } from '../../reducers/tabs';
import { getCurrentTabId } from '../../../util/establishMultitabRole';

addActionHandler('setUserSearchQuery', (global, actions, payload): ActionReturnType => {
  const {
    query,
    tabId = getCurrentTabId(),
  } = payload!;

  return updateUserSearch(global, {
    globalUserIds: undefined,
    localUserIds: undefined,
    fetchingStatus: Boolean(query),
    query,
  }, tabId);
});

addActionHandler('openAddContactDialog', (global, actions, payload): ActionReturnType => {
  const { userId, tabId = getCurrentTabId() } = payload!;

  return updateTabState(global, {
    newContact: { userId },
  }, tabId);
});

addActionHandler('openNewContactDialog', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    newContact: {
      isByPhoneNumber: true,
    },
  }, tabId);
});

addActionHandler('closeNewContactDialog', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return closeNewContactDialog(global, tabId);
});

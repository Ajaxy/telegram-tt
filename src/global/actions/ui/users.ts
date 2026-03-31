import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addTabStateResetterAction } from '../../helpers/meta';
import { addActionHandler } from '../../index';
import { closeNewContactDialog, updateUserSearch } from '../../reducers';
import { updateTabState } from '../../reducers/tabs';
import { selectIsCurrentUserFrozen } from '../../selectors';

addActionHandler('setUserSearchQuery', (global, actions, payload): ActionReturnType => {
  const {
    query,
    tabId = getCurrentTabId(),
  } = payload;

  return updateUserSearch(global, {
    globalUserIds: undefined,
    localUserIds: undefined,
    fetchingStatus: Boolean(query),
    query,
  }, tabId);
});

addActionHandler('openAddContactDialog', (global, actions, payload): ActionReturnType => {
  const { userId, tabId = getCurrentTabId() } = payload;

  if (selectIsCurrentUserFrozen(global)) {
    actions.openFrozenAccountModal({ tabId });
    return global;
  }

  return updateTabState(global, {
    newContact: { userId },
  }, tabId);
});

addActionHandler('openNewContactDialog', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  if (selectIsCurrentUserFrozen(global)) {
    actions.openFrozenAccountModal({ tabId });
    return global;
  }

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

addActionHandler('closeSuggestedStatusModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    suggestedStatusModal: undefined,
  }, tabId);
});

addTabStateResetterAction('closeChatRefundModal', 'chatRefundModal');

addActionHandler('openDisableSharingAboutModal', (global, actions, payload): ActionReturnType => {
  const { userId, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    disableSharingAboutModal: { userId },
  }, tabId);
});

addTabStateResetterAction('closeDisableSharingAboutModal', 'disableSharingAboutModal');

addActionHandler('openProfileRatingModal', (global, actions, payload): ActionReturnType => {
  const { userId, level, tabId = getCurrentTabId() } = payload;

  return updateTabState(global, {
    profileRatingModal: {
      userId,
      level,
    },
  }, tabId);
});

addTabStateResetterAction('closeProfileRatingModal', 'profileRatingModal');

addActionHandler('openRankModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId(), ...rest } = payload;

  return updateTabState(global, {
    rankModal: rest,
  }, tabId);
});

addTabStateResetterAction('closeRankModal', 'rankModal');

addActionHandler('openEditRankModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId(), ...rest } = payload;

  return updateTabState(global, {
    editRankModal: rest,
  }, tabId);
});

addTabStateResetterAction('closeEditRankModal', 'editRankModal');

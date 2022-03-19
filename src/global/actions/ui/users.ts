import { addActionHandler } from '../../index';

import { closeNewContactDialog, updateUserSearch } from '../../reducers';

addActionHandler('setUserSearchQuery', (global, actions, payload) => {
  const { query } = payload!;

  return updateUserSearch(global, {
    globalUserIds: undefined,
    localUserIds: undefined,
    fetchingStatus: Boolean(query),
    query,
  });
});

addActionHandler('openAddContactDialog', (global, actions, payload) => {
  const { userId } = payload!;

  return {
    ...global,
    newContact: { userId },
  };
});

addActionHandler('openNewContactDialog', (global) => {
  return {
    ...global,
    newContact: {
      isByPhoneNumber: true,
    },
  };
});

addActionHandler('closeNewContactDialog', (global) => {
  return closeNewContactDialog(global);
});

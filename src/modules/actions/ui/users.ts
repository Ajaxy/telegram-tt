import { addReducer } from '../../../lib/teact/teactn';

import { GlobalState } from '../../../global/types';

import { updateSelectedUserId, updateUserSearch } from '../../reducers';

addReducer('openUserInfo', (global, actions, payload) => {
  const { id } = payload!;

  actions.openChat({ id });
});

const clearSelectedUserId = (global: GlobalState) => updateSelectedUserId(global, undefined);

addReducer('openChat', clearSelectedUserId);

addReducer('setUserSearchQuery', (global, actions, payload) => {
  const { query } = payload!;

  return updateUserSearch(global, {
    globalUserIds: undefined,
    localUserIds: undefined,
    fetchingStatus: Boolean(query),
    query,
  });
});

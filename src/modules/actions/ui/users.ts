import { addReducer } from '../..';

import { updateUserSearch } from '../../reducers';

addReducer('setUserSearchQuery', (global, actions, payload) => {
  const { query } = payload!;

  return updateUserSearch(global, {
    globalUserIds: undefined,
    localUserIds: undefined,
    fetchingStatus: Boolean(query),
    query,
  });
});

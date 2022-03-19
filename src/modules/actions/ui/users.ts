import { addActionHandler } from '../..';

import { updateUserSearch } from '../../reducers';

addActionHandler('setUserSearchQuery', (global, actions, payload) => {
  const { query } = payload!;

  return updateUserSearch(global, {
    globalUserIds: undefined,
    localUserIds: undefined,
    fetchingStatus: Boolean(query),
    query,
  });
});

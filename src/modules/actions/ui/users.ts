import { addReducer } from '../../../lib/teact/teactn';

import { GlobalState } from '../../../global/types';

import { updateSelectedUserId } from '../../reducers';

addReducer('openUserInfo', (global, actions, payload) => {
  const { id } = payload!;

  actions.openChat({ id });
});

const clearSelectedUserId = (global: GlobalState) => updateSelectedUserId(global, undefined);

addReducer('openChat', clearSelectedUserId);

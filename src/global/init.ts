import { addActionHandler } from './index';

import { INITIAL_STATE } from './initialState';
import { initCache, loadCache } from './cache';
import { cloneDeep } from '../util/iteratees';
import { IS_MOCKED_CLIENT } from '../config';

initCache();

addActionHandler('init', () => {
  const initial = cloneDeep(INITIAL_STATE);
  const state = loadCache(initial) || initial;
  if (IS_MOCKED_CLIENT) state.authState = 'authorizationStateReady';
  return state;
});

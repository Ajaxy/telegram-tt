import { addReducer } from '../modules';

import { INITIAL_STATE } from './initial';
import { initCache, loadCache } from './cache';
import { cloneDeep } from '../util/iteratees';

initCache();

addReducer('init', () => {
  const initial = cloneDeep(INITIAL_STATE);
  return loadCache(initial) || initial;
});

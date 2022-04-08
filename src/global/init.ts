import { addActionHandler } from './index';

import { INITIAL_STATE } from './initialState';
import { initCache, loadCache } from './cache';
import { cloneDeep } from '../util/iteratees';

initCache();

addActionHandler('init', (global) => {
  const initial = cloneDeep(INITIAL_STATE);
  return {
    ...global,
    ...(loadCache(initial) || initial),
  };
});

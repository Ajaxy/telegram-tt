import { addActionHandler } from '../modules';

import { INITIAL_STATE } from './initial';
import { initCache, loadCache } from './cache';
import { cloneDeep } from '../util/iteratees';

initCache();

addActionHandler('init', () => {
  const initial = cloneDeep(INITIAL_STATE);
  return loadCache(initial) || initial;
});

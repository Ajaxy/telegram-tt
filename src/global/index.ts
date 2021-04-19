import { addReducer } from '../lib/teact/teactn';

import { INITIAL_STATE } from './initial';
import { initCache, loadCache } from './cache';
import { cloneDeep } from '../util/iteratees';
import { selectCurrentMessageList } from '../modules/selectors';

initCache();

addReducer('init', () => {
  const initial = cloneDeep(INITIAL_STATE);
  const newGlobal = loadCache(initial) || initial;

  const currentMessageList = selectCurrentMessageList(newGlobal) || {};
  window.history.replaceState(currentMessageList, '');

  return newGlobal;
});

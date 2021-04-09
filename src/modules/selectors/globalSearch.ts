import { GlobalState } from '../../global/types';

export function selectCurrentGlobalSearchQuery(global: GlobalState) {
  return global.globalSearch.query;
}

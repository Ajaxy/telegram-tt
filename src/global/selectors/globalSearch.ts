import type { GlobalState } from '../types';

export function selectCurrentGlobalSearchQuery(global: GlobalState) {
  return global.globalSearch.query;
}

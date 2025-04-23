import type { GlobalState } from '../types';

export function selectSharedState<T extends GlobalState>(
  global: T,
) {
  return global.sharedState;
}

export function selectSharedSettings<T extends GlobalState>(
  global: T,
) {
  return selectSharedState(global).settings;
}

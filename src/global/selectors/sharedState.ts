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

export function selectAnimationLevel<T extends GlobalState>(
  global: T,
) {
  return selectSharedSettings(global).animationLevel;
}

import type { GlobalState } from '../types';

export function selectNotifySettings<T extends GlobalState>(global: T) {
  return global.settings.byKey;
}

export function selectNotifyExceptions<T extends GlobalState>(global: T) {
  return global.settings.notifyExceptions;
}

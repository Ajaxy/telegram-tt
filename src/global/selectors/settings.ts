import { GlobalState } from '../types';

export function selectNotifySettings(global: GlobalState) {
  return global.settings.byKey;
}

export function selectNotifyExceptions(global: GlobalState) {
  return global.settings.notifyExceptions;
}

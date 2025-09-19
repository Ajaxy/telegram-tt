import { getGlobal } from '../global';

import { DEBUG } from '../config';
import { selectTabState } from '../global/selectors';
import { IS_TAURI } from './browser/globalEnvironment';

export function updateAppBadge(unreadCount: number, isMuted?: boolean) {
  if (IS_TAURI) {
    window.tauri?.setNotificationsCount?.(unreadCount, isMuted);
    return;
  }

  if (!selectTabState(getGlobal()).isMasterTab) return;
  if (typeof window.navigator.setAppBadge !== 'function') {
    return;
  }

  window.navigator.setAppBadge(unreadCount).catch((err) => {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  });
}

import { getGlobal } from '../global';

import { DEBUG } from '../config';
import { selectTabState } from '../global/selectors';

export function updateAppBadge(unreadCount: number) {
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

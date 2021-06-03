import { DEBUG } from '../config';

export function updateAppBadge(unreadCount: number) {
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

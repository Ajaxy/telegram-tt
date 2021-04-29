import { callApi } from '../api/gramjs';
import { DEBUG } from '../config';
import { IS_SERVICE_WORKER_SUPPORTED } from './environment';

function getDeviceToken(subscription: PushSubscription) {
  const data = subscription.toJSON();
  return JSON.stringify({ endpoint: data.endpoint, keys: data.keys });
}

export function isPushSupported() {
  if (!IS_SERVICE_WORKER_SUPPORTED) return false;
  if (!('showNotification' in ServiceWorkerRegistration.prototype)) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log('[PUSH] Push notifications aren\'t supported.');
    }
    return false;
  }

  // Check the current Notification permission.
  // If its denied, it's a permanent block until the
  // user changes the permission
  if (Notification.permission === 'denied') {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log('[PUSH] The user has blocked push notifications.');
    }
    return false;
  }

  // Check if push messaging is supported
  if (!('PushManager' in window)) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log('[PUSH] Push messaging isn\'t supported.');
    }
    return false;
  }
  return true;
}

export async function unsubscribeFromPush() {
  if (!isPushSupported) return;
  const serviceWorkerRegistration = await navigator.serviceWorker.ready;
  const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
  if (subscription) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log('[PUSH] Unsubscribing', subscription);
    }
    try {
      const deviceToken = getDeviceToken(subscription);
      await callApi('unregisterDevice', deviceToken);
      await subscription.unsubscribe();
    } catch (error) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[PUSH] Unable to unsubscribe from push.', error);
      }
    }
  }
}

export async function subscribeToPush() {
  if (!isPushSupported()) return;
  await unsubscribeFromPush();
  const serviceWorkerRegistration = await navigator.serviceWorker.ready;
  try {
    const subscription = await serviceWorkerRegistration.pushManager.subscribe({
      userVisibleOnly: true,
    });
    const deviceToken = getDeviceToken(subscription);
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log('[PUSH] Received push subscription: ', deviceToken);
    }
    await callApi('registerDevice', deviceToken);
  } catch (error) {
    if (Notification.permission === 'denied' as NotificationPermission) {
      // The user denied the notification permission which
      // means we failed to subscribe and the user will need
      // to manually change the notification permission to
      // subscribe to push messages
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[PUSH] Permission for Notifications was denied');
      }
    } else if (DEBUG) {
      // A problem occurred with the subscription, this can
      // often be down to an issue or lack of the gcm_sender_id
      // and / or gcm_user_visible_only
      // eslint-disable-next-line no-console
      console.log('[PUSH] Unable to subscribe to push.', error);
    }
  }
}

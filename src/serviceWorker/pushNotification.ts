import { DEBUG } from '../config';

declare const self: ServiceWorkerGlobalScope;

export enum NotificationType {
  MESSAGE_TEXT = 'MESSAGE_TEXT',
  MESSAGE_NOTEXT = 'MESSAGE_NOTEXT',
  MESSAGE_STICKER = 'MESSAGE_STICKER'
}

export type NotificationData = {
  custom: {
    msg_id: string;
    from_id: string;
  };
  mute: '0' | '1';
  badge: '0' | '1';
  loc_key: NotificationType;
  loc_args: string[];
  random_id: number;
  title: string;
  description: string;
};


export function handlePush(e: PushEvent) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[SW] Push received event', e);
    if (e.data) {
      // eslint-disable-next-line no-console
      console.log('[SW] Push received with data', e.data.json());
    }
  }
  if (!e.data) return;
  let data: NotificationData;
  try {
    data = e.data.json();
  } catch (error) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log('[SW] Unable to parse push notification data', e.data);
    }
    return;
  }

  const title = data.title || process.env.APP_INFO!;
  const body = data.description;
  const options = {
    body,
    icon: 'android-chrome-192x192.png',
  };

  e.waitUntil(
    self.registration.showNotification(title, options),
  );
}

export function handleNotificationClick(e: NotificationEvent) {
  const appUrl = process.env.APP_URL!;
  e.notification.close(); // Android needs explicit close.
  e.waitUntil(
    self.clients.matchAll({ type: 'window' })
      .then((windowClients) => {
        // Check if there is already a window/tab open with the target URL
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i] as WindowClient;
          // If so, just focus it.
          if (client.url === self.registration.scope && client.focus) {
            client.focus();
            return;
          }
        }
        // If not, then open the target URL in a new window/tab.
        if (self.clients.openWindow) {
          self.clients.openWindow(appUrl);
        }
      }),
  );
}

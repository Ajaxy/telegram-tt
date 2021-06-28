import { APP_NAME, DEBUG } from '../config';
import { debounce } from '../util/schedulers';

declare const self: ServiceWorkerGlobalScope;

enum Boolean {
  True = '1',
  False = '0'
}

type PushData = {
  custom: {
    msg_id?: string;
    channel_id?: string;
    chat_id?: string;
    from_id?: string;
  };
  mute: Boolean;
  badge: Boolean;
  loc_key: string;
  loc_args: string[];
  random_id: number;
  title: string;
  description: string;
};

type NotificationData = {
  messageId?: number;
  chatId?: number;
  title: string;
  body: string;
};

let lastSyncAt = new Date().valueOf();

const clickBuffer: Record<string, NotificationData> = {};
const shownNotifications = new Set();
let pendingNotifications: Record<number, NotificationData[]> = {};

function getPushData(e: PushEvent | Notification): PushData | undefined {
  try {
    return e.data.json();
  } catch (error) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log('[SW] Unable to parse push notification data', e.data);
    }
    return undefined;
  }
}

function getChatId(data: PushData) {
  if (data.custom.from_id) {
    return parseInt(data.custom.from_id, 10);
  }
  // Chats and channels have negative IDs
  if (data.custom.chat_id) {
    return parseInt(data.custom.chat_id, 10) * -1;
  }
  if (data.custom.channel_id) {
    return parseInt(data.custom.channel_id, 10) * -1;
  }
  return undefined;
}

function getMessageId(data: PushData) {
  if (!data.custom.msg_id) return undefined;
  return parseInt(data.custom.msg_id, 10);
}

function getNotificationData(data: PushData): NotificationData {
  return {
    chatId: getChatId(data),
    messageId: getMessageId(data),
    title: data.title || APP_NAME,
    body: data.description,
  };
}

function showNotification({
  chatId,
  messageId,
  body,
  title,
}: NotificationData) {
  return self.registration.showNotification(title, {
    body,
    data: {
      chatId,
      messageId,
    },
    icon: 'icon-192x192.png',
    badge: 'icon-192x192.png',
    vibrate: [200, 100, 200],
  });
}

async function showNotifications(groupLimit: number = 1) {
  const count = Object.keys(pendingNotifications).reduce<number>((result, groupId) => {
    result += pendingNotifications[Number(groupId)].length;
    return result;
  }, 0);
  // if we have more than groupLimit notification groups we send only one notification
  if (Object.keys(pendingNotifications).length > groupLimit) {
    await showNotification({
      title: APP_NAME,
      body: `You have ${count} new Telegram notifications`,
    });
  } else {
    // Else we send a notification per group
    await Promise.all(Object.keys(pendingNotifications)
      // eslint-disable-next-line no-async-without-await/no-async-without-await
      .map(async (groupId) => {
        const group = pendingNotifications[Number(groupId)];
        if (group.length > groupLimit) {
          const lastMessage = group[group.length - 1];
          return showNotification({
            title: APP_NAME,
            body: `You have ${count} notifications from ${lastMessage.title}`,
            messageId: lastMessage.messageId,
            chatId: Number(groupId),
          });
        }
        return Promise.all(group.map(showNotification));
      }));
  }

  // Clear all pending notifications
  pendingNotifications = {};
}

const flushNotifications = debounce(showNotifications, 1000, false);

async function handleNotification(notification: NotificationData, groupLimit?: number) {
  // Dont show already triggered notification
  if (shownNotifications.has(notification.messageId)) {
    shownNotifications.delete(notification.messageId);
    return;
  }

  const groupId = notification.chatId || 0;
  if (!pendingNotifications[groupId]) {
    pendingNotifications[groupId] = [];
  }
  pendingNotifications[groupId].push(notification);
  await flushNotifications(groupLimit);
}

export function handlePush(e: PushEvent) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[SW] Push received event', e);
    if (e.data) {
      // eslint-disable-next-line no-console
      console.log('[SW] Push received with data', e.data.json());
    }
  }

  // Do not show notifications right after sync (when browser is opened)
  // To avoid stale notifications
  if (new Date().valueOf() - lastSyncAt < 3000) return;

  const data = getPushData(e);

  // Do not show muted notifications
  if (!data || data.mute === Boolean.True) return;

  const notification = getNotificationData(data);
  e.waitUntil(handleNotification(notification));
}

async function focusChatMessage(client: WindowClient, data: { chatId?: number; messageId?: number }) {
  const {
    chatId,
    messageId,
  } = data;
  if (!chatId) return;
  client.postMessage({
    type: 'focusMessage',
    payload: {
      chatId,
      messageId,
    },
  });
  // Catch "focus not allowed" DOM Exceptions
  try {
    await client.focus();
  } catch (error) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[SW] ', error);
    }
  }
}

export function handleNotificationClick(e: NotificationEvent) {
  const appUrl = self.location.href.replace('serviceWorker.js', '');
  e.notification.close(); // Android needs explicit close.
  const { data } = e.notification;
  const notifyClients = async () => {
    const clients = await self.clients.matchAll({ type: 'window' }) as WindowClient[];
    const clientsInScope = clients.filter((client) => client.url === self.registration.scope);
    e.waitUntil(Promise.all(clientsInScope.map((client) => {
      clickBuffer[client.id] = data;
      return focusChatMessage(client, data);
    })));
    if (!self.clients.openWindow || clientsInScope.length > 0) return undefined;

    // If there is no opened client we need to open one and wait until it is fully loaded
    const newClient = await self.clients.openWindow(appUrl);
    if (newClient) {
      // Store notification data until client is fully loaded
      clickBuffer[newClient.id] = data;
    }
    return undefined;
  };
  e.waitUntil(notifyClients());
}

export function handleClientMessage(e: ExtendableMessageEvent) {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[SW] New message from client', e);
  }
  if (!e.data) return;
  const source = e.source as WindowClient;
  if (e.data.type === 'clientReady') {
    // focus on chat message when client is fully ready
    if (clickBuffer[source.id]) {
      e.waitUntil(focusChatMessage(source, clickBuffer[source.id]));
      delete clickBuffer[source.id];
    }
  }
  if (e.data.type === 'newMessageNotification') {
    // store messageId for already shown notification
    const notification: NotificationData = e.data.payload;
    e.waitUntil(handleNotification(notification, 3));
    shownNotifications.add(notification.messageId);
  }
}

self.onsync = () => {
  lastSyncAt = new Date().valueOf();
};

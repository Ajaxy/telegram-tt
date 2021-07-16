import { callApi } from '../api/gramjs';
import { ApiChat, ApiMessage, ApiUser } from '../api/types';
import { renderActionMessageText } from '../components/common/helpers/renderActionMessageText';
import { DEBUG } from '../config';
import { getDispatch, getGlobal, setGlobal } from '../lib/teact/teactn';
import {
  getChatTitle,
  getMessageAction,
  getMessageSenderName,
  getMessageSummaryText,
  getPrivateChatUserId,
  isActionMessage,
  isChatChannel,
  selectIsChatMuted,
} from '../modules/helpers';
import { getTranslation } from './langProvider';
import { addNotifyExceptions, replaceSettings } from '../modules/reducers';
import {
  selectChatMessage, selectNotifyExceptions, selectNotifySettings, selectUser,
} from '../modules/selectors';
import { IS_SERVICE_WORKER_SUPPORTED } from './environment';

function getDeviceToken(subscription: PushSubscription) {
  const data = subscription.toJSON();
  return JSON.stringify({
    endpoint: data.endpoint,
    keys: data.keys,
  });
}

function checkIfPushSupported() {
  if (!IS_SERVICE_WORKER_SUPPORTED) return false;
  if (!('showNotification' in ServiceWorkerRegistration.prototype)) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[PUSH] Push notifications aren\'t supported.');
    }
    return false;
  }

  // Check the current Notification permission.
  // If its denied, it's a permanent block until the
  // user changes the permission
  if (Notification.permission === 'denied') {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[PUSH] The user has blocked push notifications.');
    }
    return false;
  }

  // Check if push messaging is supported
  if (!('PushManager' in window)) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[PUSH] Push messaging isn\'t supported.');
    }
    return false;
  }
  return true;
}

function checkIfNotificationsSupported() {
  // Let's check if the browser supports notifications
  if (!('Notification' in window)) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[PUSH] This browser does not support desktop notification');
    }
    return false;
  }

  if (Notification.permission === 'denied' as NotificationPermission) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[PUSH] The user has blocked push notifications.');
    }
    return false;
  }
  return true;
}

const expirationTime = 12 * 60 * 60 * 1000; // 12 hours

function checkIfShouldResubscribe(subscription: PushSubscription | null) {
  const global = getGlobal();
  if (!global.push || !subscription) return true;
  if (getDeviceToken(subscription) !== global.push.deviceToken) return true;
  return Date.now() - global.push.subscribedAt > expirationTime;
}

async function requestPermission() {
  if (!('Notification' in window)) return;
  if (!['granted', 'denied'].includes(Notification.permission)) {
    await Notification.requestPermission();
  }
}

async function unsubscribeFromPush(subscription: PushSubscription | null) {
  const global = getGlobal();
  const dispatch = getDispatch();
  if (subscription) {
    try {
      const deviceToken = getDeviceToken(subscription);
      await callApi('unregisterDevice', deviceToken);
      await subscription.unsubscribe();
      dispatch.deleteDeviceToken();
      return;
    } catch (error) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[PUSH] Unable to unsubscribe from push.', error);
      }
    }
  }
  if (global.push) {
    await callApi('unregisterDevice', global.push.deviceToken);
    dispatch.deleteDeviceToken();
  }
}

export async function unsubscribe() {
  if (!checkIfPushSupported()) return;
  const serviceWorkerRegistration = await navigator.serviceWorker.ready;
  const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
  await unsubscribeFromPush(subscription);
}

// Indicates if notification settings are loaded from the api
let areSettingsLoaded = false;

// Load notification settings from the api
async function loadNotificationSettings() {
  if (areSettingsLoaded) return;
  const [resultSettings, resultExceptions] = await Promise.all([
    callApi('fetchNotificationSettings', {
      serverTimeOffset: getGlobal().serverTimeOffset,
    }),
    callApi('fetchNotificationExceptions', {
      serverTimeOffset: getGlobal().serverTimeOffset,
    }),
  ]);
  if (!resultSettings) return;

  let global = replaceSettings(getGlobal(), resultSettings);
  if (resultExceptions) {
    global = addNotifyExceptions(global, resultExceptions);
  }
  setGlobal(global);
  areSettingsLoaded = true;
}

export async function subscribe() {
  if (!checkIfPushSupported()) {
    // Ask for notification permissions only if service worker notifications are not supported
    // As pushManager.subscribe automatically triggers permission popup
    await requestPermission();
    return;
  }
  const serviceWorkerRegistration = await navigator.serviceWorker.ready;
  let subscription = await serviceWorkerRegistration.pushManager.getSubscription();
  if (!checkIfShouldResubscribe(subscription)) return;
  await unsubscribeFromPush(subscription);
  try {
    subscription = await serviceWorkerRegistration.pushManager.subscribe({
      userVisibleOnly: true,
    });
    const deviceToken = getDeviceToken(subscription);
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.log('[PUSH] Received push subscription: ', deviceToken);
    }
    await callApi('registerDevice', deviceToken);
    getDispatch()
      .setDeviceToken(deviceToken);
  } catch (error) {
    if (Notification.permission === 'denied' as NotificationPermission) {
      // The user denied the notification permission which
      // means we failed to subscribe and the user will need
      // to manually change the notification permission to
      // subscribe to push messages
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.warn('[PUSH] The user has blocked push notifications.');
      }
    } else if (DEBUG) {
      // A problem occurred with the subscription, this can
      // often be down to an issue or lack of the gcm_sender_id
      // and / or gcm_user_visible_only
      // eslint-disable-next-line no-console
      console.log('[PUSH] Unable to subscribe to push.', error);

      // Request permissions and fall back to local notifications
      // if pushManager.subscribe was aborted due to invalid VAPID key.
      if (error.code === DOMException.ABORT_ERR) {
        await requestPermission();
      }
    }
  }
}

function checkIfShouldNotify(chat: ApiChat, isActive: boolean) {
  if (!areSettingsLoaded) return false;
  const global = getGlobal();
  if (selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global)) || chat.isNotJoined) {
    return false;
  }
  // Dont show notification for active chat if client has focus
  return !(isActive && document.hasFocus());
}

function getNotificationContent(chat: ApiChat, message: ApiMessage) {
  const global = getGlobal();
  const {
    senderId,
    replyToMessageId,
  } = message;
  const messageSender = senderId ? selectUser(global, senderId) : undefined;
  const messageAction = getMessageAction(message as ApiMessage);
  const actionTargetMessage = messageAction && replyToMessageId
    ? selectChatMessage(global, chat.id, replyToMessageId)
    : undefined;
  const {
    targetUserIds: actionTargetUserIds,
    targetChatId: actionTargetChatId,
  } = messageAction || {};

  const actionTargetUsers = actionTargetUserIds
    ? actionTargetUserIds.map((userId) => selectUser(global, userId)).filter<ApiUser>(Boolean as any)
    : undefined;
  const privateChatUserId = getPrivateChatUserId(chat);
  const privateChatUser = privateChatUserId ? selectUser(global, privateChatUserId) : undefined;
  let body: string;
  if (isActionMessage(message)) {
    const actionOrigin = chat && (isChatChannel(chat) || message.senderId === message.chatId)
      ? chat
      : messageSender;
    body = renderActionMessageText(
      getTranslation,
      message,
      actionOrigin,
      actionTargetUsers,
      actionTargetMessage,
      actionTargetChatId,
      { asPlain: true },
    ) as string;
  } else {
    const senderName = getMessageSenderName(getTranslation, chat.id, messageSender);
    const summary = getMessageSummaryText(getTranslation, message);

    body = senderName ? `${senderName}: ${summary}` : summary;
  }

  return {
    title: getChatTitle(getTranslation, chat, privateChatUser),
    body,
  };
}

export async function showNewMessageNotification({
  chat,
  message,
  isActiveChat,
}: { chat: ApiChat; message: Partial<ApiMessage>; isActiveChat: boolean}) {
  if (!checkIfNotificationsSupported()) return;
  if (!message.id) return;

  await loadNotificationSettings();
  if (!checkIfShouldNotify(chat, isActiveChat)) return;

  const {
    title,
    body,
  } = getNotificationContent(chat, message as ApiMessage);

  if (checkIfPushSupported()) {
    if (navigator.serviceWorker.controller) {
      // notify service worker about new message notification
      navigator.serviceWorker.controller.postMessage({
        type: 'newMessageNotification',
        payload: {
          title,
          body,
          chatId: chat.id,
          messageId: message.id,
        },
      });
    }
  } else {
    const dispatch = getDispatch();
    const options: NotificationOptions = {
      body,
      icon: 'icon-192x192.png',
      badge: 'icon-192x192.png',
      tag: message.id.toString(),
    };

    if ('vibrate' in navigator) {
      options.vibrate = [200, 100, 200];
    }

    const notification = new Notification(title, options);

    notification.onclick = () => {
      notification.close();
      dispatch.focusMessage({
        chatId: chat.id,
        messageId: message.id,
      });
      if (window.focus) {
        window.focus();
      }
    };
  }
}

// Notify service worker that client is fully loaded
export function notifyClientReady() {
  if (!navigator.serviceWorker.controller) return;
  navigator.serviceWorker.controller.postMessage({
    type: 'clientReady',
  });
}

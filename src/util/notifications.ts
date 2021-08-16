import { callApi } from '../api/gramjs';
import {
  ApiChat, ApiMediaFormat, ApiMessage, ApiUser,
} from '../api/types';
import { renderActionMessageText } from '../components/common/helpers/renderActionMessageText';
import { APP_NAME, DEBUG } from '../config';
import { getDispatch, getGlobal, setGlobal } from '../lib/teact/teactn';
import {
  getChatAvatarHash,
  getChatTitle,
  getMessageAction,
  getMessageSenderName,
  getMessageSummaryText,
  getPrivateChatUserId,
  isActionMessage,
  isChatChannel,
  selectIsChatMuted, selectShouldShowMessagePreview,
} from '../modules/helpers';
import { getTranslation } from './langProvider';
import { addNotifyExceptions, replaceSettings } from '../modules/reducers';
import {
  selectChatMessage, selectNotifyExceptions, selectNotifySettings, selectUser,
} from '../modules/selectors';
import { IS_SERVICE_WORKER_SUPPORTED } from './environment';
import * as mediaLoader from './mediaLoader';
import { debounce } from './schedulers';

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
// Notification id is removed from soundPlayed cache after 3 seconds
const soundPlayedDelay = 3 * 1000;
const soundPlayed = new Set<number>();

async function playSound(id: number) {
  if (soundPlayed.has(id)) return;
  const { notificationSoundVolume } = selectNotifySettings(getGlobal());
  const volume = notificationSoundVolume / 10;
  if (volume === 0) return;

  const audio = new Audio('/notification.mp3');
  audio.volume = volume;
  audio.setAttribute('mozaudiochannel', 'notification');
  audio.addEventListener('ended', () => {
    soundPlayed.add(id);
  }, { once: true });

  setTimeout(() => {
    soundPlayed.delete(id);
  }, soundPlayedDelay);

  try {
    await audio.play();
  } catch (error) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[PUSH] Unable to play notification sound');
    }
  }
}

export const playNotificationSound = debounce(playSound, 1000, true, false);

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
  const isMuted = selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global));
  if (isMuted || chat.isNotJoined || !chat.isListed) {
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
    ? actionTargetUserIds.map((userId) => selectUser(global, userId))
      .filter<ApiUser>(Boolean as any)
    : undefined;
  const privateChatUserId = getPrivateChatUserId(chat);
  const privateChatUser = privateChatUserId ? selectUser(global, privateChatUserId) : undefined;

  let body: string;
  if (selectShouldShowMessagePreview(chat, selectNotifySettings(global), selectNotifyExceptions(global))) {
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
  } else {
    body = 'New message';
  }

  return {
    title: getChatTitle(getTranslation, chat, privateChatUser),
    body,
  };
}

async function getAvatar(chat: ApiChat) {
  const imageHash = getChatAvatarHash(chat);
  if (!imageHash) return undefined;
  let mediaData = mediaLoader.getFromMemory<ApiMediaFormat.BlobUrl>(imageHash);
  if (!mediaData) {
    await mediaLoader.fetch(imageHash, ApiMediaFormat.BlobUrl);
    mediaData = mediaLoader.getFromMemory<ApiMediaFormat.BlobUrl>(imageHash);
  }
  return mediaData;
}

type NotificationData = {
  messageId?: number;
  chatId?: number;
  title: string;
  body: string;
  icon?: string;
};

const handledNotifications = new Set();
let pendingNotifications: Record<number, NotificationData[]> = {};

async function showNotifications(groupLimit: number = 2) {
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

async function handleNotification(data: NotificationData, groupLimit?: number) {
  // Dont show already triggered notification
  if (handledNotifications.has(data.messageId)) {
    handledNotifications.delete(data.messageId);
    return;
  }

  const groupId = data.chatId || 0;
  if (!pendingNotifications[groupId]) {
    pendingNotifications[groupId] = [];
  }
  pendingNotifications[groupId].push(data);
  await flushNotifications(groupLimit);

  if (checkIfPushSupported()) {
    if (navigator.serviceWorker.controller) {
      // notify service worker that notification was handled locally
      navigator.serviceWorker.controller.postMessage({
        type: 'notificationHandled',
        payload: data,
      });
    }
  }

  handledNotifications.add(data.messageId);
}

function showNotification(data: NotificationData) {
  if (checkIfPushSupported()) {
    if (navigator.serviceWorker.controller) {
      // notify service worker about new message notification
      navigator.serviceWorker.controller.postMessage({
        type: 'newMessageNotification',
        payload: data,
      });
    }
  } else {
    const dispatch = getDispatch();
    const options: NotificationOptions = {
      body: data.body,
      icon: data.icon,
      badge: data.icon,
      tag: data.messageId ? data.messageId.toString() : undefined,
    };

    if ('vibrate' in navigator) {
      options.vibrate = [200, 100, 200];
    }

    const notification = new Notification(data.title, options);

    notification.onclick = () => {
      notification.close();
      dispatch.focusMessage({
        chatId: data.chatId,
        messageId: data.messageId,
      });
      if (window.focus) {
        window.focus();
      }
    };

    // Play sound when notification is displayed
    notification.onshow = () => {
      const id = data.messageId || data.chatId;
      if (id) playNotificationSound(id);
    };
  }
}

export async function showNewMessageNotification({
  chat,
  message,
  isActiveChat,
}: { chat: ApiChat; message: Partial<ApiMessage>; isActiveChat: boolean }) {
  if (!checkIfNotificationsSupported()) return;
  if (!message.id) return;

  await loadNotificationSettings();
  if (!checkIfShouldNotify(chat, isActiveChat)) return;

  const {
    title,
    body,
  } = getNotificationContent(chat, message as ApiMessage);

  const icon = await getAvatar(chat);

  await handleNotification({
    title,
    body,
    icon,
    messageId: message.id,
    chatId: chat.id,
  });
}

// Notify service worker that client is fully loaded
export function notifyClientReady() {
  if (!navigator.serviceWorker.controller) return;
  navigator.serviceWorker.controller.postMessage({
    type: 'clientReady',
  });
}

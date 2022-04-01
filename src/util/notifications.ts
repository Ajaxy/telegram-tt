import { callApi } from '../api/gramjs';
import {
  ApiChat, ApiMediaFormat, ApiMessage, ApiUser, ApiUserReaction,
} from '../api/types';
import { renderActionMessageText } from '../components/common/helpers/renderActionMessageText';
import { DEBUG, IS_TEST } from '../config';
import { getActions, getGlobal, setGlobal } from '../global';
import {
  getChatAvatarHash,
  getChatTitle,
  getMessageAction,
  getMessageRecentReaction,
  getMessageSenderName,
  getMessageSummaryText,
  getPrivateChatUserId,
  isActionMessage,
  isChatChannel,
  selectIsChatMuted,
  selectShouldShowMessagePreview,
} from '../global/helpers';
import { addNotifyExceptions, replaceSettings } from '../global/reducers';
import {
  selectChatMessage,
  selectCurrentMessageList,
  selectNotifyExceptions,
  selectNotifySettings,
  selectUser,
} from '../global/selectors';
import { IS_SERVICE_WORKER_SUPPORTED, IS_TOUCH_ENV } from './environment';
import { getTranslation } from './langProvider';
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
const soundPlayedIds = new Set<string>();

export async function playNotifySound(id?: string, volume?: number) {
  if (id !== undefined && soundPlayedIds.has(id)) return;
  const { notificationSoundVolume } = selectNotifySettings(getGlobal());
  const currentVolume = volume ? volume / 10 : notificationSoundVolume / 10;
  if (currentVolume === 0) return;

  const audio = new Audio('./notification.mp3');
  audio.volume = currentVolume;
  audio.setAttribute('mozaudiochannel', 'notification');
  if (id !== undefined) {
    audio.addEventListener('ended', () => {
      soundPlayedIds.add(id);
    }, { once: true });

    setTimeout(() => {
      soundPlayedIds.delete(id);
    }, soundPlayedDelay);
  }

  try {
    await audio.play();
  } catch (error) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[PUSH] Unable to play notification sound');
    }
  }
}

export const playNotifySoundDebounced = debounce(playNotifySound, 1000, true, false);

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
  const dispatch = getActions();
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
  if (areSettingsLoaded) return selectNotifySettings(getGlobal());
  const [resultSettings, resultExceptions] = await Promise.all([
    callApi('fetchNotificationSettings', {
      serverTimeOffset: getGlobal().serverTimeOffset,
    }),
    callApi('fetchNotificationExceptions', {
      serverTimeOffset: getGlobal().serverTimeOffset,
    }),
  ]);
  if (!resultSettings) return selectNotifySettings(getGlobal());

  let global = replaceSettings(getGlobal(), resultSettings);
  if (resultExceptions) {
    global = addNotifyExceptions(global, resultExceptions);
  }
  setGlobal(global);
  areSettingsLoaded = true;
  return selectNotifySettings(global);
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
    getActions()
      .setDeviceToken(deviceToken);
  } catch (error: any) {
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

function checkIfShouldNotify(chat: ApiChat) {
  if (!areSettingsLoaded) return false;
  const global = getGlobal();
  const isMuted = selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global));
  if (isMuted || chat.isNotJoined || !chat.isListed) {
    return false;
  }
  // On touch devices show notifications when chat is not active
  if (IS_TOUCH_ENV) {
    const {
      chatId,
      type,
    } = selectCurrentMessageList(global) || {};
    return !(chatId === chat.id && type === 'thread');
  }
  // On desktop show notifications when window is not focused
  return !document.hasFocus();
}

function getNotificationContent(chat: ApiChat, message: ApiMessage, reaction?: ApiUserReaction) {
  const global = getGlobal();
  const {
    replyToMessageId,
  } = message;
  let {
    senderId,
  } = message;
  if (reaction) senderId = reaction.userId;

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
      const isChat = chat && (isChatChannel(chat) || message.senderId === message.chatId);

      body = renderActionMessageText(
        getTranslation,
        message,
        !isChat ? messageSender : undefined,
        isChat ? chat : undefined,
        actionTargetUsers,
        actionTargetMessage,
        actionTargetChatId,
        { asPlainText: true },
      ) as string;
    } else {
      const senderName = getMessageSenderName(getTranslation, chat.id, messageSender);
      const summary = getMessageSummaryText(getTranslation, message, false, 60, false);

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
  let mediaData = mediaLoader.getFromMemory(imageHash);
  if (!mediaData) {
    await mediaLoader.fetch(imageHash, ApiMediaFormat.BlobUrl);
    mediaData = mediaLoader.getFromMemory(imageHash);
  }
  return mediaData;
}

export async function notifyAboutMessage({
  chat,
  message,
  isReaction = false,
}: { chat: ApiChat; message: Partial<ApiMessage>; isReaction?: boolean }) {
  const { hasWebNotifications } = await loadNotificationSettings();
  if (!checkIfShouldNotify(chat)) return;
  const areNotificationsSupported = checkIfNotificationsSupported();
  if (!hasWebNotifications || !areNotificationsSupported) {
    // Do not play notification sound for reactions if web notifications are disabled
    if (isReaction) return;
    // Only play sound if web notifications are disabled
    playNotifySoundDebounced(String(message.id) || chat.id);
    return;
  }
  if (!areNotificationsSupported) return;

  if (!message.id) return;

  const activeReaction = getMessageRecentReaction(message);
  const icon = await getAvatar(chat);

  const {
    title,
    body,
  } = getNotificationContent(chat, message as ApiMessage, activeReaction);

  if (checkIfPushSupported()) {
    if (navigator.serviceWorker?.controller) {
      // notify service worker about new message notification
      navigator.serviceWorker.controller.postMessage({
        type: 'showMessageNotification',
        payload: {
          title,
          body,
          icon,
          chatId: chat.id,
          messageId: message.id,
          reaction: activeReaction?.reaction,
        },
      });
    }
  } else {
    const dispatch = getActions();
    const options: NotificationOptions = {
      body,
      icon,
      badge: icon,
      tag: String(message.id),
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
      if (activeReaction) {
        dispatch.startActiveReaction({
          messageId: message.id,
          reaction: activeReaction.reaction,
        });
      }
      if (window.focus) {
        window.focus();
      }
    };

    // Play sound when notification is displayed
    notification.onshow = () => {
      // TODO Remove when reaction badges are implemented
      if (isReaction) return;
      playNotifySoundDebounced(String(message.id) || chat.id);
    };
  }
}

export function closeMessageNotifications(payload: { chatId: string; lastReadInboxMessageId?: number }) {
  if (IS_TEST || !navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage({
    type: 'closeMessageNotifications',
    payload,
  });
}

// Notify service worker that client is fully loaded
export function notifyClientReady() {
  if (!navigator.serviceWorker?.controller) return;
  navigator.serviceWorker.controller.postMessage({
    type: 'clientReady',
  });
}

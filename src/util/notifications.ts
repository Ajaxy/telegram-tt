import { getActions, getGlobal, setGlobal } from '../global';

import type {
  ApiChat, ApiMessage, ApiPeer, ApiPeerReaction,
  ApiPhoneCall, ApiUser,
} from '../api/types';
import { ApiMediaFormat } from '../api/types';

import { APP_NAME, DEBUG, IS_TEST } from '../config';
import {
  getChatAvatarHash,
  getChatTitle,
  getMessageAction,
  getMessageRecentReaction,
  getMessageSenderName,
  getMessageSummaryText,
  getPrivateChatUserId,
  getUserFullName,
  isActionMessage,
  isChatChannel,
  selectIsChatMuted,
  selectShouldShowMessagePreview,
} from '../global/helpers';
import { addNotifyExceptions, replaceSettings } from '../global/reducers';
import {
  selectChat,
  selectChatMessage,
  selectCurrentMessageList,
  selectNotifyExceptions,
  selectNotifySettings,
  selectTopicFromMessage,
  selectUser,
} from '../global/selectors';
import { callApi } from '../api/gramjs';
import { renderActionMessageText } from '../components/common/helpers/renderActionMessageText';
import { buildCollectionByKey } from './iteratees';
import { translate } from './langProvider';
import * as mediaLoader from './mediaLoader';
import { debounce } from './schedulers';
import { IS_ELECTRON, IS_SERVICE_WORKER_SUPPORTED, IS_TOUCH_ENV } from './windowEnvironment';

function getDeviceToken(subscription: PushSubscription) {
  const data = subscription.toJSON();
  return JSON.stringify({
    endpoint: data.endpoint,
    keys: data.keys,
  });
}

function checkIfPushSupported() {
  if (!IS_SERVICE_WORKER_SUPPORTED || IS_ELECTRON) return false;

  if (!('showNotification' in ServiceWorkerRegistration.prototype)) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[PUSH] Push notifications aren\'t supported.');
    }
    return false;
  }

  // If permission is denied, it is blocked until the user manually changes their settings
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

export function checkIfNotificationsSupported() {
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
const notificationSound = new Audio('./notification.mp3');
notificationSound.setAttribute('mozaudiochannel', 'notification');

export async function playNotifySound(id?: string, volume?: number) {
  if (id !== undefined && soundPlayedIds.has(id)) return;
  const { notificationSoundVolume } = selectNotifySettings(getGlobal());
  const currentVolume = volume ? volume / 10 : notificationSoundVolume / 10;
  if (currentVolume === 0) return;
  notificationSound.volume = currentVolume;
  if (id !== undefined) {
    notificationSound.addEventListener('ended', () => {
      soundPlayedIds.add(id);
    }, { once: true });

    setTimeout(() => {
      soundPlayedIds.delete(id);
    }, soundPlayedDelay);
  }

  try {
    await notificationSound.play();
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

export async function requestPermission() {
  if (!('Notification' in window)) {
    return false;
  }
  let permission = Notification.permission;
  if (!['granted', 'denied'].includes(permission)) {
    permission = await Notification.requestPermission();
  }
  return permission === 'granted';
}

async function unsubscribeFromPush(subscription: PushSubscription | null) {
  const global = getGlobal();
  const { deleteDeviceToken } = getActions();
  if (subscription) {
    try {
      const deviceToken = getDeviceToken(subscription);
      await callApi('unregisterDevice', deviceToken);
      await subscription.unsubscribe();
      deleteDeviceToken();
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
    deleteDeviceToken();
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
    callApi('fetchNotificationSettings'),
    callApi('fetchNotificationExceptions'),
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

// Load custom emoji from the api if it's not cached already
async function loadCustomEmoji(id: string) {
  let global = getGlobal();
  if (global.customEmojis.byId[id]) return;
  const customEmoji = await callApi('fetchCustomEmoji', {
    documentId: [id],
  });
  if (!customEmoji) return;
  global = getGlobal();
  global = {
    ...global,
    customEmojis: {
      ...global.customEmojis,
      byId: {
        ...global.customEmojis.byId,
        ...buildCollectionByKey(customEmoji, 'id'),
      },
    },
  };
  setGlobal(global);
}

let isSubscriptionFailed = false;
export function checkIfOfflinePushFailed() {
  return isSubscriptionFailed;
}

export async function subscribe() {
  const { setDeviceToken, updateWebNotificationSettings } = getActions();
  let hasWebNotifications = false;
  let hasPushNotifications = false;
  if (!checkIfPushSupported()) {
    // Ask for notification permissions only if service worker notifications are not supported
    // As pushManager.subscribe automatically triggers permission popup
    hasWebNotifications = await requestPermission();
    updateWebNotificationSettings({
      hasWebNotifications,
      hasPushNotifications,
    });
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
    setDeviceToken(deviceToken);
    hasPushNotifications = true;
    hasWebNotifications = true;
  } catch (error: any) {
    if (Notification.permission === 'denied') {
      // The user denied the notification permission which
      // means we failed to subscribe and the user will need
      // to manually change the notification permission to
      // subscribe to push messages
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.warn('[PUSH] The user has blocked push notifications.');
      }
    } else {
      // A problem occurred with the subscription, this can
      // often be down to an issue or lack of the gcm_sender_id
      // and / or gcm_user_visible_only
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log('[PUSH] Unable to subscribe to push.', error);
      }
      // Request permissions and fall back to local notifications
      // if pushManager.subscribe was aborted due to invalid VAPID key.
      if ([DOMException.ABORT_ERR, DOMException.NOT_SUPPORTED_ERR].includes(error.code)) {
        isSubscriptionFailed = true;
        hasWebNotifications = await requestPermission();
      }
    }
  }
  updateWebNotificationSettings({
    hasWebNotifications,
    hasPushNotifications,
  });
}

function checkIfShouldNotify(chat: ApiChat, message: Partial<ApiMessage>) {
  if (!areSettingsLoaded) return false;
  const global = getGlobal();
  const isMuted = selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global));
  if ((isMuted && !message.isMentioned) || chat.isNotJoined || !chat.isListed) {
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

function getNotificationContent(chat: ApiChat, message: ApiMessage, reaction?: ApiPeerReaction) {
  const global = getGlobal();
  const {
    replyToMessageId,
  } = message;
  let {
    senderId,
  } = message;
  const hasReaction = Boolean(reaction);
  if (hasReaction) senderId = reaction.peerId;

  const { isScreenLocked } = global.passcode;
  const messageSenderChat = senderId ? selectChat(global, senderId) : undefined;
  const messageSenderUser = senderId ? selectUser(global, senderId) : undefined;
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
      .filter(Boolean)
    : undefined;
  const privateChatUserId = getPrivateChatUserId(chat);
  const isSelf = privateChatUserId === global.currentUserId;

  const topic = selectTopicFromMessage(global, message);

  let body: string;
  if (
    !isScreenLocked
    && selectShouldShowMessagePreview(chat, selectNotifySettings(global), selectNotifyExceptions(global))
  ) {
    const isChat = chat && (isChatChannel(chat) || message.senderId === message.chatId);

    if (isActionMessage(message)) {
      body = renderActionMessageText(
        translate,
        message,
        !isChat ? messageSenderUser : undefined,
        isChat ? chat : undefined,
        actionTargetUsers,
        actionTargetMessage,
        actionTargetChatId,
        topic,
        { asPlainText: true },
      ) as string;
    } else {
      // TODO[forums] Support ApiChat
      const senderName = getMessageSenderName(translate, chat.id, isChat ? messageSenderChat : messageSenderUser);
      let summary = getMessageSummaryText(translate, message, hasReaction, 60);

      if (hasReaction) {
        const emoji = getReactionEmoji(reaction);
        summary = translate('PushReactText', [emoji, summary]);
      }

      body = senderName ? `${senderName}: ${summary}` : summary;
    }
  } else {
    body = 'New message';
  }

  let title = isScreenLocked ? APP_NAME : getChatTitle(translate, chat, isSelf);

  if (message.isSilent) {
    title += ' 🔕';
  }

  return { title, body };
}

async function getAvatar(chat: ApiPeer) {
  const imageHash = getChatAvatarHash(chat);
  if (!imageHash) return undefined;
  let mediaData = mediaLoader.getFromMemory(imageHash);
  if (!mediaData) {
    await mediaLoader.fetch(imageHash, ApiMediaFormat.BlobUrl);
    mediaData = mediaLoader.getFromMemory(imageHash);
  }
  return mediaData;
}

function getReactionEmoji(reaction: ApiPeerReaction) {
  let emoji;
  if ('emoticon' in reaction.reaction) {
    emoji = reaction.reaction.emoticon;
  }
  if ('documentId' in reaction.reaction) {
    // eslint-disable-next-line eslint-multitab-tt/no-immediate-global
    emoji = getGlobal().customEmojis.byId[reaction.reaction.documentId]?.emoji;
  }
  return emoji || '❤️';
}

export async function notifyAboutCall({
  call, user,
}: {
  call: ApiPhoneCall; user: ApiUser;
}) {
  const { hasWebNotifications } = await loadNotificationSettings();
  if (document.hasFocus() || !hasWebNotifications) return;
  const areNotificationsSupported = checkIfNotificationsSupported();
  if (!areNotificationsSupported) return;

  const icon = await getAvatar(user);

  const options: NotificationOptions = {
    body: getUserFullName(user),
    icon,
    badge: icon,
    tag: `call_${call.id}`,
  };

  if ('vibrate' in navigator) {
    options.vibrate = [200, 100, 200];
  }

  const notification = new Notification(translate('VoipIncoming'), options);

  notification.onclick = () => {
    notification.close();
    if (window.focus) {
      window.focus();
    }
  };
}

export async function notifyAboutMessage({
  chat,
  message,
  isReaction = false,
}: { chat: ApiChat; message: Partial<ApiMessage>; isReaction?: boolean }) {
  const { hasWebNotifications } = await loadNotificationSettings();
  if (!checkIfShouldNotify(chat, message)) return;
  const areNotificationsSupported = checkIfNotificationsSupported();
  if (!hasWebNotifications || !areNotificationsSupported) {
    if (!message.isSilent && !isReaction && !IS_ELECTRON) {
      // Only play sound if web notifications are disabled
      playNotifySoundDebounced(String(message.id) || chat.id);
    }

    return;
  }
  if (!areNotificationsSupported) return;

  if (!message.id) return;

  const activeReaction = getMessageRecentReaction(message);
  // Do not notify about reactions on messages that are not outgoing
  if (isReaction && !activeReaction) return;

  // If this is a custom emoji reaction we need to make sure it is loaded
  if (isReaction && activeReaction && 'documentId' in activeReaction.reaction) {
    await loadCustomEmoji(activeReaction.reaction.documentId);
  }

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
          shouldReplaceHistory: true,
          isSilent: message.isSilent,
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
        messageId: message.id!,
        shouldReplaceHistory: true,
      });
      if (window.focus) {
        window.focus();
      }
    };

    // Play sound when notification is displayed
    notification.onshow = () => {
      // TODO Update when reaction badges are implemented
      if (isReaction || message.isSilent || IS_ELECTRON) return;
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

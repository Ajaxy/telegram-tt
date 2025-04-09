import type {
  ApiChat,
  ApiNotifyPeerType,
  ApiPeer,
  ApiPeerNotifySettings,
} from '../../api/types';

import { omitUndefined } from '../../util/iteratees';
import { getServerTime } from '../../util/serverTime';
import { isChatChannel, isUserId } from './chats';

export function getIsChatMuted(
  chat: ApiChat,
  notifyDefaults?: Record<ApiNotifyPeerType, ApiPeerNotifySettings>,
  notifyException?: ApiPeerNotifySettings,
) {
  const settings = getChatNotifySettings(chat, notifyDefaults, notifyException);
  if (!settings?.mutedUntil) return false;
  return getServerTime() < settings.mutedUntil;
}

export function getIsChatSilent(
  chat: ApiChat,
  notifyDefaults?: Record<ApiNotifyPeerType, ApiPeerNotifySettings>,
  notifyException?: ApiPeerNotifySettings,
) {
  const settings = getChatNotifySettings(chat, notifyDefaults, notifyException);
  if (!settings) return false;
  return !settings.hasSound;
}

export function getShouldShowMessagePreview(
  chat: ApiChat,
  notifyDefaults?: Record<ApiNotifyPeerType, ApiPeerNotifySettings>,
  notifyException?: ApiPeerNotifySettings,
) {
  const settings = getChatNotifySettings(chat, notifyDefaults, notifyException);
  return Boolean(settings?.shouldShowPreviews);
}

export function getChatNotifySettings(
  chat: ApiChat,
  notifyDefaults?: Record<ApiNotifyPeerType, ApiPeerNotifySettings>,
  notifyException?: ApiPeerNotifySettings,
): ApiPeerNotifySettings | undefined {
  const defaults = notifyDefaults?.[getNotificationPeerType(chat)];

  if (!notifyException && !defaults) {
    return undefined;
  }

  return {
    ...defaults,
    ...(notifyException && omitUndefined(notifyException)),
  };
}

export function getNotificationPeerType(peer: ApiPeer): ApiNotifyPeerType {
  if (isUserId(peer.id)) {
    return 'users';
  }

  const chat = peer as ApiChat;
  return isChatChannel(chat) ? 'channels' : 'groups';
}

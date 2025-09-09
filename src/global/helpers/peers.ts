import type { ApiChat, ApiPeer, ApiUser } from '../../api/types';
import type { OldLangFn } from '../../hooks/useOldLang';
import type { CustomPeer } from '../../types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../config';
import { isUserId } from '../../util/entities/ids';
import { getTranslationFn, type LangFn } from '../../util/localization';
import { prepareSearchWordsForNeedle } from '../../util/searchWords';
import { selectChat, selectPeer, selectUser } from '../selectors';
import { getGlobal } from '..';
import { getChatTitle } from './chats';
import { getUserFirstOrLastName, getUserFullName } from './users';

export function isApiPeerChat(peer: ApiPeer): peer is ApiChat {
  return 'title' in peer;
}

export function isApiPeerUser(peer: ApiPeer): peer is ApiUser {
  return !isApiPeerChat(peer);
}

export function filterPeersByQuery({
  ids,
  query,
  type = 'peer',
}: {
  ids: string[];
  query: string | undefined;
  type?: 'chat' | 'user' | 'peer';
}) {
  if (!query) {
    return ids;
  }
  const global = getGlobal();
  const lang = getTranslationFn();

  const searchWords = prepareSearchWordsForNeedle(query);

  const selectorFn = type === 'chat' ? selectChat : type === 'user' ? selectUser : selectPeer;

  return ids.filter((id) => {
    const peer = selectorFn(global, id);
    if (!peer) {
      return false;
    }

    const localizedTitle = isApiPeerChat(peer)
      ? getChatTitle(lang, peer)
      : id === global.currentUserId ? lang('SavedMessages') : undefined;
    const isFoundInLocalized = localizedTitle ? searchWords(localizedTitle) : undefined;

    const name = getPeerFullTitle(lang, peer);

    return isFoundInLocalized
      || (name && searchWords(name))
      || Boolean(peer.usernames?.find(({ username }) => searchWords(username)));
  });
}

export function getPeerTypeKey(peer: ApiPeer) {
  if (isApiPeerChat(peer)) {
    if (peer.type === 'chatTypeBasicGroup' || peer.type === 'chatTypeSuperGroup') {
      return 'ChatList.PeerTypeGroup';
    }

    if (peer.type === 'chatTypeChannel') {
      return 'ChatList.PeerTypeChannel';
    }

    if (peer.type === 'chatTypePrivate') {
      return 'ChatList.PeerTypeNonContact';
    }

    return undefined;
  }

  if (peer.id === SERVICE_NOTIFICATIONS_USER_ID) {
    return 'ServiceNotifications';
  }

  if (peer.isSupport) {
    return 'SupportStatus';
  }

  if (peer.type && peer.type === 'userTypeBot') {
    return 'ChatList.PeerTypeBot';
  }

  if (peer.isContact) {
    return 'ChatList.PeerTypeContact';
  }

  return 'ChatList.PeerTypeNonContactUser';
}

export function getPeerTitle(lang: OldLangFn | LangFn, peer: ApiPeer | CustomPeer) {
  if (!peer) return undefined;
  if ('isCustomPeer' in peer) {
    // TODO: Remove any after full migration to new lang
    return peer.titleKey ? lang(peer.titleKey as any) : peer.title;
  }
  return isApiPeerUser(peer) ? getUserFirstOrLastName(peer) : getChatTitle(lang, peer);
}

export function getPeerFullTitle(lang: OldLangFn | LangFn, peer: ApiPeer | CustomPeer) {
  if (!peer) return undefined;
  if ('isCustomPeer' in peer) {
    // TODO: Remove any after full migration to new lang
    return peer.titleKey ? lang(peer.titleKey as any) : peer.title;
  }
  return isApiPeerUser(peer) ? getUserFullName(peer) : getChatTitle(lang, peer);
}

export function getMessageSenderName(lang: LangFn, chatId: string, sender: ApiPeer) {
  // Hide sender name for private chats
  if (isUserId(chatId)) return undefined;

  if (isApiPeerChat(sender)) {
    if (chatId === sender.id) return undefined;

    return sender.title;
  }

  if (sender.isSelf) {
    return lang('FromYou');
  }

  return getPeerTitle(lang, sender);
}

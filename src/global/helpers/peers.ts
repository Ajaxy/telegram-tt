import type { ApiChat, ApiPeer, ApiUser } from '../../api/types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../config';

export function isApiPeerChat(peer: ApiPeer): peer is ApiChat {
  return 'title' in peer;
}

export function isApiPeerUser(peer: ApiPeer): peer is ApiUser {
  return !isApiPeerChat(peer);
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

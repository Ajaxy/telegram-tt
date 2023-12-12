import type BigInt from 'big-integer';

import type { Api as GramJs } from '../../../lib/gramjs';
import type { ApiPeerColor } from '../../types';

export function isPeerUser(peer: GramJs.TypePeer | GramJs.TypeInputPeer): peer is GramJs.PeerUser {
  return peer.hasOwnProperty('userId');
}

export function isPeerChat(peer: GramJs.TypePeer | GramJs.TypeInputPeer): peer is GramJs.PeerChat {
  return peer.hasOwnProperty('chatId');
}

export function isPeerChannel(peer: GramJs.TypePeer | GramJs.TypeInputPeer): peer is GramJs.PeerChannel {
  return peer.hasOwnProperty('channelId');
}

export function buildApiPeerId(id: BigInt.BigInteger, type: 'user' | 'chat' | 'channel') {
  if (type === 'user') {
    return id.toString();
  }

  if (type === 'channel') {
    return `-100${id}`;
  }

  return `-${id}`;
}

export function getApiChatIdFromMtpPeer(peer: GramJs.TypePeer | GramJs.TypeInputPeer) {
  if (isPeerUser(peer)) {
    return buildApiPeerId(peer.userId, 'user');
  } else if (isPeerChat(peer)) {
    return buildApiPeerId(peer.chatId, 'chat');
  } else {
    return buildApiPeerId((peer as GramJs.InputPeerChannel).channelId, 'channel');
  }
}

export function buildApiPeerColor(peerColor: GramJs.TypePeerColor): ApiPeerColor {
  const { color, backgroundEmojiId } = peerColor;
  return {
    color,
    backgroundEmojiId: backgroundEmojiId?.toString(),
  };
}

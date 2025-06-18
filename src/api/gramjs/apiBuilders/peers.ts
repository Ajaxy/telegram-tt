import type BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type { ApiEmojiStatusType, ApiPeerColor } from '../../types';

import { CHANNEL_ID_BASE } from '../../../config';
import { numberToHexColor } from '../../../util/colors';

type TypePeerOrInput = GramJs.TypePeer | GramJs.TypeInputPeer | GramJs.TypeInputUser | GramJs.TypeInputChannel;

export function isMtpPeerUser(peer: TypePeerOrInput): peer is GramJs.PeerUser {
  return peer.hasOwnProperty('userId');
}

export function isMtpPeerChat(peer: TypePeerOrInput): peer is GramJs.PeerChat {
  return peer.hasOwnProperty('chatId');
}

export function isMtpPeerChannel(peer: TypePeerOrInput): peer is GramJs.PeerChannel {
  return peer.hasOwnProperty('channelId');
}

export function buildApiPeerId(id: BigInt.BigInteger, type: 'user' | 'chat' | 'channel') {
  if (type === 'user') {
    return id.toString();
  }

  if (type === 'channel') {
    return id.add(CHANNEL_ID_BASE).negate().toString();
  }

  return id.negate().toString();
}

export function getApiChatIdFromMtpPeer(peer: TypePeerOrInput) {
  if (isMtpPeerUser(peer)) {
    return buildApiPeerId(peer.userId, 'user');
  } else if (isMtpPeerChat(peer)) {
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

export function buildApiEmojiStatus(mtpEmojiStatus: GramJs.TypeEmojiStatus):
ApiEmojiStatusType | undefined {
  if (mtpEmojiStatus instanceof GramJs.EmojiStatus) {
    return {
      type: 'regular',
      documentId: mtpEmojiStatus.documentId.toString(),
      until: mtpEmojiStatus.until,
    };
  }

  if (mtpEmojiStatus instanceof GramJs.EmojiStatusCollectible) {
    return {
      type: 'collectible',
      collectibleId: mtpEmojiStatus.collectibleId.toString(),
      documentId: mtpEmojiStatus.documentId.toString(),
      title: mtpEmojiStatus.title,
      slug: mtpEmojiStatus.slug,
      patternDocumentId: mtpEmojiStatus.patternDocumentId.toString(),
      centerColor: numberToHexColor(mtpEmojiStatus.centerColor),
      edgeColor: numberToHexColor(mtpEmojiStatus.edgeColor),
      patternColor: numberToHexColor(mtpEmojiStatus.patternColor),
      textColor: numberToHexColor(mtpEmojiStatus.textColor),
      until: mtpEmojiStatus.until,
    };
  }

  return undefined;
}

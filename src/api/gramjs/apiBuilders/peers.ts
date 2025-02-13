import type BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type { ApiEmojiStatusType, ApiPeerColor } from '../../types';

import { CHANNEL_ID_LENGTH } from '../../../config';
import { numberToHexColor } from '../../../util/colors';

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
    // Simulates TDLib https://github.com/tdlib/td/blob/d7203eb719304866a7eb7033ef03d421459335b8/td/telegram/DialogId.cpp#L54
    // But using only string operations. Should be fine until channel ids reach 10^12
    // Example: 12345678 -> -1000012345678
    return `-1${id.toString().padStart(CHANNEL_ID_LENGTH - 2, '0')}`;
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

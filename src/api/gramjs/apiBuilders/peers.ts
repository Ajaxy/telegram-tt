import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiBotVerification,
  ApiEmojiStatusType,
  ApiPeerColors,
  ApiPeerNotifySettings,
  ApiPeerProfileColorSet,
  ApiProfileTab,
  ApiTypePeerColor,
} from '../../types';

import { CHANNEL_ID_BASE } from '../../../config';
import { int2hex } from '../../../util/colors';
import { buildCollectionByCallback } from '../../../util/iteratees';

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

export function buildApiPeerId(id: bigint, type: 'user' | 'chat' | 'channel') {
  if (type === 'user') {
    return id.toString();
  }

  if (type === 'channel') {
    return ((id + CHANNEL_ID_BASE) * -1n).toString();
  }

  return (id * -1n).toString();
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

export function buildApiPeerColor(peerColor: GramJs.TypePeerColor): ApiTypePeerColor | undefined {
  if (peerColor instanceof GramJs.PeerColor) {
    const { color, backgroundEmojiId } = peerColor;
    return {
      type: 'regular',
      color,
      backgroundEmojiId: backgroundEmojiId?.toString(),
    };
  }

  if (peerColor instanceof GramJs.PeerColorCollectible) {
    const {
      collectibleId, giftEmojiId, backgroundEmojiId, accentColor, colors, darkAccentColor, darkColors,
    } = peerColor;
    return {
      type: 'collectible',
      giftEmojiId: giftEmojiId.toString(),
      collectibleId: collectibleId.toString(),
      backgroundEmojiId: backgroundEmojiId.toString(),
      accentColor: int2hex(accentColor),
      colors: colors.map((color) => int2hex(color)),
      darkAccentColor: darkAccentColor ? int2hex(darkAccentColor) : undefined,
      darkColors: darkColors?.map((color) => int2hex(color)),
    };
  }

  return undefined;
}

function buildApiPeerColorSet(colorSet: GramJs.help.PeerColorSet) {
  return colorSet.colors.map((color) => int2hex(color));
}

function buildApiPeerProfileColorSet(colorSet: GramJs.help.PeerColorProfileSet): ApiPeerProfileColorSet {
  return {
    paletteColors: colorSet.paletteColors.map((color) => int2hex(color)),
    bgColors: colorSet.bgColors.map((color) => int2hex(color)),
    storyColors: colorSet.storyColors.map((color) => int2hex(color)),
  };
}

export function buildApiPeerColors(wrapper: GramJs.help.TypePeerColors): ApiPeerColors['general'] | undefined {
  if (!(wrapper instanceof GramJs.help.PeerColors)) return undefined;

  return buildCollectionByCallback(wrapper.colors, (color) => {
    return [color.colorId, {
      isHidden: color.hidden,
      colors: color.colors instanceof GramJs.help.PeerColorSet
        ? buildApiPeerColorSet(color.colors) : undefined,
      darkColors: color.darkColors instanceof GramJs.help.PeerColorSet
        ? buildApiPeerColorSet(color.darkColors) : undefined,
    }];
  });
}

export function buildApiPeerProfileColors(wrapper: GramJs.help.TypePeerColors): ApiPeerColors['profile'] | undefined {
  if (!(wrapper instanceof GramJs.help.PeerColors)) return undefined;

  return buildCollectionByCallback(wrapper.colors, (color) => {
    return [color.colorId, {
      isHidden: color.hidden,
      colors: color.colors instanceof GramJs.help.PeerColorProfileSet
        ? buildApiPeerProfileColorSet(color.colors) : undefined,
      darkColors: color.darkColors instanceof GramJs.help.PeerColorProfileSet
        ? buildApiPeerProfileColorSet(color.darkColors) : undefined,
    }];
  });
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
      centerColor: int2hex(mtpEmojiStatus.centerColor),
      edgeColor: int2hex(mtpEmojiStatus.edgeColor),
      patternColor: int2hex(mtpEmojiStatus.patternColor),
      textColor: int2hex(mtpEmojiStatus.textColor),
      until: mtpEmojiStatus.until,
    };
  }

  return undefined;
}

export function buildAvatarPhotoId(photo: GramJs.TypeUserProfilePhoto | GramJs.TypeChatPhoto) {
  if ('photoId' in photo) {
    return photo.photoId.toString();
  }

  return undefined;
}

export function buildApiBotVerification(botVerification: GramJs.BotVerification): ApiBotVerification {
  return {
    botId: buildApiPeerId(botVerification.botId, 'user'),
    iconId: botVerification.icon.toString(),
    description: botVerification.description,
  };
}

export function buildApiPeerNotifySettings(
  notifySettings: GramJs.TypePeerNotifySettings,
): ApiPeerNotifySettings {
  const {
    silent, muteUntil, showPreviews, otherSound,
  } = notifySettings;

  const hasSound = !(otherSound instanceof GramJs.NotificationSoundNone);

  return {
    hasSound,
    isSilentPosting: silent,
    mutedUntil: muteUntil,
    shouldShowPreviews: showPreviews,
  };
}

export function buildApiProfileTab(profileTab: GramJs.TypeProfileTab): ApiProfileTab {
  switch (profileTab.className) {
    case 'ProfileTabPosts':
      return 'stories';
    case 'ProfileTabGifts':
      return 'gifts';
    case 'ProfileTabMedia':
      return 'media';
    case 'ProfileTabFiles':
      return 'documents';
    case 'ProfileTabMusic':
      return 'audio';
    case 'ProfileTabVoice':
      return 'voice';
    case 'ProfileTabLinks':
      return 'links';
    case 'ProfileTabGifs':
      return 'gif';
    default: {
      const _exhaustiveCheck: never = profileTab;
      return _exhaustiveCheck;
    }
  }
}

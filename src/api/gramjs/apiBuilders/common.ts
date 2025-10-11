import { Api as GramJs } from '../../../lib/gramjs';
import type { Entity } from '../../../lib/gramjs/types';
import { strippedPhotoToJpg } from '../../../lib/gramjs/Utils';

import type {
  ApiFormattedText,
  ApiMessageEntity,
  ApiMessageEntityDefault,
  ApiPhoto,
  ApiPhotoSize,
  ApiPrivacySettings,
  ApiThumbnail,
  ApiUsername,
  ApiVideoSize,
  BotsPrivacyType,
  PrivacyVisibility,
} from '../../types';
import {
  ApiMessageEntityTypes,
} from '../../types';

import { compact } from '../../../util/iteratees';
import localDb from '../localDb';
import { bytesToDataUri } from './helpers';
import { pathBytesToSvg } from './pathBytesToSvg';
import { buildApiPeerId } from './peers';

const DEFAULT_THUMB_SIZE = { w: 100, h: 100 };

export function buildApiThumbnailFromStripped(
  sizes?: GramJs.TypePhotoSize[], mimeType?: string,
): ApiThumbnail | undefined {
  if (!sizes || !sizes.length) {
    return undefined;
  }

  const thumb = sizes.find((s: any): s is GramJs.PhotoStrippedSize => s instanceof GramJs.PhotoStrippedSize);
  if (!thumb) {
    return undefined;
  }

  const realSizes = sizes.filter((s): s is GramJs.PhotoSize => s instanceof GramJs.PhotoSize);
  const { w, h } = realSizes.length ? realSizes[realSizes.length - 1] : DEFAULT_THUMB_SIZE;
  const { bytes } = thumb;
  const dataUri = bytesToDataUri(
    !mimeType || mimeType === 'image/jpeg' ? strippedPhotoToJpg(bytes) : bytes,
    undefined,
    mimeType,
  );

  return {
    dataUri,
    width: w,
    height: h,
  };
}

export function buildApiThumbnailFromCached(photoSize: GramJs.PhotoCachedSize): ApiThumbnail | undefined {
  const { w, h, bytes } = photoSize;
  const dataUri = bytesToDataUri(bytes, undefined, 'image/webp');

  return {
    dataUri,
    width: w,
    height: h,
  };
}

export function buildApiThumbnailFromPath(
  photoSize: GramJs.PhotoPathSize,
  sizeAttribute: GramJs.DocumentAttributeImageSize | GramJs.DocumentAttributeVideo | GramJs.PhotoSize,
): ApiThumbnail | undefined {
  const { w, h } = sizeAttribute;
  const dataUri = `data:image/svg+xml;utf8,${pathBytesToSvg(photoSize.bytes, w, h)}`;

  return {
    dataUri,
    width: w,
    height: h,
  };
}

export function buildApiPhoto(photo: GramJs.Photo, isSpoiler?: boolean): ApiPhoto {
  const sizes = photo.sizes
    .filter((s: any): s is GramJs.PhotoSize => {
      return s instanceof GramJs.PhotoSize || s instanceof GramJs.PhotoSizeProgressive;
    })
    .map(buildApiPhotoSize);

  return {
    mediaType: 'photo',
    id: String(photo.id),
    thumbnail: buildApiThumbnailFromStripped(photo.sizes),
    sizes,
    isSpoiler,
    date: photo.date,
    ...(photo.videoSizes && { videoSizes: compact(photo.videoSizes.map(buildApiVideoSize)), isVideo: true }),
  };
}

export function buildApiPhotoPreviewSizes(sizes: GramJs.TypePhotoSize[]): ApiPhotoSize[] {
  return sizes.filter((s): s is GramJs.PhotoSize => (
    s instanceof GramJs.PhotoSize || s instanceof GramJs.PhotoSizeProgressive
  )).map(buildApiPhotoSize);
}

export function buildApiVideoSize(videoSize: GramJs.TypeVideoSize): ApiVideoSize | undefined {
  if (!(videoSize instanceof GramJs.VideoSize)) return undefined;

  const {
    videoStartTs, size, h, w, type,
  } = videoSize;

  return {
    videoStartTs,
    size,
    height: h,
    width: w,
    type: type as ('u' | 'v'),
  };
}

export function buildApiPhotoSize(photoSize: GramJs.PhotoSize): ApiPhotoSize {
  const { w, h, type } = photoSize;

  return {
    width: w,
    height: h,
    type: type as ('s' | 'm' | 'x' | 'y' | 'w'),
  };
}

export function buildApiUsernames(mtpPeer: Entity | GramJs.UpdateUserName) {
  if (!('usernames' in mtpPeer && mtpPeer.usernames) && !('username' in mtpPeer && mtpPeer.username)) {
    return undefined;
  }

  const usernames: ApiUsername[] = [];

  if ('username' in mtpPeer && mtpPeer.username) {
    usernames.push({
      username: mtpPeer.username,
      isActive: true,
      isEditable: true,
    });
  }

  if (mtpPeer.usernames) {
    mtpPeer.usernames.forEach(({ username, active, editable }) => {
      usernames.push({
        username,
        ...(active && { isActive: true }),
        ...(editable && { isEditable: true }),
      });
    });
  }

  return usernames;
}

export function buildPrivacyRules(rules: GramJs.TypePrivacyRule[]): ApiPrivacySettings {
  let visibility: PrivacyVisibility | undefined;
  let isUnspecified: boolean | undefined;
  let allowUserIds: string[] | undefined;
  let allowChatIds: string[] | undefined;
  let blockUserIds: string[] | undefined;
  let blockChatIds: string[] | undefined;
  let shouldAllowPremium: true | undefined;
  let botsPrivacy: BotsPrivacyType = 'none';

  const localChats = localDb.chats;

  rules.forEach((rule) => {
    if (rule instanceof GramJs.PrivacyValueAllowAll) {
      visibility ||= 'everybody';
    } else if (rule instanceof GramJs.PrivacyValueAllowContacts) {
      visibility ||= 'contacts';
    } else if (rule instanceof GramJs.PrivacyValueAllowCloseFriends) {
      visibility ||= 'closeFriends';
    } else if (rule instanceof GramJs.PrivacyValueDisallowContacts) {
      visibility ||= 'nonContacts';
    } else if (rule instanceof GramJs.PrivacyValueDisallowAll) {
      visibility ||= 'nobody';
    } else if (rule instanceof GramJs.PrivacyValueAllowUsers) {
      allowUserIds = rule.users.map((chatId) => buildApiPeerId(chatId, 'user'));
    } else if (rule instanceof GramJs.PrivacyValueDisallowUsers) {
      blockUserIds = rule.users.map((chatId) => buildApiPeerId(chatId, 'user'));
    } else if (rule instanceof GramJs.PrivacyValueAllowChatParticipants) {
      // Server allows channel ids here, so we need to check
      allowChatIds = rule.chats.map((chatId) => {
        const dialogId = buildApiPeerId(chatId, 'chat');
        const channelId = buildApiPeerId(chatId, 'channel');
        if (localChats[dialogId]) return dialogId;
        return channelId;
      });
    } else if (rule instanceof GramJs.PrivacyValueDisallowChatParticipants) {
      blockChatIds = rule.chats.map((chatId) => {
        const dialogId = buildApiPeerId(chatId, 'chat');
        const channelId = buildApiPeerId(chatId, 'channel');
        if (localChats[dialogId]) return dialogId;
        return channelId;
      });
    } else if (rule instanceof GramJs.PrivacyValueAllowPremium) {
      shouldAllowPremium = true;
    } else if (rule instanceof GramJs.PrivacyValueAllowBots) {
      botsPrivacy = 'allow';
    } else if (rule instanceof GramJs.PrivacyValueDisallowBots) {
      botsPrivacy = 'disallow';
    }
  });

  if (!visibility) {
    // Disallow by default
    visibility = 'nobody';
    isUnspecified = true;
  }

  return {
    visibility,
    isUnspecified,
    allowUserIds: allowUserIds || [],
    allowChatIds: allowChatIds || [],
    blockUserIds: blockUserIds || [],
    blockChatIds: blockChatIds || [],
    shouldAllowPremium,
    botsPrivacy,
  };
}

export function buildApiFormattedText(textWithEntities: GramJs.TextWithEntities): ApiFormattedText {
  const { text, entities } = textWithEntities;

  return {
    text,
    entities: entities.map(buildApiMessageEntity),
  };
}

export function buildApiMessageEntity(entity: GramJs.TypeMessageEntity): ApiMessageEntity {
  const {
    className: type, offset, length,
  } = entity;

  if (entity instanceof GramJs.MessageEntityMentionName) {
    return {
      type: ApiMessageEntityTypes.MentionName,
      offset,
      length,
      userId: buildApiPeerId(entity.userId, 'user'),
    };
  }

  if (entity instanceof GramJs.MessageEntityTextUrl) {
    return {
      type: ApiMessageEntityTypes.TextUrl,
      offset,
      length,
      url: entity.url,
    };
  }

  if (entity instanceof GramJs.MessageEntityPre) {
    return {
      type: ApiMessageEntityTypes.Pre,
      offset,
      length,
      language: entity.language,
    };
  }

  if (entity instanceof GramJs.MessageEntityCustomEmoji) {
    return {
      type: ApiMessageEntityTypes.CustomEmoji,
      offset,
      length,
      documentId: entity.documentId.toString(),
    };
  }

  if (entity instanceof GramJs.MessageEntityBlockquote) {
    return {
      type: ApiMessageEntityTypes.Blockquote,
      canCollapse: entity.collapsed,
      offset,
      length,
    };
  }

  return {
    type: type as `${ApiMessageEntityDefault['type']}`,
    offset,
    length,
  };
}

import { Api as GramJs } from '../../../lib/gramjs';
import { strippedPhotoToJpg } from '../../../lib/gramjs/Utils';

import type {
  ApiPhoto, ApiPhotoSize, ApiThumbnail, ApiVideoSize, ApiUsername,
} from '../../types';
import { bytesToDataUri } from './helpers';
import { pathBytesToSvg } from './pathBytesToSvg';

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
  sizeAttribute: GramJs.DocumentAttributeImageSize | GramJs.DocumentAttributeVideo,
): ApiThumbnail | undefined {
  const { w, h } = sizeAttribute;
  const dataUri = `data:image/svg+xml;utf8,${pathBytesToSvg(photoSize.bytes, w, h)}`;

  return {
    dataUri,
    width: w,
    height: h,
  };
}

export function buildApiPhoto(photo: GramJs.Photo): ApiPhoto {
  const sizes = photo.sizes
    .filter((s: any): s is GramJs.PhotoSize => {
      return s instanceof GramJs.PhotoSize || s instanceof GramJs.PhotoSizeProgressive;
    })
    .map(buildApiPhotoSize);

  return {
    id: String(photo.id),
    thumbnail: buildApiThumbnailFromStripped(photo.sizes),
    sizes,
    ...(photo.videoSizes && { videoSizes: photo.videoSizes.map(buildApiVideoSize), isVideo: true }),
  };
}

export function buildApiVideoSize(videoSize: GramJs.VideoSize): ApiVideoSize {
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
    type: type as ('m' | 'x' | 'y'),
  };
}

export function buildApiUsernames(mtpPeer: GramJs.User | GramJs.Channel | GramJs.UpdateUserName) {
  if (!mtpPeer.usernames && !('username' in mtpPeer && mtpPeer.username)) {
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

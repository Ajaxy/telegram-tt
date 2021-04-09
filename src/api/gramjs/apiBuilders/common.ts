import { Api as GramJs } from '../../../lib/gramjs';
import { strippedPhotoToJpg } from '../../../lib/gramjs/Utils';

import { ApiThumbnail } from '../../types';
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
  const { w, h } = realSizes && realSizes.length ? realSizes[realSizes.length - 1] : DEFAULT_THUMB_SIZE;
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
  sizeAttribute: GramJs.DocumentAttributeImageSize,
): ApiThumbnail | undefined {
  const { w, h } = sizeAttribute;
  const dataUri = `data:image/svg+xml;utf8,${pathBytesToSvg(photoSize.bytes, w, h)}`;

  return {
    dataUri,
    width: w,
    height: h,
  };
}

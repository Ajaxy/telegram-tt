import { Api as GramJs } from '../../../lib/gramjs';
import { ApiSticker, ApiStickerSet } from '../../types';
import { MEMOJI_STICKER_ID } from '../../../config';

import { buildApiThumbnailFromCached, buildApiThumbnailFromPath } from './common';
import localDb from '../localDb';

export function buildStickerFromDocument(document: GramJs.TypeDocument): ApiSticker | undefined {
  if (document instanceof GramJs.DocumentEmpty) {
    return undefined;
  }

  const stickerAttribute = document.attributes
    .find((attr: any): attr is GramJs.DocumentAttributeSticker => (
      attr instanceof GramJs.DocumentAttributeSticker
    ));

  if (!stickerAttribute) {
    return undefined;
  }

  const sizeAttribute = document.attributes
    .find((attr: any): attr is GramJs.DocumentAttributeImageSize => (
      attr instanceof GramJs.DocumentAttributeImageSize
    ));

  const stickerSetInfo = stickerAttribute.stickerset as GramJs.InputStickerSetID;
  const emoji = stickerAttribute.alt;
  const isAnimated = document.mimeType === 'application/x-tgsticker';
  const cachedThumb = document.thumbs && document.thumbs.find(
    (s): s is GramJs.PhotoCachedSize => s instanceof GramJs.PhotoCachedSize,
  );
  const pathThumb = document.thumbs && document.thumbs.find(
    (s): s is GramJs.PhotoPathSize => s instanceof GramJs.PhotoPathSize,
  );
  const thumbnail = cachedThumb ? (
    buildApiThumbnailFromCached(cachedThumb)
  ) : pathThumb && sizeAttribute ? (
    buildApiThumbnailFromPath(pathThumb, sizeAttribute)
  ) : undefined;

  const { w: width, h: height } = cachedThumb as GramJs.PhotoCachedSize || sizeAttribute || {};

  return {
    id: String(document.id),
    stickerSetId: stickerSetInfo.id ? String(stickerSetInfo.id) : MEMOJI_STICKER_ID,
    stickerSetAccessHash: String(stickerSetInfo.accessHash),
    emoji,
    isAnimated,
    width,
    height,
    thumbnail,
  };
}

export function buildStickerSet(set: GramJs.StickerSet): ApiStickerSet {
  const {
    archived,
    animated,
    installedDate,
    id,
    accessHash,
    title,
    thumbs,
    count,
    hash,
  } = set;

  return {
    archived,
    isAnimated: animated,
    installedDate,
    id: String(id),
    accessHash: String(accessHash),
    title,
    hasThumbnail: Boolean(thumbs && thumbs.length),
    count,
    hash,
  };
}

export function buildStickerSetCovered(coveredStickerSet: GramJs.TypeStickerSetCovered): ApiStickerSet {
  const stickerSet = buildStickerSet(coveredStickerSet.set);

  const stickerSetCovers = (coveredStickerSet instanceof GramJs.StickerSetMultiCovered)
    ? coveredStickerSet.covers
    : [coveredStickerSet.cover];

  stickerSet.covers = [];
  stickerSetCovers.forEach((cover) => {
    if (cover instanceof GramJs.Document) {
      const coverSticker = buildStickerFromDocument(cover);
      if (coverSticker) {
        stickerSet.covers!.push(coverSticker);
        localDb.documents[String(cover.id)] = cover;
      }
    }
  });

  return stickerSet;
}

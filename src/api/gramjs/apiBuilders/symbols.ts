import { Api as GramJs } from '../../../lib/gramjs';
import type {
  ApiEmojiInteraction, ApiSticker, ApiStickerSet, GramJsEmojiInteraction,
} from '../../types';
import { NO_STICKER_SET_ID } from '../../../config';

import { buildApiThumbnailFromCached, buildApiThumbnailFromPath } from './common';
import localDb from '../localDb';

const LOTTIE_STICKER_MIME_TYPE = 'application/x-tgsticker';
const VIDEO_STICKER_MIME_TYPE = 'video/webm';

export function buildStickerFromDocument(document: GramJs.TypeDocument, isNoPremium?: boolean): ApiSticker | undefined {
  if (document instanceof GramJs.DocumentEmpty) {
    return undefined;
  }

  const { mimeType, videoThumbs } = document;
  const stickerAttribute = document.attributes
    .find((attr: any): attr is GramJs.DocumentAttributeSticker => (
      attr instanceof GramJs.DocumentAttributeSticker
    ));

  const fileAttribute = (mimeType === LOTTIE_STICKER_MIME_TYPE || mimeType === VIDEO_STICKER_MIME_TYPE)
    && document.attributes
      .find((attr: any): attr is GramJs.DocumentAttributeFilename => (
        attr instanceof GramJs.DocumentAttributeFilename
      ));

  if (!stickerAttribute && !fileAttribute) {
    return undefined;
  }

  const isLottie = mimeType === LOTTIE_STICKER_MIME_TYPE;
  const isVideo = mimeType === VIDEO_STICKER_MIME_TYPE;

  const imageSizeAttribute = document.attributes
    .find((attr: any): attr is GramJs.DocumentAttributeImageSize => (
      attr instanceof GramJs.DocumentAttributeImageSize
    ));

  const videoSizeAttribute = document.attributes
    .find((attr: any): attr is GramJs.DocumentAttributeVideo => (
      attr instanceof GramJs.DocumentAttributeVideo
    ));

  const sizeAttribute = imageSizeAttribute || videoSizeAttribute;

  const stickerSetInfo = stickerAttribute && stickerAttribute.stickerset instanceof GramJs.InputStickerSetID
    ? stickerAttribute.stickerset
    : undefined;
  const emoji = stickerAttribute?.alt;

  const cachedThumb = document.thumbs && document.thumbs.find(
    (s): s is GramJs.PhotoCachedSize => s instanceof GramJs.PhotoCachedSize,
  );

  // eslint-disable-next-line no-restricted-globals
  if (mimeType === VIDEO_STICKER_MIME_TYPE && !(self as any).isWebmSupported && !cachedThumb) {
    const staticThumb = document.thumbs && document.thumbs.find(
      (s): s is GramJs.PhotoSize => s instanceof GramJs.PhotoSize,
    );

    if (!staticThumb) {
      return undefined;
    }
  }

  const pathThumb = document.thumbs && document.thumbs.find(
    (s): s is GramJs.PhotoPathSize => s instanceof GramJs.PhotoPathSize,
  );

  const thumbnail = cachedThumb ? (
    buildApiThumbnailFromCached(cachedThumb)
  ) : pathThumb && sizeAttribute ? (
    buildApiThumbnailFromPath(pathThumb, sizeAttribute)
  ) : undefined;

  const { w: width, h: height } = cachedThumb as GramJs.PhotoCachedSize || sizeAttribute || {};

  const hasEffect = !isNoPremium && videoThumbs?.some(({ type }) => type === 'f');

  return {
    id: String(document.id),
    stickerSetId: stickerSetInfo ? String(stickerSetInfo.id) : NO_STICKER_SET_ID,
    stickerSetAccessHash: stickerSetInfo && String(stickerSetInfo.accessHash),
    emoji,
    isLottie,
    isVideo,
    width,
    height,
    thumbnail,
    hasEffect,
  };
}

export function buildStickerSet(set: GramJs.StickerSet): ApiStickerSet {
  const {
    archived,
    animated,
    installedDate,
    videos,
    id,
    accessHash,
    title,
    thumbs,
    count,
    shortName,
  } = set;

  return {
    archived,
    isLottie: animated,
    isVideos: videos,
    installedDate,
    id: String(id),
    accessHash: String(accessHash),
    title,
    hasThumbnail: Boolean(thumbs?.length),
    count,
    shortName,
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

export function buildApiEmojiInteraction(json: GramJsEmojiInteraction): ApiEmojiInteraction {
  return {
    timestamps: json.a.map((l) => l.t),
  };
}

import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiEmojiInteraction, ApiSticker, ApiStickerSet, ApiStickerSetInfo, GramJsEmojiInteraction,
} from '../../types';

import { LOTTIE_STICKER_MIME_TYPE, VIDEO_STICKER_MIME_TYPE } from '../../../config';
import { compact } from '../../../util/iteratees';
import localDb from '../localDb';
import { buildApiThumbnailFromCached, buildApiThumbnailFromPath } from './common';

export function buildStickerFromDocument(document: GramJs.TypeDocument, isNoPremium?: boolean): ApiSticker | undefined {
  if (document instanceof GramJs.DocumentEmpty) {
    return undefined;
  }

  const { mimeType, videoThumbs } = document;
  const stickerAttribute = document.attributes
    .find((attr: any): attr is GramJs.DocumentAttributeSticker => (
      attr instanceof GramJs.DocumentAttributeSticker
    ));
  const customEmojiAttribute = document.attributes
    .find((attr): attr is GramJs.DocumentAttributeCustomEmoji => attr instanceof GramJs.DocumentAttributeCustomEmoji);

  const fileAttribute = (mimeType === LOTTIE_STICKER_MIME_TYPE || mimeType === VIDEO_STICKER_MIME_TYPE)
    && document.attributes
      .find((attr: any): attr is GramJs.DocumentAttributeFilename => (
        attr instanceof GramJs.DocumentAttributeFilename
      ));

  if (!(stickerAttribute || customEmojiAttribute) && !fileAttribute) {
    return undefined;
  }

  const isLottie = mimeType === LOTTIE_STICKER_MIME_TYPE;
  const isVideo = mimeType === VIDEO_STICKER_MIME_TYPE;
  const isCustomEmoji = Boolean(customEmojiAttribute);
  const shouldUseTextColor = isCustomEmoji && customEmojiAttribute.textColor;

  const imageSizeAttribute = document.attributes
    .find((attr: any): attr is GramJs.DocumentAttributeImageSize => (
      attr instanceof GramJs.DocumentAttributeImageSize
    ));

  const videoSizeAttribute = document.attributes
    .find((attr: any): attr is GramJs.DocumentAttributeVideo => (
      attr instanceof GramJs.DocumentAttributeVideo
    ));

  const sizeAttribute = imageSizeAttribute || videoSizeAttribute;

  const stickerOrEmojiAttribute = (stickerAttribute || customEmojiAttribute)!;
  const stickerSetInfo = buildApiStickerSetInfo(stickerOrEmojiAttribute?.stickerset);
  const emoji = stickerOrEmojiAttribute?.alt;
  const isFree = Boolean(customEmojiAttribute?.free ?? true);

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

  const hasEffect = !isNoPremium && videoThumbs && compact(videoThumbs
    ?.filter((thumb) => thumb instanceof GramJs.VideoSize) as GramJs.VideoSize[])
    .some(({ type }) => type === 'f');

  return {
    id: String(document.id),
    stickerSetInfo,
    emoji,
    isCustomEmoji,
    isLottie,
    isVideo,
    width,
    height,
    thumbnail,
    hasEffect,
    isFree,
    shouldUseTextColor,
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
    emojis,
    thumbDocumentId,
  } = set;

  return {
    isArchived: archived,
    isLottie: animated,
    isVideos: videos,
    isEmoji: emojis,
    installedDate,
    id: String(id),
    accessHash: String(accessHash),
    title,
    hasThumbnail: Boolean(thumbs?.length || thumbDocumentId),
    thumbCustomEmojiId: thumbDocumentId?.toString(),
    count,
    shortName,
  };
}

function buildApiStickerSetInfo(inputSet?: GramJs.TypeInputStickerSet): ApiStickerSetInfo {
  if (inputSet instanceof GramJs.InputStickerSetID) {
    return {
      id: String(inputSet.id),
      accessHash: String(inputSet.accessHash),
    };
  }
  if (inputSet instanceof GramJs.InputStickerSetShortName) {
    return {
      shortName: inputSet.shortName,
    };
  }

  return {
    isMissing: true,
  };
}

export function buildStickerSetCovered(coveredStickerSet: GramJs.TypeStickerSetCovered): ApiStickerSet {
  const stickerSet = buildStickerSet(coveredStickerSet.set);

  if (coveredStickerSet instanceof GramJs.StickerSetNoCovered) {
    return stickerSet;
  }

  const stickerSetCovers = (coveredStickerSet instanceof GramJs.StickerSetCovered) ? [coveredStickerSet.cover]
    : (coveredStickerSet instanceof GramJs.StickerSetMultiCovered) ? coveredStickerSet.covers
      : coveredStickerSet.documents;

  const stickers = processStickerResult(stickerSetCovers);

  if (coveredStickerSet instanceof GramJs.StickerSetFullCovered) {
    return {
      ...stickerSet,
      stickers,
      packs: processStickerPackResult(coveredStickerSet.packs),
    };
  }

  return {
    ...stickerSet,
    covers: stickers,
  };
}

export function buildApiEmojiInteraction(json: GramJsEmojiInteraction): ApiEmojiInteraction {
  return {
    timestamps: json.a.map(({ t }) => t),
  };
}

export function processStickerPackResult(packs: GramJs.StickerPack[]) {
  return packs.reduce((acc, { emoticon, documents }) => {
    acc[emoticon] = documents.map((documentId) => buildStickerFromDocument(
      localDb.documents[String(documentId)],
    )).filter(Boolean);
    return acc;
  }, {} as Record<string, ApiSticker[]>);
}

export function processStickerResult(stickers: GramJs.TypeDocument[]) {
  return stickers
    .map((document) => {
      if (document instanceof GramJs.Document) {
        const sticker = buildStickerFromDocument(document);
        if (sticker) {
          localDb.documents[String(document.id)] = document;

          return sticker;
        }
      }

      return undefined;
    })
    .filter(Boolean);
}

import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiAudio,
  ApiDocument,
  ApiSticker,
  ApiVideo,
  ApiVoice,
  StoryboardInfo,
} from '../../types';

import {
  STORYBOARD_MAP_MIME,
  STORYBOARD_MIME,
  SUPPORTED_PHOTO_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
  VIDEO_WEBM_TYPE,
} from '../../../config';
import { generateWaveform } from '../../../util/generateWaveform';
import { pick } from '../../../util/iteratees';
import { toJSNumber } from '../../../util/numbers';
import {
  buildApiPhotoPreviewSizes,
  buildApiPhotoSize,
  buildApiThumbnailFromPath,
  buildApiThumbnailFromStripped,
} from './common';
import { buildStickerFromDocument } from './symbols';

export type ApiPageDocument = ApiSticker | ApiVideo | ApiAudio | ApiDocument;

export function buildApiPageDocument(document: GramJs.TypeDocument): ApiPageDocument | undefined {
  if (!(document instanceof GramJs.Document)) {
    return undefined;
  }

  return buildStickerFromDocument(document)
    || buildApiVideoFromDocument(document)
    || buildApiAudioFromDocument(document)
    || buildApiDocument(document);
}

export function buildApiVideoFromDocument(document: GramJs.Document, altDocuments?: GramJs.TypeDocument[], params?: {
  isSpoiler?: boolean;
  timestamp?: number;
}): ApiVideo | undefined {
  if (document instanceof GramJs.DocumentEmpty) {
    return undefined;
  }

  const altVideos = altDocuments && buildAltVideosFromDocuments(altDocuments);

  const { isSpoiler, timestamp } = params || {};

  const {
    id, mimeType, thumbs, size, videoThumbs, attributes,
  } = document;

  if (mimeType === VIDEO_WEBM_TYPE && !(self as any).isWebmSupported) {
    return undefined;
  }

  const videoAttr = attributes
    .find((a): a is GramJs.DocumentAttributeVideo => a instanceof GramJs.DocumentAttributeVideo);

  if (!videoAttr) {
    return undefined;
  }

  const gifAttr = attributes
    .find((a): a is GramJs.DocumentAttributeAnimated => a instanceof GramJs.DocumentAttributeAnimated);

  const hasVideoPreview = videoThumbs?.some((thumb) => thumb instanceof GramJs.VideoSize && thumb.type === 'v');
  const previewPhotoSizes = thumbs && buildApiPhotoPreviewSizes(thumbs);

  const {
    duration,
    w: width,
    h: height,
    supportsStreaming = false,
    roundMessage: isRound = false,
    nosound,
  } = videoAttr;

  const waveform = isRound ? generateWaveform(duration) : undefined;
  const storyboardInfo = altDocuments && buildStoryboardInfoFromDocuments(altDocuments);

  return {
    mediaType: 'video',
    id: String(id),
    mimeType,
    duration,
    fileName: buildApiDocumentFileName(document, 'video'),
    width,
    height,
    supportsStreaming,
    isRound,
    isGif: Boolean(gifAttr),
    thumbnail: buildApiThumbnailFromStripped(thumbs),
    size: toJSNumber(size),
    isSpoiler,
    timestamp,
    hasVideoPreview,
    previewPhotoSizes,
    waveform,
    noSound: nosound,
    altVideos,
    storyboardInfo,
  };
}

export function buildApiAudioFromDocument(
  document: GramJs.Document,
  shouldIncludeVoice = false,
): ApiAudio | undefined {
  if (document instanceof GramJs.DocumentEmpty) {
    return undefined;
  }

  const audioAttribute = document.attributes
    .find((attr): attr is GramJs.DocumentAttributeAudio => (
      attr instanceof GramJs.DocumentAttributeAudio
    ));

  if (!audioAttribute || (!shouldIncludeVoice && audioAttribute.voice)) {
    return undefined;
  }

  const thumbnailSizes = document.thumbs && document.thumbs
    .filter((thumb): thumb is GramJs.PhotoSize => thumb instanceof GramJs.PhotoSize)
    .map((thumb) => buildApiPhotoSize(thumb));

  return {
    mediaType: 'audio',
    id: String(document.id),
    fileName: buildApiDocumentFileName(document, 'audio'),
    thumbnailSizes,
    size: toJSNumber(document.size),
    ...pick(document, ['mimeType']),
    ...pick(audioAttribute, ['duration', 'performer', 'title']),
  };
}

export function buildApiVoiceFromDocument(document: GramJs.Document): ApiVoice | undefined {
  const audioAttribute = document.attributes
    .find((attr): attr is GramJs.DocumentAttributeAudio => (
      attr instanceof GramJs.DocumentAttributeAudio
    ));

  if (!audioAttribute || !audioAttribute.voice) {
    return undefined;
  }

  const { duration, waveform } = audioAttribute;

  return {
    mediaType: 'voice',
    id: String(document.id),
    size: toJSNumber(document.size),
    duration,
    waveform: waveform ? Array.from(waveform) : undefined,
  };
}

export function buildApiDocument(document: GramJs.TypeDocument): ApiDocument | undefined {
  if (!(document instanceof GramJs.Document)) {
    return undefined;
  }

  const {
    id, size, mimeType, date, thumbs, attributes,
  } = document;

  const photoSize = thumbs && thumbs.find((s): s is GramJs.PhotoSize => s instanceof GramJs.PhotoSize);
  let thumbnail = thumbs && buildApiThumbnailFromStripped(thumbs);
  if (!thumbnail && thumbs && photoSize) {
    const photoPath = thumbs.find((s): s is GramJs.PhotoPathSize => s instanceof GramJs.PhotoPathSize);
    if (photoPath) {
      thumbnail = buildApiThumbnailFromPath(photoPath, photoSize);
    }
  }
  const previewPhotoSizes = thumbs && buildApiPhotoPreviewSizes(thumbs);

  let innerMediaType: ApiDocument['innerMediaType'] | undefined;
  let mediaSize: ApiDocument['mediaSize'] | undefined;
  if (photoSize) {
    mediaSize = {
      width: photoSize.w,
      height: photoSize.h,
    };

    if (SUPPORTED_PHOTO_CONTENT_TYPES.has(mimeType)) {
      innerMediaType = 'photo';

      const imageAttribute = attributes
        .find((a): a is GramJs.DocumentAttributeImageSize => a instanceof GramJs.DocumentAttributeImageSize);

      if (imageAttribute) {
        const { w: width, h: height } = imageAttribute;
        mediaSize = {
          width,
          height,
          fromDocumentAttribute: true,
        };
      }
    } else if (SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType)) {
      innerMediaType = 'video';
      const videoAttribute = attributes
        .find((a): a is GramJs.DocumentAttributeVideo => a instanceof GramJs.DocumentAttributeVideo);

      if (videoAttribute) {
        const { w: width, h: height } = videoAttribute;
        mediaSize = {
          width,
          height,
        };
      }
    }
  }

  return {
    mediaType: 'document',
    id: String(id),
    size: toJSNumber(size),
    mimeType,
    timestamp: date,
    fileName: buildApiDocumentFileName(document),
    thumbnail,
    innerMediaType,
    mediaSize,
    previewPhotoSizes,
  };
}

function buildAltVideosFromDocuments(altDocuments: GramJs.TypeDocument[], params?: {
  isSpoiler?: boolean;
}): ApiVideo[] | undefined {
  const altVideos = altDocuments.filter((d): d is GramJs.Document => (
    d instanceof GramJs.Document && d.mimeType.startsWith('video')
  )).map((alt) => buildApiVideoFromDocument(alt, undefined, params))
    .filter(Boolean);
  if (!altVideos.length) {
    return undefined;
  }

  return altVideos;
}

function buildStoryboardInfoFromDocuments(documents: GramJs.TypeDocument[]): StoryboardInfo | undefined {
  const storyboardMtpFile = documents.find((d): d is GramJs.Document => (
    d instanceof GramJs.Document && d.mimeType === STORYBOARD_MIME
  ));
  const storyboardMapMtpFile = documents.find((d): d is GramJs.Document => (
    d instanceof GramJs.Document && d.mimeType === STORYBOARD_MAP_MIME
  ));

  const storyboardFile = storyboardMtpFile && buildApiDocument(storyboardMtpFile);
  const storyboardMapFile = storyboardMapMtpFile && buildApiDocument(storyboardMapMtpFile);

  const sizeAttribute = storyboardMapMtpFile?.attributes.find((a): a is GramJs.DocumentAttributeImageSize => (
    a instanceof GramJs.DocumentAttributeImageSize
  ));

  const frameSize = sizeAttribute && { width: sizeAttribute.w, height: sizeAttribute.h };

  if (!storyboardFile || !storyboardMapFile || !frameSize) {
    return undefined;
  }

  return {
    storyboardFile,
    storyboardMapFile,
    frameSize,
  };
}

function buildApiDocumentFileName(document: GramJs.Document, defaultBase = 'file') {
  const { mimeType, attributes } = document;
  const filenameAttribute = attributes
    .find((a): a is GramJs.DocumentAttributeFilename => a instanceof GramJs.DocumentAttributeFilename);

  if (filenameAttribute) {
    return filenameAttribute.fileName;
  }

  const extension = mimeType.split('/')[1];

  return `${defaultBase}${String(document.id)}.${extension}`;
}

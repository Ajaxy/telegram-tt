import type { ApiAttachment, ApiDimensions, ApiVideo } from '../../../../api/types';
import type { MediaEditorResult } from '../../../ui/mediaEditor/MediaEditor';

import {
  GIF_MIME_TYPE,
  SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_PHOTO_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../../config';
import { parseAudioMetadata } from '../../../../util/audio';
import {
  createPosterForVideo,
  preloadImage,
  preloadVideo,
} from '../../../../util/files';
import { resizeImageInBackground } from '../../../../util/imageResize';
import { createEditDocument, getAttachedStickers } from '../../../ui/mediaEditor/editDocument';

const MAX_STANDARD_QUALITY_IMG_SIZE = 1280; // px
const MAX_HIGH_QUALITY_IMG_SIZE = 2560;
const MAX_THUMB_IMG_SIZE = 40; // px
const MAX_ASPECT_RATIO = 20;
const FILE_EXT_REGEX = /\.[^/.]+$/;

export default async function buildAttachment(
  filename: string, blob: Blob, options?: Partial<ApiAttachment>,
): Promise<ApiAttachment> {
  const blobUrl = URL.createObjectURL(blob);

  try {
    return await buildAttachmentWithBlobUrl(filename, blob, blobUrl, options);
  } catch (err) {
    URL.revokeObjectURL(blobUrl);
    throw err;
  }
}

async function buildAttachmentWithBlobUrl(
  filename: string, blob: Blob, blobUrl: string, options?: Partial<ApiAttachment>,
): Promise<ApiAttachment> {
  const { type: mimeType, size } = blob;
  let quick;
  let sourceDimensions;
  let audio;
  let previewBlobUrl;
  let shouldSendAsFile = options?.shouldSendAsFile;
  const isRoundVideo = options?.isRoundVideo;
  let isPreparing;

  if (SUPPORTED_PHOTO_CONTENT_TYPES.has(mimeType)) {
    const img = await preloadImage(blobUrl);
    const { width, height } = img;
    sourceDimensions = { width, height };
    if (!validateAspectRatio(width, height)) {
      shouldSendAsFile = true;
    }

    if (!shouldSendAsFile) {
      if (mimeType === 'image/jpeg') {
        filename = filename.replace(FILE_EXT_REGEX, '.jpg');
      }

      quick = getPreparedPhotoDimensions(
        width, height, mimeType, options?.shouldSendInHighQuality,
      );
    }
    isPreparing = true;
  } else if (isRoundVideo) {
    isPreparing = true;
  } else if (SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType)) {
    try {
      const { videoWidth: width, videoHeight: height, duration } = await preloadVideo(blobUrl);
      if (!validateAspectRatio(width, height)) {
        shouldSendAsFile = true;
      }
      if (!shouldSendAsFile) {
        quick = { width, height, duration };
      }
    } catch (err) {
      shouldSendAsFile = true;
    }
    isPreparing = true;
  } else if (SUPPORTED_AUDIO_CONTENT_TYPES.has(mimeType) && !options?.voice) {
    try {
      const {
        duration, title, performer, coverUrl,
      } = await parseAudioMetadata(blobUrl);
      audio = {
        duration: duration || 0,
        title,
        performer,
      };
      previewBlobUrl = coverUrl;
    } catch (err) {
      shouldSendAsFile = true;
    }
  }

  return {
    blob,
    blobUrl,
    filename,
    mimeType,
    size,
    quick,
    sourceDimensions,
    audio,
    previewBlobUrl,
    isPreparing: isPreparing || undefined,
    shouldSendAsFile: shouldSendAsFile || undefined,
    uniqueId: `${Date.now()}-${Math.random()}`,
    ...options,
  };
}

export async function prepareAttachment(attachment: ApiAttachment): Promise<ApiAttachment> {
  if (!attachment.isPreparing) return attachment;

  const {
    blob, blobUrl, mimeType, quick, isRoundVideo,
  } = attachment;
  let compressedBlobUrl: string | undefined;
  let previewBlobUrl: string | undefined;
  let preparedQuick = quick;

  try {
    if (SUPPORTED_PHOTO_CONTENT_TYPES.has(mimeType)) {
      const sourceBlob: Blob = blob ?? await fetch(blobUrl).then((response) => response.blob());
      const dimensions = attachment.sourceDimensions || quick || await preloadImage(blobUrl);
      const { width, height } = dimensions;
      const maxQuickImgSize = attachment.shouldSendInHighQuality
        ? MAX_HIGH_QUALITY_IMG_SIZE : MAX_STANDARD_QUALITY_IMG_SIZE;
      const shouldShrink = Math.max(width, height) > maxQuickImgSize;
      const isGif = mimeType === GIF_MIME_TYPE;

      if (!attachment.shouldSendAsFile) {
        preparedQuick = getPreparedPhotoDimensions(
          width, height, mimeType, attachment.shouldSendInHighQuality,
        );
      }

      if (preparedQuick && !isGif && (shouldShrink || mimeType !== 'image/jpeg')) {
        const { width: preparedWidth, height: preparedHeight } = preparedQuick;
        compressedBlobUrl = await resizeImageInBackground(
          sourceBlob, preparedWidth, preparedHeight, 'image/jpeg',
        );
      }

      const previewSource = compressedBlobUrl
        ? await fetch(compressedBlobUrl).then((response) => response.blob()) : sourceBlob;
      const previewRatio = Math.min(MAX_THUMB_IMG_SIZE / Math.max(width, height), 1);
      previewBlobUrl = previewRatio < 1
        ? await resizeImageInBackground(
          previewSource, Math.max(Math.round(width * previewRatio), 1),
          Math.max(Math.round(height * previewRatio), 1), 'image/jpeg',
        )
        : blobUrl;
    } else if (isRoundVideo || SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType)) {
      previewBlobUrl = await createPosterForVideo(blobUrl);
    }

    return {
      ...attachment,
      compressedBlobUrl,
      previewBlobUrl,
      quick: preparedQuick,
      isPreparing: undefined,
    };
  } catch (err) {
    revokeGeneratedUrl(compressedBlobUrl, attachment.compressedBlobUrl);
    revokeGeneratedUrl(previewBlobUrl, attachment.previewBlobUrl);
    throw err;
  }
}

export function applyVideoEdit(attachment: ApiAttachment, result: Extract<MediaEditorResult, { kind: 'video' }>) {
  let { previewBlobUrl } = attachment;
  if (result.previewBlob) {
    revokeGeneratedUrl(previewBlobUrl, attachment.blobUrl);
    previewBlobUrl = URL.createObjectURL(result.previewBlob);
  }

  if (attachment.videoCover) URL.revokeObjectURL(attachment.videoCover.blobUrl);
  const { cover } = result;

  return {
    ...attachment,
    quick: { ...result.outputSize, duration: result.outputDuration },
    previewBlobUrl,
    isPreparing: undefined,
    editState: result.editState,
    videoProcessing: result.processing,
    videoQualityLevel: result.qualityLevel,
    shouldSendAsGif: result.isGif || undefined,
    attachedStickers: getAttachedStickers(result.editState.document),
    videoCover: cover
      ? { blobUrl: URL.createObjectURL(cover.blob), width: cover.width, height: cover.height } : undefined,
  };
}

export function prepareAttachmentsToSend(
  attachments: ApiAttachment[], shouldSendCompressed?: boolean,
): ApiAttachment[] {
  return attachments.map((attach) => {
    if (shouldSendCompressed) {
      if (attach.compressedBlobUrl) {
        return {
          ...attach,
          blobUrl: attach.compressedBlobUrl,
        };
      }
      return attach;
    }

    const isPhotoGif = attach.shouldSendAsGif && SUPPORTED_PHOTO_CONTENT_TYPES.has(attach.mimeType);

    return {
      ...attach,
      shouldSendAsFile: !(attach.voice || attach.audio || attach.isRoundVideo) || undefined,
      shouldSendAsSpoiler: undefined,
      shouldSendAsGif: isPhotoGif ? undefined : attach.shouldSendAsGif,
      videoProcessing: isPhotoGif ? undefined : attach.videoProcessing,
    };
  });
}

function validateAspectRatio(width: number, height: number) {
  const maxAspectRatio = Math.max(width, height) / Math.min(width, height);
  return maxAspectRatio <= MAX_ASPECT_RATIO;
}

export function getPreparedPhotoDimensions(
  width: number,
  height: number,
  mimeType: string,
  shouldSendInHighQuality?: boolean,
) {
  if (mimeType === GIF_MIME_TYPE) return { width, height };

  const maxSize = shouldSendInHighQuality ? MAX_HIGH_QUALITY_IMG_SIZE : MAX_STANDARD_QUALITY_IMG_SIZE;
  const ratio = Math.min(maxSize / Math.max(width, height), 1);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

function revokeGeneratedUrl(url?: string, previousUrl?: string) {
  if (url && url !== previousUrl) {
    URL.revokeObjectURL(url);
  }
}

export function buildGifAttachment(gif: ApiVideo): ApiAttachment {
  const {
    blobUrl,
    thumbnail,
    fileName,
    mimeType,
    size,
    width,
    height,
    duration,
  } = gif;

  return {
    gif,
    blobUrl: blobUrl || '',
    previewBlobUrl: thumbnail?.dataUri,
    filename: fileName,
    mimeType,
    size,
    quick: width && height ? { width, height, duration } : undefined,
    uniqueId: `gif-${gif.id}-${Date.now()}`,
  } satisfies ApiAttachment;
}

export function buildAttachmentWithVideoCover(
  attachment: ApiAttachment, coverBlob: Blob, coverSize?: ApiDimensions,
): ApiAttachment {
  if (!attachment.quick) return attachment;

  const { width, height } = attachment.quick;
  const blobUrl = URL.createObjectURL(coverBlob);

  return {
    ...attachment,
    videoCover: { blobUrl, width: coverSize?.width ?? width, height: coverSize?.height ?? height },
    editState: {
      document: {
        ...createEditDocument({ width, height }),
        cover: { type: 'image', blobUrl: URL.createObjectURL(coverBlob) },
      },
      undoStack: [],
      redoStack: [],
    },
  };
}

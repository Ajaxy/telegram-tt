import { ApiAttachment } from '../../../../api/types';
import {
  SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_IMAGE_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../../config';
import { parseAudioMetadata } from '../../../../util/audio';
import {
  preloadImage,
  preloadVideo,
  createPosterForVideo,
  fetchBlob,
} from '../../../../util/files';
import { scaleImage } from '../../../../util/imageResize';

const MAX_QUICK_IMG_SIZE = 1280; // px
const FILE_EXT_REGEX = /\.[^/.]+$/;

export default async function buildAttachment(
  filename: string, blob: Blob, isQuick: boolean, options?: Partial<ApiAttachment>,
): Promise<ApiAttachment> {
  const blobUrl = URL.createObjectURL(blob);
  const { type: mimeType, size } = blob;
  let quick;
  let audio;
  let previewBlobUrl;

  if (SUPPORTED_IMAGE_CONTENT_TYPES.has(mimeType)) {
    if (isQuick) {
      const img = await preloadImage(blobUrl);
      const { width, height } = img;

      if (width > MAX_QUICK_IMG_SIZE || height > MAX_QUICK_IMG_SIZE || mimeType !== 'image/jpeg') {
        const resizedUrl = await scaleImage(blobUrl, MAX_QUICK_IMG_SIZE / Math.max(width, height), 'image/jpeg');
        URL.revokeObjectURL(blobUrl);
        const newBlob = await fetchBlob(resizedUrl);
        return buildAttachment(filename, newBlob, true, options);
      }

      if (mimeType === 'image/jpeg') {
        filename = filename.replace(FILE_EXT_REGEX, '.jpg');
      }

      quick = { width, height };
    } else {
      previewBlobUrl = blobUrl;
    }
  } else if (SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType)) {
    const { videoWidth: width, videoHeight: height, duration } = await preloadVideo(blobUrl);
    quick = { width, height, duration };

    previewBlobUrl = await createPosterForVideo(blobUrl);
  } else if (SUPPORTED_AUDIO_CONTENT_TYPES.has(mimeType)) {
    const {
      duration, title, performer, coverUrl,
    } = await parseAudioMetadata(blobUrl);
    audio = {
      duration: duration || 0,
      title,
      performer,
    };
    previewBlobUrl = coverUrl;
  }

  return {
    blobUrl,
    filename,
    mimeType,
    size,
    quick,
    audio,
    previewBlobUrl,
    ...options,
  };
}

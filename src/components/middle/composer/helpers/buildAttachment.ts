import { ApiAttachment } from '../../../../api/types';
import {
  preloadImage,
  preloadVideo,
  createPosterForVideo,
  fetchBlob,
} from '../../../../util/files';
import { scaleImage } from '../../../../util/imageResize';

const MAX_QUICK_IMG_SIZE = 1280; // px

export default async function buildAttachment(
  filename: string, blob: Blob, isQuick: boolean, options?: Partial<ApiAttachment>,
): Promise<ApiAttachment> {
  const blobUrl = URL.createObjectURL(blob);
  const { type: mimeType, size } = blob;
  let quick;
  let previewBlobUrl;

  if (mimeType.startsWith('image/')) {
    if (isQuick) {
      const img = await preloadImage(blobUrl);
      const { width, height } = img;

      if (width > MAX_QUICK_IMG_SIZE || height > MAX_QUICK_IMG_SIZE || mimeType !== 'image/jpeg') {
        const resizedUrl = await scaleImage(blobUrl, MAX_QUICK_IMG_SIZE / Math.max(width, height), 'image/jpeg');
        URL.revokeObjectURL(blobUrl);
        const newBlob = await fetchBlob(resizedUrl);
        return buildAttachment(filename, newBlob, true, options);
      }

      quick = { width, height };
    } else {
      previewBlobUrl = blobUrl;
    }
  } else if (mimeType.startsWith('video/')) {
    const { videoWidth: width, videoHeight: height, duration } = await preloadVideo(blobUrl);
    quick = { width, height, duration };

    previewBlobUrl = await createPosterForVideo(blobUrl);
  }

  return {
    blobUrl,
    filename,
    mimeType,
    size,
    quick,
    previewBlobUrl,
    ...options,
  };
}

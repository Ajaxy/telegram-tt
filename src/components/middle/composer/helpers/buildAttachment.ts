import { ApiAttachment } from '../../../../api/types';
import { preloadImage, preloadVideo, createPosterForVideo } from '../../../../util/files';

const MAX_QUICK_VIDEO_SIZE = 10 * 1024 ** 2; // 10 MB
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
        const newBlob = await squeezeImage(img);
        if (newBlob) {
          URL.revokeObjectURL(blobUrl);
          return buildAttachment(filename, newBlob, true, options);
        } else {
          return buildAttachment(filename, blob, false, options);
        }
      }

      quick = { width, height };
    } else {
      previewBlobUrl = blobUrl;
    }
  } else if (mimeType.startsWith('video/')) {
    // Videos < 10 MB are always sent in quick mode (in other clients).
    // Quick mode for videos > 10 MB is not supported until client-side video squeezing is implemented.
    if (size < MAX_QUICK_VIDEO_SIZE) {
      const { videoWidth: width, videoHeight: height, duration } = await preloadVideo(blobUrl);
      quick = { width, height, duration };
    }

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

function squeezeImage(img: HTMLImageElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    let { width, height } = img;

    if (width > MAX_QUICK_IMG_SIZE || height > MAX_QUICK_IMG_SIZE) {
      if (width >= height) {
        height *= MAX_QUICK_IMG_SIZE / width;
        width = MAX_QUICK_IMG_SIZE;
      } else {
        width *= MAX_QUICK_IMG_SIZE / height;
        height = MAX_QUICK_IMG_SIZE;
      }
    }

    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, width, height);
    canvas.toBlob(resolve, 'image/jpeg', 100);
  });
}

import { preloadImage } from '../../../../util/files';

export async function renderCoverImage(blobUrl: string, aspectRatio: number, maxSide: number, quality: number) {
  const image = await preloadImage(blobUrl);
  let sourceWidth = image.width;
  let sourceHeight = image.height;
  if (sourceWidth / sourceHeight > aspectRatio) {
    sourceWidth = sourceHeight * aspectRatio;
  } else {
    sourceHeight = sourceWidth / aspectRatio;
  }

  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d')!.drawImage(
    image,
    (image.width - sourceWidth) / 2, (image.height - sourceHeight) / 2, sourceWidth, sourceHeight,
    0, 0, width, height,
  );

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return { blob, width, height };
}

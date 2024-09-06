import { createWorkerInterface } from '../../util/createPostMessageInterface';

export async function blurThumb(canvas: OffscreenCanvas, dataUri: string, radius: number) {
  const imageBitmap = await dataUriToImageBitmap(dataUri);
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d')!;

  // Draw image twice to battle white-ish edges
  ctx.drawImage(imageBitmap, 0, 0, width, height);
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(imageBitmap, 0, 0, width, height);
}

function dataUriToImageBitmap(dataUri: string) {
  const byteString = atob(dataUri.split(',')[1]);
  const mimeString = dataUri.split(',')[0].split(':')[1].split(';')[0];
  const buffer = new ArrayBuffer(byteString.length);
  const dataArray = new Uint8Array(buffer);

  for (let i = 0; i < byteString.length; i++) {
    dataArray[i] = byteString.charCodeAt(i);
  }

  const blob = new Blob([buffer], { type: mimeString });

  return createImageBitmap(blob);
}

const api = { blurThumb };

createWorkerInterface(api, 'media');

export type OffscreenCanvasApi = typeof api;

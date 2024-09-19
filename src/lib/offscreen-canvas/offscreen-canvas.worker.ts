import { createWorkerInterface } from '../../util/createPostMessageInterface';
import fastBlur from '../fastBlur';

const FAST_BLUR_ITERATIONS = 2;

export async function blurThumb(canvas: OffscreenCanvas, thumbData: string, radius: number) {
  const imageBitmap = thumbData.startsWith('data:')
    ? await dataUriToImageBitmap(thumbData)
    : await blobUrlToImageBitmap(thumbData);
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d')!;
  const isFilterSupported = 'filter' in ctx;

  if (isFilterSupported) {
    ctx.filter = `blur(${radius}px)`;
  }

  ctx.drawImage(imageBitmap, -radius * 2, -radius * 2, width + radius * 4, height + radius * 4);

  if (!isFilterSupported) {
    fastBlur(ctx, 0, 0, width, height, radius, FAST_BLUR_ITERATIONS);
  }
}

export async function getAppendixColorFromImage(blobUrl: string, isOwn: boolean) {
  const imageBitmap = await blobUrlToImageBitmap(blobUrl);
  const { width, height } = imageBitmap;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(imageBitmap, 0, 0, width, height);

  const x = isOwn ? width - 1 : 0;
  const y = height - 1;

  const pixel = Array.from(ctx.getImageData(x, y, 1, 1).data);
  return `rgba(${pixel.join(',')})`;
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

async function blobUrlToImageBitmap(blobUrl: string) {
  const response = await fetch(blobUrl);
  const blob = await response.blob();
  return createImageBitmap(blob);
}

const api = {
  'offscreen-canvas:blurThumb': blurThumb,
  'offscreen-canvas:getAppendixColorFromImage': getAppendixColorFromImage,
};

createWorkerInterface(api, 'media');

export type OffscreenCanvasApi = typeof api;

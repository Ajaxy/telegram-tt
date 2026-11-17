import type { MediaEditDocument } from '../../../../types/mediaEditor';
import type { LayerFrames } from '../render/layers';
import type { Size } from '../render/transform';

import { composeFrame, createFrameScratch } from '../render/composeFrame';
import { fitCropToMaxSide } from '../render/transform';

type Params = {
  time: number;
  doc: MediaEditDocument;
  sourceSize: Size;
  maxSide: number;
  mimeType: string;
  quality?: number;
  layerFrames?: LayerFrames;
};

const SEEK_TIMEOUT = 1000;

export async function renderVideoElementFrame(src: string, {
  time, doc, sourceSize, maxSide, mimeType, quality, layerFrames,
}: Params) {
  const video = document.createElement('video');
  video.muted = true;
  video.src = src;

  try {
    await waitForVideoFrame(video, time);

    const size = fitCropToMaxSide(doc.crop, maxSide);
    const canvas = new OffscreenCanvas(size.width, size.height);
    const frameTime = time - (doc.trim?.start ?? 0);
    composeFrame({
      ctx: canvas.getContext('2d')!,
      frame: video,
      sourceSize,
      doc,
      scratch: createFrameScratch(),
      layerFrames,
      time: frameTime,
    });

    return { blob: await canvas.convertToBlob({ type: mimeType, quality }), ...size, time: frameTime };
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}

export function waitForVideoFrame(video: HTMLVideoElement, time?: number) {
  return new Promise<void>((resolve, reject) => {
    video.addEventListener('error', reject, { once: true });
    video.addEventListener('loadeddata', () => {
      if (!time) {
        resolve();
        return;
      }

      video.addEventListener('seeked', () => resolve(), { once: true });
      video.currentTime = time;
    }, { once: true });
  });
}

export function seekVideo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, SEEK_TIMEOUT);
    video.addEventListener('seeked', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
    video.currentTime = time;
  });
}

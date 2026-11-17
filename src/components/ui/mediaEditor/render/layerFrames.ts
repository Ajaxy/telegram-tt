import type { ApiSticker } from '../../../../api/types';
import type { EditorLayer } from '../../../../types/mediaEditor';
import type { CancellableCallback } from '../../../../util/PostMessageConnector';
import type { LayerFrames } from './layers';
import type { Size } from './transform';
import { ApiMediaFormat } from '../../../../api/types';

import { getStickerMediaHash } from '../../../../global/helpers';
import { IS_WEBM_SUPPORTED } from '../../../../util/browser/windowEnvironment';
import generateUniqueId from '../../../../util/generateUniqueId';
import { requestMediaWorker } from '../../../../util/launchMediaWorkers';
import * as mediaLoader from '../../../../util/mediaLoader';
import { seekVideo } from '../export/renderVideoElementFrame';
import { loadTextLayerFonts, measureLayer, renderTextLayerImage } from './layers';

type Options = {
  shouldRenderText?: boolean;
  isFirstFrameOnly?: boolean;
};

const STICKER_FRAME_RATE = 30;
export const MAX_STICKER_SIDE = 512;
const MAX_VIDEO_STICKER_DURATION = 3; // s

export async function loadLayerFrames(
  layers: EditorLayer[] | undefined, frameSize: Size, { shouldRenderText, isFirstFrameOnly }: Options = {},
): Promise<LayerFrames> {
  const frames: LayerFrames = {};
  if (!layers?.length) return frames;

  await loadTextLayerFonts(layers);

  await Promise.all(layers.map(async (layer) => {
    if (layer.type === 'text') {
      if (shouldRenderText) {
        frames[layer.id] = {
          frames: [renderTextLayerImage(layer, frameSize)],
          frameRate: 1,
          frameWidth: frameSize.width,
        };
      }
      return;
    }

    const sticker = layer.sticker!;
    if (frames[sticker.id]) return;

    const largestSide = Math.max(...layers.map((other) => (
      other.sticker?.id === sticker.id ? measureLayer(other, frameSize).width : 0
    )));
    const side = Math.min(Math.ceil(largestSide), MAX_STICKER_SIDE);
    frames[sticker.id] = { frames: [], frameRate: STICKER_FRAME_RATE };
    frames[sticker.id] = await loadStickerFrames(sticker, side, Boolean(isFirstFrameOnly)).catch(() => (
      { frames: [], frameRate: STICKER_FRAME_RATE }
    ));
  }));

  return frames;
}

export function hasMissingStickerFrames(layers: EditorLayer[] | undefined, layerFrames: LayerFrames) {
  return Boolean(layers?.some(({ sticker }) => sticker && !layerFrames[sticker.id]?.frames.length));
}

export function hasAnimatedStickers(layers?: EditorLayer[]) {
  return Boolean(layers?.some(({ sticker }) => sticker && isAnimatedSticker(sticker)));
}

export function isAnimatedSticker(sticker: ApiSticker) {
  return Boolean(sticker.isLottie || (sticker.isVideo && IS_WEBM_SUPPORTED));
}

export function getLayerFramesDuration(layerFrames: LayerFrames) {
  return Math.max(0, ...Object.values(layerFrames).map(({ frames, frameRate }) => (
    frames.length > 1 ? frames.length / frameRate : 0
  )));
}

async function loadStickerFrames(sticker: ApiSticker, side: number, isFirstFrameOnly: boolean) {
  const isUnsupportedVideo = sticker.isVideo && !IS_WEBM_SUPPORTED;
  const mediaHash = getStickerMediaHash(sticker, isUnsupportedVideo ? 'preview' : 'inline');
  const url = await mediaLoader.fetch(mediaHash, ApiMediaFormat.BlobUrl);

  if (sticker.isLottie) return loadLottieFrames(url, side, isFirstFrameOnly);
  if (sticker.isVideo && !isUnsupportedVideo) return loadVideoFrames(url, side, isFirstFrameOnly);

  const image = await createImageBitmap(await (await fetch(url)).blob());
  return { frames: [image], frameRate: STICKER_FRAME_RATE };
}

async function loadLottieFrames(tgsUrl: string, side: number, isFirstFrameOnly: boolean) {
  const key = generateUniqueId();
  let frameRate = STICKER_FRAME_RATE;
  let framesCount = 0;
  const onInit: CancellableCallback = (reduceFactor: number, msPerFrame: number, reducedFramesCount: number) => {
    frameRate = 1000 / msPerFrame;
    framesCount = reducedFramesCount;
  };

  await requestMediaWorker({ name: 'tlottie:init', args: [key, tgsUrl, side, true, undefined, undefined, onInit] }, 0);

  const frames: ImageBitmap[] = [];
  const count = isFirstFrameOnly ? 1 : framesCount;
  try {
    for (let i = 0; i < count; i++) {
      const onFrame: CancellableCallback = (frameIndex: number, bitmap: ImageBitmap) => {
        frames[frameIndex] = bitmap;
      };
      await requestMediaWorker({ name: 'tlottie:renderFrames', args: [key, i, onFrame] }, 0);
    }
  } finally {
    void requestMediaWorker({ name: 'tlottie:destroy', args: [key] }, 0);
  }

  return { frames: frames.filter(Boolean), frameRate };
}

async function loadVideoFrames(url: string, side: number, isFirstFrameOnly: boolean) {
  const video = document.createElement('video');
  video.muted = true;
  video.src = url;
  await new Promise((resolve) => {
    video.addEventListener('loadeddata', resolve, { once: true });
    video.addEventListener('error', resolve, { once: true });
  });

  const duration = Math.min(video.duration || 0, MAX_VIDEO_STICKER_DURATION);
  const count = isFirstFrameOnly ? 1 : Math.max(1, Math.floor(duration * STICKER_FRAME_RATE));
  const { videoWidth, videoHeight } = video;
  const scale = Math.min(side / Math.max(videoWidth, videoHeight), 1);
  const options: ImageBitmapOptions = {
    resizeWidth: Math.ceil(videoWidth * scale),
    resizeHeight: Math.ceil(videoHeight * scale),
    resizeQuality: 'high',
  };
  const frames: ImageBitmap[] = [];
  for (let i = 0; i < count; i++) {
    await seekVideo(video, i / STICKER_FRAME_RATE);
    frames.push(await createImageBitmap(video, options));
  }

  video.removeAttribute('src');
  video.load();

  return { frames, frameRate: STICKER_FRAME_RATE };
}

import type { ApiSticker } from '../../../../api/types';
import type { CancellableCallback } from '../../../../util/PostMessageConnector';
import { ApiMediaFormat } from '../../../../api/types';

import { getStickerMediaHash } from '../../../../global/helpers';
import generateUniqueId from '../../../../util/generateUniqueId';
import { requestMediaWorker } from '../../../../util/launchMediaWorkers';
import { clamp } from '../../../../util/math';
import * as mediaLoader from '../../../../util/mediaLoader';

export type StickerTexture = {
  // The art on a white die-cut, as the card draws it
  image: HTMLCanvasElement;
  // The bare art, as a tile draws it
  art: HTMLCanvasElement;
};

// As in the iOS app, the art keeps a margin of 3.5% for the die-cut around it
const STICKER_TEXTURE_SIDE = 320;
const ART_PADDING = Math.floor(STICKER_TEXTURE_SIDE * 0.035);
const ART_SIDE = STICKER_TEXTURE_SIDE - ART_PADDING * 2;
export const STICKER_ART_FRACTION = ART_SIDE / STICKER_TEXTURE_SIDE;

// The die-cut of the iOS card, shared with the filter of `WalletCardStickers`: the solid part of the art, alpha above
// 127 of 255, is blurred by 1.5% of the art side, and the alpha ramp `alpha * 10 - 150 / 255` turns the blur into
// a white edge with round corners
export const MAX_ALPHA = 255;
export const SOLID_ALPHA_FROM = 127;
export const CUTOUT_BLUR = 0.015;
export const CUTOUT_GAIN = 10;
export const CUTOUT_OFFSET = 150;
const BLUR_EXTENT = 3;

// Two canvases of 320 × 320 take 0.8 MB, so the cache keeps the 16 textures asked for last
const MAX_TEXTURES = 16;

const textures = new Map<string, Promise<StickerTexture | undefined>>();
const loadedTextures = new Map<string, StickerTexture>();

export function loadStickerTexture(sticker: ApiSticker) {
  const cached = textures.get(sticker.id);
  if (cached) {
    // A map keeps the order of insertion, so the texture asked for again goes last in the queue
    textures.delete(sticker.id);
    textures.set(sticker.id, cached);
    return cached;
  }

  // A load that was cleared or evicted meanwhile leaves the cache as it is
  const texture: Promise<StickerTexture | undefined> = renderStickerTexture(sticker).catch(() => undefined)
    .then((loaded) => {
      if (textures.get(sticker.id) !== texture) return loaded;

      if (!loaded) {
        textures.delete(sticker.id);
        return undefined;
      }

      loadedTextures.set(sticker.id, loaded);
      // The texture asked for longest ago goes first
      while (textures.size > MAX_TEXTURES) {
        const oldest = textures.keys().next().value!;
        textures.delete(oldest);
        loadedTextures.delete(oldest);
      }

      return loaded;
    });
  textures.set(sticker.id, texture);

  return texture;
}

export function clearStickerTextures() {
  textures.clear();
  loadedTextures.clear();
}

export function getLoadedStickerTexture(sticker: ApiSticker) {
  return loadedTextures.get(sticker.id);
}

async function renderStickerTexture(sticker: ApiSticker): Promise<StickerTexture | undefined> {
  const frame = await loadFirstFrame(sticker);
  if (!frame) return undefined;

  const art = createCanvas();
  art.getContext('2d')!.drawImage(frame, ART_PADDING, ART_PADDING, ART_SIDE, ART_SIDE);
  frame.close();

  const image = createCanvas();
  const context = image.getContext('2d')!;
  const artPixels = art.getContext('2d')!.getImageData(0, 0, STICKER_TEXTURE_SIDE, STICKER_TEXTURE_SIDE);
  context.putImageData(buildCutout(artPixels), 0, 0);
  context.drawImage(art, 0, 0);

  return { image, art };
}

async function loadFirstFrame(sticker: ApiSticker) {
  const url = await mediaLoader.fetch(getStickerMediaHash(sticker, 'inline'), ApiMediaFormat.BlobUrl);
  if (!url) return undefined;

  if (!sticker.isLottie) return createImageBitmap(await (await fetch(url)).blob());

  const key = generateUniqueId();
  let bitmap: ImageBitmap | undefined;
  const onInit: CancellableCallback = () => undefined;
  const onFrame: CancellableCallback = (frameIndex: number, frame: ImageBitmap) => {
    bitmap = frame;
  };

  try {
    await requestMediaWorker({
      name: 'tlottie:init', args: [key, url, ART_SIDE, false, undefined, undefined, onInit],
    }, 0);
    await requestMediaWorker({ name: 'tlottie:renderFrames', args: [key, 0, onFrame] }, 0);
  } finally {
    void requestMediaWorker({ name: 'tlottie:destroy', args: [key] }, 0);
  }

  return bitmap;
}

function createCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = STICKER_TEXTURE_SIDE;
  canvas.height = STICKER_TEXTURE_SIDE;

  return canvas;
}

function buildCutout(source: ImageData) {
  const side = STICKER_TEXTURE_SIDE;
  const count = side * side;
  const solid = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    solid[i] = clamp(source.data[i * 4 + 3] - SOLID_ALPHA_FROM, 0, 1);
  }

  const blurred = blurPlane(solid, side, CUTOUT_BLUR * ART_SIDE);
  const cutout = new ImageData(side, side);
  for (let i = 0; i < count; i++) {
    const alpha = clamp(blurred[i] * MAX_ALPHA * CUTOUT_GAIN - CUTOUT_OFFSET, 0, MAX_ALPHA);
    cutout.data.fill(MAX_ALPHA, i * 4, i * 4 + 3);
    cutout.data[i * 4 + 3] = alpha;
  }

  return cutout;
}

function blurPlane(plane: Float32Array, side: number, sigma: number) {
  const extent = Math.ceil(sigma * BLUR_EXTENT);
  const weights = Array.from({ length: extent * 2 + 1 }, (_, i) => (
    Math.exp(-((i - extent) ** 2) / (2 * sigma * sigma))
  ));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const kernel = weights.map((weight) => weight / total);
  const rows = new Float32Array(plane.length);
  const result = new Float32Array(plane.length);

  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      let sum = 0;
      for (let k = -extent; k <= extent; k++) {
        const column = x + k;
        if (column >= 0 && column < side) sum += plane[y * side + column] * kernel[k + extent];
      }
      rows[y * side + x] = sum;
    }
  }

  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      let sum = 0;
      for (let k = -extent; k <= extent; k++) {
        const row = y + k;
        if (row >= 0 && row < side) sum += rows[row * side + x] * kernel[k + extent];
      }
      result[y * side + x] = sum;
    }
  }

  return result;
}

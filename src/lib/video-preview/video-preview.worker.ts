import { createWorkerInterface } from '../../util/createPostMessageInterface';
import type { CancellableCallback } from '../../util/PostMessageConnector';
import { MP4Demuxer } from './MP4Demuxer';
import * as LibAVWebCodecs from './polyfill';

let decoder: any;
let demuxer: any;
let onDestroy: VoidFunction | undefined;

let isLoaded = false;

async function init(
  url: string,
  maxFrames: number,
  workerIndex: number,
  workersTotal: number,
  onFrame: CancellableCallback,
) {
  const hasWebCodecs = 'VideoDecoder' in globalThis;
  if (!hasWebCodecs) {
    await loadLibAV();
  }

  const decodedFrames = new Set<number>();

  // @ts-ignore
  decoder = new VideoDecoder({
    async output(frame: any) {
      const time = frame.timestamp / 1e6;
      const seconds = Math.floor(time);
      // Only render whole second frames
      if (!decodedFrames.has(seconds)) {
        const bitmap = await createImageBitmap(frame);
        decodedFrames.add(seconds);
        onFrame(seconds, bitmap);
      }
      frame.close();
    },
    error(e: any) {
      // eslint-disable-next-line no-console
      console.error('[Video Preview] error', e);
    },
  });

  demuxer = new MP4Demuxer(url, {
    stepOffset: workerIndex,
    stepMultiplier: workersTotal,
    isPolyfill: !hasWebCodecs,
    maxFrames,
    onConfig(config) {
      decoder?.configure(config);
    },
    onChunk(chunk) {
      if (decoder?.state !== 'configured') return;
      decoder?.decode(chunk);
    },
  });

  return new Promise<void>((resolve) => {
    onDestroy = resolve;
  });
}

function destroy() {
  try {
    decoder?.close();
    demuxer?.close();
  } catch {
    // Ignore
  }
  decoder = undefined;
  demuxer = undefined;
  onDestroy?.();
}

async function loadLibAV() {
  if (isLoaded) return;

  importScripts(new URL('./libav-3.10.5.1.2-webcodecs.js', import.meta.url));
  await LibAVWebCodecs.load({
    polyfill: true,
    libavOptions: { noworker: true, nosimd: true },
  });

  isLoaded = true;
}

const api = {
  'video-preview:init': init,
  'video-preview:destroy': destroy,
};

createWorkerInterface(api);

export type VideoPreviewApi = typeof api;

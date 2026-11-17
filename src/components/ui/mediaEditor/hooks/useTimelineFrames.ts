import { useEffect, useState } from '@teact';

import type { CancellableCallback } from '../../../../util/PostMessageConnector';
import type { Size } from '../render/transform';

import { cancelVideoProcessing, requestVideoProcessing } from '../../../../util/launchVideoProcessingWorker';

type Options = {
  blob?: Blob;
  blobUrl?: string;
  count: number;
  frameSize: Size;
  canDecodeVideo: boolean;
};

export default function useTimelineFrames({
  blob,
  blobUrl,
  count,
  frameSize,
  canDecodeVideo,
}: Options) {
  const [frames, setFrames] = useState<(ImageBitmap | undefined)[]>([]);
  const { width, height } = frameSize;

  useEffect(() => {
    if (!blob || !blobUrl || !count || !width || !height) return undefined;

    const bitmaps: (ImageBitmap | undefined)[] = new Array(count).fill(undefined);
    let isCancelled = false;
    setFrames(bitmaps);

    const handleFrame: CancellableCallback = (index: number, bitmap: ImageBitmap) => {
      if (isCancelled) {
        bitmap.close();
        return;
      }
      bitmaps[index] = bitmap;
      setFrames([...bitmaps]);
    };

    if (canDecodeVideo) {
      requestVideoProcessing({
        name: 'getTimelineFrames',
        args: [blob, { count, width, height }, handleFrame],
      }).catch(() => undefined);
    } else {
      void extractFramesWithVideo(blobUrl, count, { width, height }, handleFrame, () => isCancelled);
    }

    return () => {
      isCancelled = true;
      if (canDecodeVideo) cancelVideoProcessing(handleFrame);
      bitmaps.forEach((bitmap) => bitmap?.close());
    };
  }, [blob, blobUrl, count, width, height, canDecodeVideo]);

  return frames;
}

async function extractFramesWithVideo(
  blobUrl: string,
  count: number,
  frameSize: Size,
  onFrame: (index: number, bitmap: ImageBitmap) => void,
  getIsCancelled: () => boolean,
) {
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.src = blobUrl;

  try {
    await new Promise((resolve, reject) => {
      video.addEventListener('loadeddata', resolve, { once: true });
      video.addEventListener('error', reject, { once: true });
    });

    const canvas = new OffscreenCanvas(frameSize.width, frameSize.height);
    const ctx = canvas.getContext('2d')!;
    const step = video.duration / count;

    for (let i = 0; i < count; i++) {
      if (getIsCancelled()) return;
      video.currentTime = step * (i + 0.5);
      await new Promise((resolve) => {
        video.addEventListener('seeked', resolve, { once: true });
      });
      drawCover(ctx, video, frameSize);
      onFrame(i, await createImageBitmap(canvas));
    }
  } catch {
    // Frames stay as placeholders
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}

function drawCover(ctx: OffscreenCanvasRenderingContext2D, video: HTMLVideoElement, size: Size) {
  const scale = Math.max(size.width / video.videoWidth, size.height / video.videoHeight);
  const width = video.videoWidth * scale;
  const height = video.videoHeight * scale;
  ctx.drawImage(video, (size.width - width) / 2, (size.height - height) / 2, width, height);
}

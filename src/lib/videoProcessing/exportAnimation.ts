import {
  BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality,
} from 'mediabunny';

import type { LayerFrames } from '../../components/ui/mediaEditor/render/layers';
import type { MediaEditDocument, VideoProcessingParams } from '../../types/mediaEditor';
import type { CancellableCallback } from '../../util/PostMessageConnector';

import { composeFrame, createFrameScratch } from '../../components/ui/mediaEditor/render/composeFrame';
import { drawLayers } from '../../components/ui/mediaEditor/render/layers';
import { KEY_FRAME_INTERVAL } from './exportVideo';

type ExportAnimationParams = VideoProcessingParams & {
  doc: MediaEditDocument;
  duration: number;
  layerFrames: LayerFrames;
};

export async function exportAnimation(file: Blob, {
  doc, sourceSize, outputSize, bitrate, frameRate, duration, layerFrames,
}: ExportAnimationParams, onProgress: CancellableCallback) {
  const { width, height } = outputSize;
  const background = new OffscreenCanvas(width, height);
  const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    composeFrame({
      ctx: background.getContext('2d')!,
      frame: image,
      sourceSize,
      doc,
      scratch: createFrameScratch(),
      shouldRequireAdjustments: true,
    });
  } finally {
    image.close();
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });
  const videoSource = new CanvasSource(canvas, {
    codec: 'avc',
    quality: new Quality({ bitrate }),
    keyFrameInterval: KEY_FRAME_INTERVAL,
  });
  output.addVideoTrack(videoSource, { frameRate });

  const frameCount = Math.max(1, Math.round(duration * frameRate!));
  try {
    await output.start();

    for (let i = 0; i < frameCount && !onProgress.isCanceled; i++) {
      const time = i / frameRate!;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(background, 0, 0);
      drawLayers(ctx, doc.layers!, outputSize, { frames: layerFrames, time });
      await videoSource.add(time, 1 / frameRate!);
      onProgress((i + 1) / frameCount);
    }

    if (onProgress.isCanceled) return undefined;

    videoSource.close();
    await output.finalize();
  } finally {
    if (output.state !== 'finalized') void output.cancel();
  }

  return {
    blob: new Blob([output.target.buffer!], { type: 'video/mp4' }),
    width,
    height,
  };
}

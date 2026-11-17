import type { VideoSample } from 'mediabunny';
import { VideoSampleSink } from 'mediabunny';

import type { LayerFrames } from '../../components/ui/mediaEditor/render/layers';
import type { Size } from '../../components/ui/mediaEditor/render/transform';
import type { MediaEditDocument } from '../../types/mediaEditor';

import { composeFrame, createFrameScratch } from '../../components/ui/mediaEditor/render/composeFrame';
import { fitCropToMaxSide } from '../../components/ui/mediaEditor/render/transform';
import { createInput, getDecodableVideoTrack } from './input';

type RenderFrameParams = {
  time: number;
  doc: MediaEditDocument;
  sourceSize: Size;
  maxSide: number;
  mimeType: string;
  quality?: number;
  outputFrameRate?: number;
  layerFrames?: LayerFrames;
};

export function getUprightFrame(sample: VideoSample, canvas: OffscreenCanvas): CanvasImageSource {
  if (!sample.rotation && !sample.flip) return sample.toCanvasImageSource();

  sample.draw(canvas.getContext('2d')!, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function renderFrame(file: Blob, {
  time, doc, sourceSize, maxSide, mimeType, quality, outputFrameRate, layerFrames,
}: RenderFrameParams) {
  const input = createInput(file);

  try {
    const track = await getDecodableVideoTrack(input);
    const sink = new VideoSampleSink(track);
    const start = doc.trim?.start ?? (outputFrameRate ? Math.max(await track.getFirstTimestamp(), 0) : 0);
    const frame = outputFrameRate
      ? await getEncodedFrame(sink, time, start, outputFrameRate)
      : { sample: await sink.getSample(time), time: time - start };
    const { sample } = frame;
    if (!sample) throw new Error('decodeFailed');

    const { width, height } = fitCropToMaxSide(doc.crop, maxSide);
    const resultCanvas = new OffscreenCanvas(width, height);

    try {
      composeFrame({
        ctx: resultCanvas.getContext('2d')!,
        frame: getUprightFrame(sample, new OffscreenCanvas(sourceSize.width, sourceSize.height)),
        sourceSize,
        doc,
        scratch: createFrameScratch(),
        shouldRequireAdjustments: true,
        layerFrames,
        time: frame.time,
      });
    } finally {
      sample.close();
    }

    const blob = await resultCanvas.convertToBlob({ type: mimeType, quality });
    return {
      blob, width, height, time: frame.time,
    };
  } finally {
    input.dispose();
  }
}

async function getEncodedFrame(sink: VideoSampleSink, time: number, start: number, frameRate: number) {
  const slot = Math.floor(Math.max(time - start, 0) * frameRate);
  const slotTime = slot / frameRate;
  let previousSample: VideoSample | undefined;

  for await (const sample of sink.samples(start + slotTime)) {
    const sampleSlot = Math.floor((Math.max(sample.timestamp, start) - start) * frameRate);
    if (sampleSlot < slot) {
      previousSample?.close();
      previousSample = sample;
      continue;
    }

    if (sampleSlot === slot) {
      previousSample?.close();
      return { sample, time: slotTime };
    }

    sample.close();
    break;
  }

  return { sample: previousSample, time: slotTime };
}

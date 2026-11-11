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
  layerFrames?: LayerFrames;
};

export function getUprightFrame(sample: VideoSample, canvas: OffscreenCanvas): CanvasImageSource {
  if (!sample.rotation && !sample.flip) return sample.toCanvasImageSource();

  sample.draw(canvas.getContext('2d')!, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function renderFrame(file: Blob, {
  time, doc, sourceSize, maxSide, mimeType, quality, layerFrames,
}: RenderFrameParams) {
  const input = createInput(file);

  try {
    const track = await getDecodableVideoTrack(input);
    const sample = await new VideoSampleSink(track).getSample(time);
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
        time: time - (doc.trim?.start ?? 0),
      });
    } finally {
      sample.close();
    }

    const blob = await resultCanvas.convertToBlob({ type: mimeType, quality });
    return { blob, width, height };
  } finally {
    input.dispose();
  }
}

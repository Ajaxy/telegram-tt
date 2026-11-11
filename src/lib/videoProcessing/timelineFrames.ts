import { CanvasSink } from 'mediabunny';

import type { CancellableCallback } from '../../util/PostMessageConnector';

import { createInput, getDecodableVideoTrack } from './input';

type TimelineFramesParams = {
  count: number;
  width: number;
  height: number;
};

export async function getTimelineFrames(
  file: Blob,
  { count, width, height }: TimelineFramesParams,
  onFrame: CancellableCallback,
) {
  const input = createInput(file);

  try {
    const track = await getDecodableVideoTrack(input);
    const start = await track.getFirstTimestamp();
    const end = await track.computeDuration();
    const step = (end - start) / count;
    const timestamps = Array.from({ length: count }, (_, i) => start + step * (i + 0.5));

    const sink = new CanvasSink(track, { width, height, fit: 'cover' });
    let index = 0;
    for await (const result of sink.canvasesAtTimestamps(timestamps)) {
      if (onFrame.isCanceled) return;
      if (result) {
        onFrame(index, await createImageBitmap(result.canvas));
      }
      index++;
    }
  } finally {
    input.dispose();
  }
}

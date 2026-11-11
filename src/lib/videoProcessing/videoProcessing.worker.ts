import type { LayerFrames } from '../../components/ui/mediaEditor/render/layers';

import { createWorkerInterface } from '../../util/createPostMessageInterface';
import { closeLayerFrames } from '../../components/ui/mediaEditor/render/layers';
import { exportAnimation } from './exportAnimation';
import { exportVideo } from './exportVideo';
import { probe } from './probe';
import { renderFrame } from './renderFrame';
import { getTimelineFrames } from './timelineFrames';

const api = {
  probe,
  getTimelineFrames,
  renderFrame: closeLayerFramesAfter(renderFrame),
  exportVideo: closeLayerFramesAfter(exportVideo),
  exportAnimation: closeLayerFramesAfter(exportAnimation),
};

export type VideoProcessingApi = typeof api;

createWorkerInterface(api, 'videoProcessing');

function closeLayerFramesAfter<Args extends [Blob, { layerFrames?: LayerFrames }, ...unknown[]], Result>(
  fn: (...args: Args) => Promise<Result>,
) {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } finally {
      closeLayerFrames(args[1].layerFrames);
    }
  };
}

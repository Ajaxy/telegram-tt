import type { VideoProcessingApi } from '../lib/videoProcessing/videoProcessing.worker';
import type { CancellableCallback, Connector } from './PostMessageConnector';

import { createConnector } from './PostMessageConnector';

let connector: Connector<VideoProcessingApi> | undefined;

function getConnector() {
  if (!connector) {
    const worker = new Worker(
      new URL('../lib/videoProcessing/videoProcessing.worker.ts', import.meta.url),
      { type: 'module' },
    );
    connector = createConnector<VideoProcessingApi>(worker, undefined, 'videoProcessing');
  }

  return connector;
}

export function requestVideoProcessing(payload: Parameters<Connector<VideoProcessingApi>['request']>[0]) {
  return getConnector().request(payload);
}

export function cancelVideoProcessing(callback: CancellableCallback) {
  getConnector().cancelCallback(callback);
}

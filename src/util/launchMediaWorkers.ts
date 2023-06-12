import type { MediaWorkerApi } from '../lib/mediaWorker/index.worker';
import type { Connector } from './PostMessageConnector';

import { IS_VIDEO_PREVIEW_SUPPORTED } from './windowEnvironment';
import { createConnector } from './PostMessageConnector';

export const MAX_WORKERS = Math.min(navigator.hardwareConcurrency || 4, 4);

let instances: {
  worker: Worker;
  connector: Connector<MediaWorkerApi>;
}[] | undefined;

export default function launchMediaWorkers() {
  if (!IS_VIDEO_PREVIEW_SUPPORTED) return [];
  if (!instances) {
    instances = new Array(MAX_WORKERS).fill(undefined).map(
      () => {
        const worker = new Worker(new URL('../lib/mediaWorker/index.worker.ts', import.meta.url));
        const connector = createConnector<MediaWorkerApi>(worker);
        return { worker, connector };
      },
    );
  }

  return instances;
}

import type { MediaWorkerApi } from '../lib/mediaWorker/index.worker';
import type { Connector } from './PostMessageConnector';

import { IS_TEST } from '../config';

import { createConnector } from './PostMessageConnector';

export const MAX_WORKERS = Math.min(navigator.hardwareConcurrency || 4, 4);

let instances: {
  worker: Worker;
  connector: Connector<MediaWorkerApi>;
}[] | undefined;

export default function launchMediaWorkers() {
  if (IS_TEST) return [];
  if (!instances) {
    instances = new Array(MAX_WORKERS).fill(undefined).map(
      () => {
        const worker = new Worker(new URL('../lib/mediaWorker/index.worker.ts', import.meta.url));
        const connector = createConnector<MediaWorkerApi>(worker, undefined, 'media');
        return { worker, connector };
      },
    );
  }

  return instances;
}

export function requestMediaWorker(payload: Parameters<Connector<MediaWorkerApi>['request']>[0], index: number) {
  return launchMediaWorkers()[index].connector.request(payload);
}

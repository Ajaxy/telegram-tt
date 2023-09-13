import type { FastTextApi } from '../lib/fasttextweb/fasttext.worker';
import type { Connector } from './PostMessageConnector';

import { IS_TRANSLATION_SUPPORTED } from './windowEnvironment';

import Deferred from './Deferred';
import { createConnector } from './PostMessageConnector';

const WORKER_INIT_DELAY = 4000;

const DEFAULT_THRESHOLD = 0.2;
const DEFAULT_LABELS_COUNT = 5;

let worker: Connector<FastTextApi> | undefined;
const initializationDeferred = new Deferred();

if (IS_TRANSLATION_SUPPORTED) {
  setTimeout(initWorker, WORKER_INIT_DELAY);
}

function initWorker() {
  if (!worker) {
    worker = createConnector<FastTextApi>(
      new Worker(new URL('../lib/fasttextweb/fasttext.worker.ts', import.meta.url)),
    );
    initializationDeferred.resolve();
  }
}

export async function detectLanguage(text: string, threshold = DEFAULT_THRESHOLD) {
  if (!worker) await initializationDeferred.promise;
  const result = await worker!.request({ name: 'detectLanguage', args: [text, threshold] });
  return result;
}

export async function detectLanguageProbability(
  text: string, labelsCount = DEFAULT_LABELS_COUNT, threshold = DEFAULT_THRESHOLD,
) {
  if (!worker) await initializationDeferred.promise;
  const result = await worker!.request({ name: 'detectLanguageProbability', args: [text, labelsCount, threshold] });
  return result;
}

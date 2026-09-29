import temmlUrl from 'temml/dist/temml.mjs?url';

import type { LatexRequest, LatexResponse } from '../lib/latex/latex.worker';

type RenderJob = {
  source: string;
  isBlock?: boolean;
  complete: (markup?: string) => void;
};

const INITIALIZATION_TIMEOUT = 30000;
const RENDER_TIMEOUT = 500;

const queue: RenderJob[] = [];
let worker: Worker | undefined;
let isReady = false;
let activeJob: RenderJob | undefined;
let timeoutId: number | undefined;

export default function renderLatex(
  source: string, isBlock: boolean | undefined, signal: AbortSignal,
): Promise<string | undefined> {
  if (signal.aborted) return Promise.resolve(undefined);

  return new Promise((resolve) => {
    const job: RenderJob = {
      source,
      isBlock,
      complete(markup) {
        signal.removeEventListener('abort', handleAbort);
        resolve(markup);
      },
    };

    function handleAbort() {
      if (activeJob === job) {
        resetWorker();
        activeJob = undefined;
      } else {
        queue.splice(queue.indexOf(job), 1);
      }

      job.complete();
      if (!queue.length && !isReady) resetWorker();
      processQueue();
    }

    signal.addEventListener('abort', handleAbort, { once: true });
    queue.push(job);
    processQueue();
  });
}

function processQueue() {
  if (activeJob || !queue.length) return;
  if (!worker) initializeWorker();
  if (!isReady) return;

  activeJob = queue.shift()!;
  timeoutId = window.setTimeout(handleWorkerFailure, RENDER_TIMEOUT);

  try {
    worker!.postMessage({
      type: 'render',
      source: activeJob.source,
      isBlock: activeJob.isBlock,
    } satisfies LatexRequest);
  } catch {
    handleWorkerFailure();
  }
}

function initializeWorker() {
  try {
    const instance = new Worker(new URL('../lib/latex/latex.worker.ts', import.meta.url), { type: 'module' });
    worker = instance;

    instance.onmessage = ({ data }: MessageEvent<LatexResponse>) => {
      if (worker !== instance) return;

      if (data.type === 'ready') {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
        isReady = true;
        processQueue();
      } else if (data.type === 'result') {
        completeActiveJob(data.markup);
      } else {
        handleWorkerFailure();
      }
    };

    function handleError() {
      if (worker !== instance) return;
      handleWorkerFailure();
    }

    instance.onerror = handleError;
    instance.onmessageerror = handleError;
    timeoutId = window.setTimeout(handleWorkerFailure, INITIALIZATION_TIMEOUT);
    instance.postMessage({
      type: 'init',
      moduleUrl: new URL(temmlUrl, document.baseURI).href,
    } satisfies LatexRequest);
  } catch {
    handleWorkerFailure();
  }
}

function handleWorkerFailure() {
  const hasInitialized = isReady;
  resetWorker();

  if (!hasInitialized) {
    queue.splice(0).forEach((job) => job.complete());
    return;
  }

  completeActiveJob();
}

function completeActiveJob(markup?: string) {
  window.clearTimeout(timeoutId);
  timeoutId = undefined;
  const job = activeJob;
  activeJob = undefined;
  job?.complete(markup);
  processQueue();
}

function resetWorker() {
  window.clearTimeout(timeoutId);
  timeoutId = undefined;
  worker?.terminate();
  worker = undefined;
  isReady = false;
}

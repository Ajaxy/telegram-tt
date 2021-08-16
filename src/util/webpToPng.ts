import { isWebpSupported } from './environment';
import { dataUriToBlob, blobToDataUri } from './files';
import { pause } from './schedulers';

const WORKER_INITIALIZATION_TIMEOUT = 2000;

let canvas: HTMLCanvasElement;
let worker: IWebpWorker;

export const EMPTY_IMAGE_DATA_URI = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk'
  + 'YAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export async function webpToPng(url: string, blob: Blob): Promise<Blob | undefined> {
  initWebpWorker();

  while (!worker.wasmReady) {
    await pause(WORKER_INITIALIZATION_TIMEOUT);
  }

  const { result, width, height } = await getDecodePromise(url, blob);
  if (!width || !height) {
    return undefined;
  }

  return createPng({ result, width, height });
}

export async function webpToPngBase64(key: string, url: string): Promise<string> {
  if (isWebpSupported() || url.substr(0, 15) !== 'data:image/webp') {
    return url;
  }

  initWebpWorker();

  const pngBlob = await webpToPng(key, dataUriToBlob(url));

  if (!pngBlob) {
    throw new Error(`Can't convert webp to png. Url: ${url}`);
  }

  return blobToDataUri(pngBlob);
}

function initWebpWorker() {
  if (!worker) {
    worker = new Worker(new URL('../lib/webp/webp_wasm.worker.js', import.meta.url)) as IWebpWorker;
    worker.wasmReady = false;
    worker.onmessage = handleLibWebpMessage;
  }
}

function createPng({ result, width, height }: TEncodedImage): Promise<Blob | undefined> {
  if (!canvas) {
    canvas = document.createElement('canvas');
  }

  return new Promise((resolve) => {
    const img = new ImageData(result, width, height);

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(img, 0, 0);

    canvas.toBlob((blob) => {
      resolve(blob ?? undefined);
    }, 'image/png', 1);
  });
}

function handleLibWebpMessage(e: MessageEvent) {
  const { id } = e.data;
  switch (e.data.type) {
    case 'initialized': {
      worker.wasmReady = true;
      break;
    }

    case 'result': {
      if (worker.requests.has(id)) {
        const resolve = worker.requests.get(id)!;

        worker.requests.delete(id);
        resolve(e.data!);
      }
      break;
    }
  }
}

function getDecodePromise(url: string, blob: Blob): Promise<TEncodedImage> {
  return new Promise((resolve) => {
    if (!worker.requests) {
      worker.requests = new Map();
    }

    worker.requests.set(url, resolve);
    worker.postMessage({ id: url, blob });
  });
}

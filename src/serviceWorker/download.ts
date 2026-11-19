import { DEBUG, DOWNLOAD_KEY_CACHE_NAME } from '../config';
import { bufferFromHex, bufferToHex } from '../util/encoding/buffer';
import { pause } from '../util/schedulers';
import { MEDIA_SECURITY_HEADERS, type PartInfo, requestPart } from './progressive';

const DOWNLOAD_PART_SIZE = 1024 * 1024;
const TEST_PART_SIZE = 64 * 1024;

const QUEUE_SIZE = 8;
const MAX_PART_ATTEMPTS = 3;
const PART_RETRY_DELAY = 1000;

const KEY_REQUEST = '/download-key';

let keyPromise: Promise<CryptoKey> | undefined;

// Download URLs are signed for app pages, so a cross-site navigation cannot start a download.
// The key is persisted, so the browser can retry a failed download after the worker restarts.
function getKey() {
  keyPromise ??= (async () => {
    let raw: ArrayBuffer | undefined;
    try {
      const cache = await self.caches.open(DOWNLOAD_KEY_CACHE_NAME);
      raw = await (await cache.match(KEY_REQUEST))?.arrayBuffer();
      if (!raw) {
        raw = crypto.getRandomValues(new Uint8Array(32)).buffer;
        await cache.put(KEY_REQUEST, new Response(raw));
      }
    } catch {
      // Without storage the key lives only in memory, so downloads still work until the worker restarts
      raw ??= crypto.getRandomValues(new Uint8Array(32)).buffer;
    }

    return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  })();

  return keyPromise;
}

function getSignedPart(url: URL) {
  const unsigned = new URL(url);
  unsigned.searchParams.delete('token');
  return new TextEncoder().encode(unsigned.href);
}

export function handleDownloadMessage(e: ExtendableMessageEvent) {
  if (e.data?.type !== 'signDownload' || typeof e.data.url !== 'string') return;

  e.waitUntil((async () => {
    try {
      const url = new URL(e.data.url);
      const signature = await crypto.subtle.sign('HMAC', await getKey(), getSignedPart(url));
      url.searchParams.set('token', bufferToHex(new Uint8Array(signature)));
      e.ports[0]?.postMessage(url.href);
    } catch {
      // The page waits for a reply, so report failure instead of leaving it pending
      e.ports[0]?.postMessage(undefined);
    }
  })());
}

async function isSigned(url: URL) {
  const token = url.searchParams.get('token');
  if (!token) return false;

  try {
    const signature = bufferFromHex(token);
    return await crypto.subtle.verify('HMAC', await getKey(), signature, getSignedPart(url));
  } catch {
    return false;
  }
}

class FilePartQueue<T> {
  queue: Promise<T>[];

  constructor() {
    this.queue = [];
  }

  push(task: Promise<T>) {
    this.queue.push(task);
  }

  async pop(): Promise<T> {
    const result = await this.queue.shift()!;
    return result;
  }

  get size() {
    return this.queue.length;
  }
}

export async function respondForDownload(e: FetchEvent) {
  const { url } = e.request;
  const parsedUrl = new URL(url);
  if (!await isSigned(parsedUrl)) {
    return new Response('', {
      status: 403,
      statusText: 'Download was not requested by the app',
    });
  }

  const partInfo = await requestPartWithRetry(e, { url, start: 0, end: TEST_PART_SIZE });
  if (!partInfo) {
    return new Response('', {
      status: 500,
      statusText: 'Failed to fetch file to download',
    });
  }

  const filenameHeader = buildContentDispositionFilenameHeader(parsedUrl.searchParams.get('filename') || undefined);
  const { fullSize, mimeType } = partInfo;
  // The signed URL pins the file, so its token is a stable validator for resuming
  const etag = `"${parsedUrl.searchParams.get('token')}"`;

  const headers: [string, string][] = [
    ['Content-Type', mimeType],
    ['Content-Disposition', `attachment${filenameHeader ? `; ${filenameHeader}` : ''}`],
    ['Accept-Ranges', 'bytes'],
    ['ETag', etag],
    ...MEDIA_SECURITY_HEADERS,
  ];

  let start = 0;
  let end = fullSize - 1;
  const ifRange = e.request.headers.get('if-range');
  const range = (!ifRange || ifRange === etag)
    ? /^bytes=(\d+)-(\d*)$/.exec(e.request.headers.get('range') || '') : undefined;
  if (range) {
    start = Number(range[1]);
    if (range[2]) end = Math.min(Number(range[2]), end);

    if (start > end) {
      return new Response('', {
        status: 416,
        statusText: 'Range Not Satisfiable',
        headers: [['Content-Range', `bytes */${fullSize}`], ...MEDIA_SECURITY_HEADERS],
      });
    }

    headers.push(['Content-Range', `bytes ${start}-${end}/${fullSize}`]);
  }

  headers.push(['Content-Length', String(end - start + 1)]);

  const queue = new FilePartQueue<ArrayBuffer | undefined>();
  // Parts stay aligned to `DOWNLOAD_PART_SIZE`, and the edges are trimmed to the range
  let nextOffset = start - (start % DOWNLOAD_PART_SIZE);
  let partStart = nextOffset;
  const enqueue = () => {
    queue.push(requestPartWithRetry(e, {
      url, start: nextOffset, end: nextOffset + DOWNLOAD_PART_SIZE - 1,
    })
      .then((part) => part?.arrayBuffer));
    nextOffset += DOWNLOAD_PART_SIZE;
  };

  const stream = new ReadableStream({
    start(controller) {
      if (nextOffset > end) {
        controller.close();
        return;
      }

      for (let i = 0; i < QUEUE_SIZE && nextOffset <= end; i++) {
        enqueue();
      }
    },

    async pull(controller) {
      const buffer = await queue.pop();
      // Erroring instead of closing lets the browser mark the download as failed and retry it
      if (!buffer) {
        controller.error(new Error('Failed to fetch file part'));
        return;
      }

      controller.enqueue(new Uint8Array(buffer).subarray(Math.max(start - partStart, 0), end - partStart + 1));

      if (partStart + buffer.byteLength > end) {
        controller.close();
        return;
      }

      if (buffer.byteLength < DOWNLOAD_PART_SIZE) {
        controller.error(new Error('File ended before its size'));
        return;
      }

      partStart += DOWNLOAD_PART_SIZE;
      if (nextOffset <= end) enqueue();
    },
  });

  return new Response(stream, {
    status: range ? 206 : 200,
    statusText: range ? 'Partial Content' : 'OK',
    headers,
  });
}

// Each attempt picks a tab again, so the download survives closing the tab that served it
async function requestPartWithRetry(
  e: FetchEvent, params: { url: string; start: number; end: number }, attempt = 1,
): Promise<PartInfo | undefined> {
  const part = await requestPart(e, params).catch((err) => {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('FETCH DOWNLOAD', err);
    }
    return undefined;
  });
  if (part || attempt >= MAX_PART_ATTEMPTS) return part;

  await pause(PART_RETRY_DELAY);
  return requestPartWithRetry(e, params, attempt + 1);
}

function buildContentDispositionFilenameHeader(filename?: string) {
  if (!filename) {
    return undefined;
  }

  const sanitizedFilename = Array.from(filename)
    .filter((char) => {
      const charCode = char.charCodeAt(0);
      return charCode >= 0x20 && charCode !== 0x7F;
    })
    .join('');

  if (!sanitizedFilename) {
    return undefined;
  }

  const encodedFilename = encodeURIComponent(sanitizedFilename)
    .replaceAll('\'', '%27')
    .replaceAll('(', '%28')
    .replaceAll(')', '%29')
    .replaceAll('*', '%2A');

  return `filename*=UTF-8''${encodedFilename}`;
}

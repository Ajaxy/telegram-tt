import {
  DEBUG,
  MEDIA_CACHE_MAX_BYTES,
  MEDIA_PROGRESSIVE_CACHE_DISABLED,
  MEDIA_PROGRESSIVE_CACHE_NAME,
} from '../config';
import { getAccountSlot } from '../util/accountSlot';
import generateUniqueId from '../util/generateUniqueId';
import { loadPasscodeMeta, requestPasscodeStateLock } from '../util/passcode/meta';
import { pause } from '../util/schedulers';

declare const self: ServiceWorkerGlobalScope;

export type PartInfo = {
  type: 'PartInfo';
  arrayBuffer: ArrayBuffer;
  mimeType: 'string';
  fullSize: number;
};

type RequestStates = {
  resolve: (response: PartInfo) => void;
  reject: () => void;
};

const MB = 1024 * 1024;
const DEFAULT_PART_SIZE = 0.5 * MB;
const MAX_END_TO_CACHE = 2 * MB - 1; // We only cache the first 2 MB of each file
const PART_TIMEOUT = 60000;
const CLIENT_CHECK_INTERVAL = 3000;

const requestStates = new Map<string, RequestStates>();

export async function respondForProgressive(e: FetchEvent) {
  const { url } = e.request;
  const accountSlot = getAccountSlot(url);
  const range = e.request.headers.get('range');
  const bytes = /^bytes=(\d+)-(\d+)?$/g.exec(range || '')!;
  const start = Number(bytes[1]);
  const originalEnd = Number(bytes[2]);

  let end = originalEnd;
  if (!end || (end - start + 1) > DEFAULT_PART_SIZE) {
    end = start + DEFAULT_PART_SIZE - 1;
  }

  const parsedUrl = new URL(url);

  // Optimization for Safari
  if (start === 0 && end === 1) {
    const fileSizeParam = parsedUrl.searchParams.get('fileSize');
    const fileSize = fileSizeParam && Number(fileSizeParam);
    const mimeType = parsedUrl.searchParams.get('mimeType');

    if (fileSize && mimeType) {
      return new Response(new Uint8Array(2).buffer, {
        status: 206,
        statusText: 'Partial Content',
        headers: [
          ['Content-Range', `bytes 0-1/${fileSize}`],
          ['Accept-Ranges', 'bytes'],
          ['Content-Length', '2'],
          ['Content-Type', mimeType],
          ...MEDIA_SECURITY_HEADERS,
        ],
      });
    }
  }

  const hasPasscode = await loadPasscodeMeta().then(Boolean).catch(() => true);
  parsedUrl.searchParams.set('start', String(start));
  parsedUrl.searchParams.set('end', String(end));
  const cacheKey = parsedUrl.href;
  const [cachedArrayBuffer, cachedHeaders] = !MEDIA_PROGRESSIVE_CACHE_DISABLED && !hasPasscode
    ? await fetchFromCache(accountSlot, cacheKey) : [];

  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log(
      `FETCH PROGRESSIVE ${cacheKey} (request: ${start}-${originalEnd}) CACHED: ${Boolean(cachedArrayBuffer)}`,
    );
  }

  if (cachedArrayBuffer) {
    return new Response(cachedArrayBuffer, {
      status: 206,
      statusText: 'Partial Content',
      headers: [...(cachedHeaders || []), ...MEDIA_SECURITY_HEADERS],
    });
  }

  let partInfo;
  try {
    partInfo = await requestPart(e, { url, start, end });
  } catch (err) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('FETCH PROGRESSIVE', err);
    }
  }

  if (!partInfo) {
    return new Response('', {
      status: 500,
      statusText: 'Failed to fetch progressive part',
    });
  }

  const { arrayBuffer, fullSize, mimeType } = partInfo;

  const partSize = Math.min(end - start + 1, arrayBuffer.byteLength);
  end = start + partSize - 1;
  const arrayBufferPart = arrayBuffer.slice(0, partSize);
  const headers: [string, string][] = [
    ['Content-Range', `bytes ${start}-${end}/${fullSize}`],
    ['Accept-Ranges', 'bytes'],
    ['Content-Length', String(partSize)],
    ['Content-Type', mimeType],
  ];

  if (
    !MEDIA_PROGRESSIVE_CACHE_DISABLED
    && !hasPasscode
    && partSize <= MEDIA_CACHE_MAX_BYTES
    && end < MAX_END_TO_CACHE
  ) {
    await requestPasscodeStateLock(async () => {
      if (await loadPasscodeMeta()) return;
      await saveToCache(accountSlot, cacheKey, arrayBufferPart, headers);
    });
  }

  return new Response(arrayBufferPart, {
    status: 206,
    statusText: 'Partial Content',
    headers: [...headers, ...MEDIA_SECURITY_HEADERS],
  });
}

// We can not cache 206 responses: https://github.com/GoogleChrome/workbox/issues/1644#issuecomment-638741359
async function fetchFromCache(accountSlot: number | undefined, cacheKey: string) {
  const cacheName = !accountSlot ? MEDIA_PROGRESSIVE_CACHE_NAME : `${MEDIA_PROGRESSIVE_CACHE_NAME}_${accountSlot}`;
  const cache = await self.caches.open(cacheName);

  return Promise.all([
    cache.match(`${cacheKey}&type=arrayBuffer`).then((r) => (r ? r.arrayBuffer() : undefined)),
    cache.match(`${cacheKey}&type=headers`).then((r) => (r ? r.json() : undefined)),
  ]);
}

async function saveToCache(
  accountSlot: number | undefined, cacheKey: string, arrayBuffer: ArrayBuffer, headers: HeadersInit,
) {
  const cacheName = !accountSlot ? MEDIA_PROGRESSIVE_CACHE_NAME : `${MEDIA_PROGRESSIVE_CACHE_NAME}_${accountSlot}`;
  const cache = await self.caches.open(cacheName);

  return Promise.all([
    cache.put(new Request(`${cacheKey}&type=arrayBuffer`), new Response(arrayBuffer)),
    cache.put(new Request(`${cacheKey}&type=headers`), new Response(JSON.stringify(headers))),
  ]);
}

// Media bytes are sender-controlled, so they must never run as a page or a script on this origin
export const MEDIA_SECURITY_HEADERS: [string, string][] = [
  ['Content-Security-Policy', 'sandbox'],
  ['X-Content-Type-Options', 'nosniff'],
];

export async function requestPart(
  e: FetchEvent,
  params: { url: string; start: number; end: number },
): Promise<PartInfo | undefined> {
  const isDownload = params.url.includes('/download/');
  const client = await (isDownload ? getClientForRequest(params.url) : self.clients.get(e.clientId));
  if (!client) {
    return undefined;
  }

  const messageId = generateUniqueId();
  const requestState = {} as RequestStates;

  let isResolved = false;
  const promise = Promise.race([
    pause(PART_TIMEOUT).then(() => (isResolved ? undefined : Promise.reject(new Error('ERROR_PART_TIMEOUT')))),
    new Promise<PartInfo>((resolve, reject) => {
      Object.assign(requestState, { resolve, reject });
    }),
    // A closed tab never answers, so fail early and let the caller retry with another one
    (async () => {
      while (!isResolved) {
        await pause(CLIENT_CHECK_INTERVAL);
        if (!isResolved && !await self.clients.get(client.id)) throw new Error('ERROR_PART_CLIENT_GONE');
      }
      return undefined;
    })(),
  ]);

  requestStates.set(messageId, requestState);
  promise
    .catch(() => undefined)
    .finally(() => {
      requestStates.delete(messageId);
      isResolved = true;
    });

  client.postMessage({
    type: 'requestPart',
    messageId,
    params,
  });

  return promise;
}

async function getClientForRequest(url: string) {
  const urlAccountSlot = getAccountSlot(url);
  const clients = await self.clients.matchAll();
  return clients.find((c) => (
    c.type === 'window' && c.frameType === 'top-level' && getAccountSlot(c.url) === urlAccountSlot
  ));
}

self.addEventListener('message', (e) => {
  const { type, messageId, result } = e.data as {
    type: string;
    messageId: string;
    result: PartInfo;
  };

  if (type === 'partResponse') {
    const requestState = requestStates.get(messageId);
    if (requestState) {
      requestState.resolve(result);
    }
  }
});

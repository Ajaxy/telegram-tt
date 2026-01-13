import { LANG_CACHE_NAME, MEDIA_CACHE_NAME, MEDIA_CACHE_NAME_AVATARS, MEDIA_PROGRESSIVE_CACHE_NAME } from '../config';
import { yieldToMain } from './browser/scheduler';
import { ACCOUNT_SLOT } from './multiaccount';

const cacheApi = self.caches;

const LAST_ACCESS_HEADER = 'X-Last-Access';
const CACHE_TTL = 5 * 24 * 60 * 60 * 1000; // 5 days
const ACCESS_THROTTLE = 24 * 60 * 60 * 1000; // 1 day
const CLEANUP_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour

const CLEARABLE_CACHE_NAMES = [MEDIA_CACHE_NAME, MEDIA_CACHE_NAME_AVATARS, MEDIA_PROGRESSIVE_CACHE_NAME];

cleanup(CLEARABLE_CACHE_NAMES);
setInterval(() => {
  cleanup(CLEARABLE_CACHE_NAMES);
}, CLEANUP_INTERVAL);

let isSupported: boolean | undefined;

export async function isCacheApiSupported() {
  if (!cacheApi) return false;

  isSupported = isSupported ?? await cacheApi.has('test').then(() => true).catch(() => false);
  return isSupported;
}

export enum Type {
  Text,
  Blob,
  Json,
  ArrayBuffer,
}

function getCacheName(cacheName: string) {
  if (cacheName === LANG_CACHE_NAME) return cacheName;

  const suffix = ACCOUNT_SLOT ? `_${ACCOUNT_SLOT}` : '';
  return `${cacheName}${suffix}`;
}

export async function fetch(
  cacheName: string, key: string, type: Type, isHtmlAllowed = false,
) {
  if (!cacheApi) {
    return undefined;
  }

  try {
    // To avoid the error "Request scheme 'webdocument' is unsupported"
    const request = new Request(key.replace(/:/g, '_'));
    const cache = await cacheApi.open(getCacheName(cacheName));
    const response = await cache.match(request);
    if (!response) {
      return undefined;
    }

    const lastAccess = Number(response.headers.get(LAST_ACCESS_HEADER));
    const now = Date.now();
    if (!lastAccess || now - lastAccess > ACCESS_THROTTLE) {
      updateAccessTime(cache, request, response);
    }

    const contentType = response.headers.get('Content-Type');

    switch (type) {
      case Type.Text:
        return await response.text();
      case Type.Blob: {
        // Ignore deprecated data-uri avatars
        if (key.startsWith('avatar') && contentType && contentType.startsWith('text')) {
          return undefined;
        }

        const blob = await response.blob();
        const shouldRecreate = !blob.type || (!isHtmlAllowed && blob.type.includes('html'));
        // iOS Safari fails to preserve `type` in cache
        let resolvedType = blob.type || contentType;

        if (!(shouldRecreate && resolvedType)) {
          return blob;
        }

        // Prevent HTML-in-video attacks (for files that were cached before fix)
        if (!isHtmlAllowed) {
          resolvedType = resolvedType.replace(/html/gi, '');
        }

        return new Blob([blob], { type: resolvedType });
      }
      case Type.Json:
        return await response.json();
      case Type.ArrayBuffer:
        return await response.arrayBuffer();
      default:
        return undefined;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
    return undefined;
  }
}

export async function save(cacheName: string, key: string, data: AnyLiteral | Blob | ArrayBuffer | string) {
  if (!cacheApi) {
    return false;
  }

  try {
    const cacheData = typeof data === 'string' || data instanceof Blob || data instanceof ArrayBuffer
      ? data
      : JSON.stringify(data);
    // To avoid the error "Request scheme 'webdocument' is unsupported"
    const request = new Request(key.replace(/:/g, '_'));
    const response = new Response(cacheData);
    response.headers.set(LAST_ACCESS_HEADER, Date.now().toString());
    const cache = await cacheApi.open(getCacheName(cacheName));
    await cache.put(request, response);

    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
    return false;
  }
}

export async function remove(cacheName: string, key: string) {
  try {
    if (!cacheApi) {
      return undefined;
    }

    const cache = await cacheApi.open(getCacheName(cacheName));
    return await cache.delete(key);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
    return undefined;
  }
}

export async function clear(cacheName: string) {
  try {
    if (!cacheApi) {
      return undefined;
    }

    return await cacheApi.delete(getCacheName(cacheName));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
    return undefined;
  }
}

export async function cleanup(cacheNames: string[]) {
  if (!cacheApi) return;

  try {
    for (const cacheName of cacheNames) {
      const cache = await cacheApi.open(getCacheName(cacheName));
      const keys = await cache.keys();
      const now = Date.now();

      for (const request of keys) {
        await yieldToMain();
        const response = await cache.match(request);
        if (!response) continue;

        const lastAccess = Number(response.headers.get(LAST_ACCESS_HEADER));
        if (lastAccess && now - lastAccess > CACHE_TTL) {
          await cache.delete(request);
        }
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
  }
}

export function purgeClearableCache() {
  CLEARABLE_CACHE_NAMES.forEach((cacheName) => clear(cacheName));
}

async function updateAccessTime(cache: Cache, request: Request, response: Response) {
  try {
    const headers = new Headers(response.headers);
    headers.set(LAST_ACCESS_HEADER, Date.now().toString());
    const newResponse = new Response(response.clone().body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
    await cache.put(request, newResponse);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
  }
}

import { ACCOUNT_SLOT } from './multiaccount';

const cacheApi = self.caches;

const SUFFIX = ACCOUNT_SLOT ? `_${ACCOUNT_SLOT}` : '';

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

export async function fetch(
  cacheName: string, key: string, type: Type, isHtmlAllowed = false,
) {
  if (!cacheApi) {
    return undefined;
  }

  try {
    // To avoid the error "Request scheme 'webdocument' is unsupported"
    const request = new Request(key.replace(/:/g, '_'));
    const cache = await cacheApi.open(`${cacheName}${SUFFIX}`);
    const response = await cache.match(request);
    if (!response) {
      return undefined;
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
    const cache = await cacheApi.open(`${cacheName}${SUFFIX}`);
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

    const cache = await cacheApi.open(`${cacheName}${SUFFIX}`);
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

    return await cacheApi.delete(`${cacheName}${SUFFIX}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
    return undefined;
  }
}

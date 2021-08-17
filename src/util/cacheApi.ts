// eslint-disable-next-line no-restricted-globals
const cacheApi = self.caches;

export enum Type {
  Text,
  Blob,
  Json,
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
    const cache = await cacheApi.open(cacheName);
    const response = await cache.match(request);
    if (!response) {
      return undefined;
    }

    switch (type) {
      case Type.Text:
        return await response.text();
      case Type.Blob: {
        const blob = await response.blob();

        // Safari does not return correct Content-Type header for webp images.
        if (key.substr(0, 7) === 'sticker') {
          return new Blob([blob], { type: 'image/webp' });
        }

        // iOS Safari fails to preserve `type` in cache
        if (!blob.type) {
          const contentType = response.headers.get('Content-Type');
          if (contentType) {
            return new Blob([blob], { type: isHtmlAllowed ? contentType : contentType.replace(/html/gi, '') });
          }
        }

        // Prevent HTML-in-video attacks (for files that were cached before fix)
        if (!isHtmlAllowed && blob.type.includes('html')) {
          return new Blob([blob], { type: blob.type.replace(/html/gi, '') });
        }

        return blob;
      }
      case Type.Json:
        return await response.json();
      default:
        return undefined;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
    return undefined;
  }
}

export async function save(cacheName: string, key: string, data: AnyLiteral | Blob | string) {
  if (!cacheApi) {
    return undefined;
  }

  try {
    const cacheData = typeof data === 'string' || data instanceof Blob ? data : JSON.stringify(data);
    // To avoid the error "Request scheme 'webdocument' is unsupported"
    const request = new Request(key.replace(/:/g, '_'));
    const response = new Response(cacheData);
    const cache = await cacheApi.open(cacheName);
    return await cache.put(request, response);
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

    return await cacheApi.delete(cacheName);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
    return undefined;
  }
}

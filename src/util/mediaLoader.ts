import {
  ApiMediaFormat,
  ApiMediaFormatToPrepared,
  ApiOnProgress,
  ApiParsedMedia,
  ApiPreparedMedia,
} from '../api/types';

import {
  DEBUG, MEDIA_CACHE_DISABLED, MEDIA_CACHE_NAME, MEDIA_CACHE_NAME_AVATARS,
} from '../config';
import { callApi, cancelApiProgress } from '../api/gramjs';
import * as cacheApi from './cacheApi';
import { fetchBlob } from './files';
import { IS_OPUS_SUPPORTED, IS_PROGRESSIVE_SUPPORTED, isWebpSupported } from './environment';
import { oggToWav } from './oggToWav';
import { webpToPng } from './webpToPng';

const asCacheApiType = {
  [ApiMediaFormat.DataUri]: cacheApi.Type.Text,
  [ApiMediaFormat.BlobUrl]: cacheApi.Type.Blob,
  [ApiMediaFormat.Lottie]: cacheApi.Type.Json,
  [ApiMediaFormat.Progressive]: undefined,
  [ApiMediaFormat.Stream]: undefined,
};

const PROGRESSIVE_URL_PREFIX = './progressive/';

const memoryCache = new Map<string, ApiPreparedMedia>();
const fetchPromises = new Map<string, Promise<ApiPreparedMedia | undefined>>();

export function fetch<T extends ApiMediaFormat>(
  url: string, mediaFormat: T, onProgress?: ApiOnProgress,
): Promise<ApiMediaFormatToPrepared<T>> {
  if (mediaFormat === ApiMediaFormat.Progressive) {
    return (
      IS_PROGRESSIVE_SUPPORTED
        ? getProgressive(url)
        : fetch(url, ApiMediaFormat.BlobUrl, onProgress)
    ) as Promise<ApiMediaFormatToPrepared<T>>;
  }

  if (!fetchPromises.has(url)) {
    const promise = fetchFromCacheOrRemote(url, mediaFormat, onProgress)
      .catch((err) => {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.warn(err);
        }

        return undefined;
      })
      .finally(() => {
        fetchPromises.delete(url);
      });

    fetchPromises.set(url, promise);
  }

  return fetchPromises.get(url) as Promise<ApiMediaFormatToPrepared<T>>;
}

export function getFromMemory<T extends ApiMediaFormat>(url: string) {
  return memoryCache.get(url) as ApiMediaFormatToPrepared<T>;
}

export function cancelProgress(progressCallback: ApiOnProgress) {
  cancelApiProgress(progressCallback);
}

function getProgressive(url: string) {
  const progressiveUrl = `${PROGRESSIVE_URL_PREFIX}${url}`;

  memoryCache.set(url, progressiveUrl);

  return Promise.resolve(progressiveUrl);
}

async function fetchFromCacheOrRemote(url: string, mediaFormat: ApiMediaFormat, onProgress?: ApiOnProgress) {
  if (!MEDIA_CACHE_DISABLED) {
    const cacheName = url.startsWith('avatar') ? MEDIA_CACHE_NAME_AVATARS : MEDIA_CACHE_NAME;
    const cached = await cacheApi.fetch(cacheName, url, asCacheApiType[mediaFormat]!);
    if (cached) {
      let media = cached;

      if (cached.type === 'audio/ogg' && !IS_OPUS_SUPPORTED) {
        media = await oggToWav(media);
      }

      if (cached.type === 'image/webp' && !isWebpSupported() && media) {
        const mediaPng = await webpToPng(url, media);
        if (mediaPng) {
          media = mediaPng;
        }
      }

      const prepared = prepareMedia(media);

      memoryCache.set(url, prepared);

      return prepared;
    }
  }

  if (mediaFormat === ApiMediaFormat.Stream) {
    const mediaSource = new MediaSource();
    const streamUrl = URL.createObjectURL(mediaSource);
    let isOpen = false;

    mediaSource.addEventListener('sourceopen', () => {
      if (isOpen) {
        return;
      }
      isOpen = true;

      const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');

      void callApi('downloadMedia', { url, mediaFormat }, (progress: number, arrayBuffer: ArrayBuffer) => {
        if (onProgress) {
          onProgress(progress);
        }

        if (progress === 1) {
          mediaSource.endOfStream();
        }

        if (!arrayBuffer) {
          return;
        }

        sourceBuffer.appendBuffer(arrayBuffer!);
      });
    });

    memoryCache.set(url, streamUrl);
    return streamUrl;
  }

  const remote = await callApi('downloadMedia', { url, mediaFormat }, onProgress);
  if (!remote) {
    throw new Error('Failed to fetch media');
  }

  let { prepared, mimeType } = remote;

  if (mimeType === 'audio/ogg' && !IS_OPUS_SUPPORTED) {
    const blob = await fetchBlob(prepared as string);
    URL.revokeObjectURL(prepared as string);
    const media = await oggToWav(blob);
    prepared = prepareMedia(media);
    mimeType = blob.type;
  }

  if (mimeType === 'image/webp' && !isWebpSupported()) {
    const blob = await fetchBlob(prepared as string);
    URL.revokeObjectURL(prepared as string);
    const media = await webpToPng(url, blob);
    if (media) {
      prepared = prepareMedia(media);
      mimeType = blob.type;
    }
  }

  memoryCache.set(url, prepared);

  return prepared;
}

function prepareMedia(mediaData: ApiParsedMedia): ApiPreparedMedia {
  if (mediaData instanceof Blob) {
    return URL.createObjectURL(mediaData);
  }

  return mediaData;
}

if (IS_PROGRESSIVE_SUPPORTED) {
  navigator.serviceWorker.addEventListener('message', async (e) => {
    const { type, messageId, params } = e.data as {
      type: string;
      messageId: string;
      params: { url: string; start: number; end: number };
    };

    if (type !== 'requestPart') {
      return;
    }

    const result = await callApi('downloadMedia', { mediaFormat: ApiMediaFormat.Progressive, ...params });
    if (!result) {
      return;
    }

    const { arrayBuffer, mimeType, fullSize } = result;

    navigator.serviceWorker.controller!.postMessage({
      type: 'partResponse',
      messageId,
      result: {
        arrayBuffer,
        mimeType,
        fullSize,
      },
    }, [arrayBuffer!]);
  });
}

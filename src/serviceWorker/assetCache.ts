import { ASSET_CACHE_NAME } from '../config';
import { pause } from '../util/schedulers';

declare const self: ServiceWorkerGlobalScope;

// An attempt to fix freezing UI on iOS
const CACHE_TIMEOUT = 3000;

export async function respondWithCache(e: FetchEvent) {
  const cacheResult = await withTimeout(async () => {
    const cache = await self.caches.open(ASSET_CACHE_NAME);
    const cached = await cache.match(e.request);

    return { cache, cached };
  }, CACHE_TIMEOUT);

  const { cache, cached } = cacheResult || {};

  if (cache && cached) {
    if (cached.ok) {
      return cached;
    } else {
      await cache.delete(e.request);
    }
  }

  const remote = await fetch(e.request);

  if (remote.ok && cache) {
    cache.put(e.request, remote.clone());
  }

  return remote;
}

async function withTimeout<T>(cb: () => Promise<T>, timeout: number) {
  let isResolved = false;

  try {
    return await Promise.race([
      pause(timeout).then(() => (isResolved ? undefined : Promise.reject(new Error('TIMEOUT')))),
      cb(),
    ]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return undefined;
  } finally {
    isResolved = true;
  }
}

export function clearAssetCache() {
  return self.caches.delete(ASSET_CACHE_NAME);
}

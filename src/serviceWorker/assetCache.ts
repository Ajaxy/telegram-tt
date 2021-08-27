import { ASSET_CACHE_NAME } from '../config';

declare const self: ServiceWorkerGlobalScope;

export async function respondWithCache(e: FetchEvent) {
  const cache = await self.caches.open(ASSET_CACHE_NAME);
  const cached = await cache.match(e.request);

  if (cached) {
    if (cached.ok) {
      return cached;
    } else {
      await cache.delete(e.request);
    }
  }

  const remote = await fetch(e.request);

  if (remote.ok) {
    cache.put(e.request, remote.clone());
  }

  return remote;
}

export function clearAssetCache() {
  return self.caches.delete(ASSET_CACHE_NAME);
}
